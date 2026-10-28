---
title: Tool Calling 实战
sidebar_position: 3
---

# Tool Calling 实战：从函数工具到 MCP Server

:::tip 先看结论
工具是 Agent 的手脚。写工具的第一原则不是「功能全」，而是**边界清晰、失败可见**——
一个不会报错的工具，会让 Agent 带着错误结果一路跑下去。

这篇不用任何框架：先写一个查真实数据库的函数工具，把「工具该怎么设计」用实测数字讲清；
再把它改成一个标准 MCP Server，最后让 Agent 从 MCP 里**把工具问出来**用。
:::

## 这篇解决什么问题

基础篇《Tool Calling 与 MCP》讲的是**机制**：模型怎么发起工具调用、参数怎么传、结果怎么回。
这一篇讲的是**动手**：写一个函数工具、发布一个 MCP Server，并让 Agent 真的用起来。

上一篇《Memory 实战》结尾留的缺口是「工具太少」，原话是这么说的：

```python
TOOLS = [...]                          # 声明（告诉模型有哪些能力）
TOOL_IMPL = {"get_weather": ...}       # 实现（真的去执行）
```

两处必须对齐，加一个工具要改两个地方，而且骨架里没有任何「运行时发现工具」的机制。
这一篇先把工具本身写对，再用 MCP 把「声明」这一步从代码里拿出去。

## 一、工具的本质：一次结构化的函数调用

一句话：**你给模型一份说明书，它还你一组参数。**

这份说明书就是工具声明（schema）：

```json
{
  "type": "function",
  "function": {
    "name": "query_ad_report",
    "description": "查询某个广告主最近几天的投放消耗与收入，按天和渠道拆分，并给出合计与 ROI。",
    "parameters": {
      "type": "object",
      "properties": {
        "adv_id": {"type": "integer", "description": "广告主 ID，例如 847"},
        "days": {"type": "integer", "description": "查询最近多少天，默认 3"}
      },
      "required": ["adv_id"]
    }
  }
}
```

把它放进请求体，问一句「847 最近三天投放怎么样？」，模型不会直接回答，而是把它想调的工具和参数交出来：

```text
content    = "I'll pull the report for advertiser 847. "
tool_calls = [
  {
    "function": {
      "arguments": "{\"adv_id\": 847, \"days\": 3}",
      "name": "query_ad_report"
    },
    "id": "call_00_tgd0zcboxaipy1ohpcm5jemf",
    "type": "function"
  }
]
用量       = prompt 350 / completion 91（其中思考 24）
```

三件事值得记住：

1. **参数是模型从自然语言里翻译出来的**——用户说的是「最近三天」，它填的是 `days: 3`；
2. **`arguments` 是一段 JSON 字符串**，不是对象，所以要 `json.loads()` 才能用；
3. **`content` 里也可能有字**（那句英文旁白）。只要 `tool_calls` 非空，就说明它还没给最终答案——它在等你执行。

> 那句 `content` 这次是英文的。模型在准备调工具时的「旁白」用哪种语言并不稳定，别把它当输出用。

## 二、写第一个工具

### 先选一个真需求

选它的理由：查数据库是工具最常见的形态，而且它自带三种真实失败——**参数不对、数据不存在、结果太大**。后面三章全靠它演示。

用 Python 标准库的 `sqlite3` 建一张投放表，三天三个广告主两个渠道：

```python
import sqlite3

def build_db(path, rows):
    con = sqlite3.connect(path)
    con.execute("""CREATE TABLE ad_report (
        dt TEXT, adv_id INTEGER, channel TEXT,
        spend REAL, revenue REAL, conversions INTEGER)""")
    con.executemany("INSERT INTO ad_report VALUES (?,?,?,?,?,?)", rows)
    con.commit()
    con.close()
```

（演示里除了 15 行硬编码的三天数据，还用一段循环给 847 号广告主造了 57 天历史——这样第三章那张「最近 60 天」的对比表才是真数据，不是编的。）

### 工具本身

```python
def query_ad_report(adv_id: int, days: int = 3) -> dict:
    """查某个广告主最近 N 天的投放数据（按天 × 渠道）。

    查不到该广告主时抛 ValueError —— 让失败可见，而不是返回空表。
    """
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        exists = con.execute(
            "SELECT COUNT(*) FROM ad_report WHERE adv_id = ?", (adv_id,)
        ).fetchone()[0]
        if not exists:
            raise ValueError(f"ad_report 里没有 adv_id={adv_id} 的数据")

        rows = con.execute(
            """SELECT dt, channel, SUM(spend) AS spend, SUM(revenue) AS revenue,
                      SUM(conversions) AS conversions
               FROM ad_report WHERE adv_id = ?
               GROUP BY dt, channel ORDER BY dt, channel""",
            (adv_id,),
        ).fetchall()
    finally:
        con.close()
    days_sorted = sorted({r["dt"] for r in rows})[-days:]
    out = []
    for r in rows:
        if r["dt"] not in days_sorted:
            continue
        out.append({
            "dt": r["dt"], "channel": r["channel"],
            "spend": r["spend"], "revenue": r["revenue"],
            "conversions": r["conversions"],
            "roi": round(r["revenue"] / r["spend"], 2) if r["spend"] else None,
        })
    t_spend = sum(r["spend"] for r in out)
    t_rev = sum(r["revenue"] for r in out)
    return {
        "adv_id": adv_id,
        "days": len(days_sorted),
        "rows": out,
        "totals": {
            "spend": t_spend, "revenue": t_rev,
            "roi": round(t_rev / t_spend, 2) if t_spend else None,
            "conversions": sum(r["conversions"] for r in out),
        },
    }
```

直接调用它（不经过模型），结果是这样：

```text
-- 正常：adv_id=847，最近 3 天 --
{
  "adv_id": 847,
  "days": 3,
  "rows": [
    {"dt": "2026-10-25", "channel": "Facebook", "spend": 1200.0, "revenue": 1104.0, "conversions": 24, "roi": 0.92},
    {"dt": "2026-10-25", "channel": "Google",   "spend": 800.0,  "revenue": 920.0,  "conversions": 20, "roi": 1.15},
    {"dt": "2026-10-26", "channel": "Facebook", "spend": 1350.0, "revenue": 1080.0, "conversions": 22, "roi": 0.8},
    {"dt": "2026-10-26", "channel": "Google",   "spend": 750.0,  "revenue": 900.0,  "conversions": 19, "roi": 1.2},
    {"dt": "2026-10-27", "channel": "Facebook", "spend": 1400.0, "revenue": 980.0,  "conversions": 18, "roi": 0.7},
    {"dt": "2026-10-27", "channel": "Google",   "spend": 700.0,  "revenue": 880.0,  "conversions": 18, "roi": 1.26}
  ],
  "totals": {"spend": 6200.0, "revenue": 5864.0, "roi": 0.95, "conversions": 121}
}

-- 失败：adv_id=999（表里没有）--
抛异常: ad_report 里没有 adv_id=999 的数据
```

（上面 `rows` 为了排版每行折成了单行，实际是标准缩进 JSON。）

### 参数为什么这么设计

留意两个选择：

| 选择 | 为什么 |
|---|---|
| 参数是 `days: 3`（整数），不是 `date: "昨天"` | **相对时间不能交给工具**。工具收到「昨天」还得自己算今天，算错就是静默错误。让模型把「最近三天」翻译成 `3`，把时间语义收在工具内部 |
| `adv_id` 是 `integer` 且示例写「例如 847」 | 类型和样例都写进 schema，模型填错的概率就低一截 |

第 1 条尤其重要。基础篇讲过「『昨天』是相对时间，需要转换成具体日期」——**在哪转换**是有讲究的：放在工具里，工具能自己判断；写在参数里，就得指望模型每次都算对。

## 三、工具设计的三条规则

### 规则一：一个工具做一件事

这条听起来像废话，但它有个非常具体的检测方法：**把三个工具的描述写成一样，看模型怎么办。**

我故意建了三个「描述一字不差」的工具，只有粒度不同：

```text
描述（三个都是）: 获取广告主的投放数据
名字: ['query_ad_report', 'get_ad_data', 'fetch_campaign_report']
```

实测三次：

```text
第 1 次：模型选了 ['query_ad_report']
第 2 次：模型选了 ['query_ad_report']
第 3 次：模型选了 ['query_ad_report', 'get_ad_data', 'fetch_campaign_report']
```

完整跑一遍那次，它**三个全调了**：

```text
步骤1: query_ad_report({"adv_id": 847})      -> days=3 的按天数据
步骤1: get_ad_data({"adv_id": 847})          -> days=1 的按天数据
步骤1: fetch_campaign_report({"adv_id": 847}) -> 只有渠道汇总，没有天
```

它拿到三份**粒度互相矛盾**的数据（三天 / 一天 / 没有天维度），然后自己拼出了一个正确答案。

这次是运气好。**描述分不出来时，模型不是在「选错」，而是在「全都要」**——调用次数翻倍，数据互相打架，能不能合对全看它当天的推理。

### 规则二：输入输出要有明确契约

契约就是「别人不用读你的实现，也能知道怎么用」。三样东西缺一不可：

| 要素 | 写清楚 | 写含糊 |
|---|---|---|
| 名字 | `query_ad_report` | `get_data` |
| 描述 | 「按天和渠道拆分，并给出合计与 ROI」 | 「获取数据」 |
| 参数 | `integer` + 示例 + 哪个必填 | 只写个名字 |

第一章那份 schema 生效的证据就在那条 `arguments` 上——`{"adv_id": 847, "days": 3}`，类型、示例、默认值全对上了。

### 规则三：失败要显式

这是本篇最重要的一条。同一个问题「999 这个广告主最近三天投放怎么样？」，只改工具的行为，模型的回答完全变样。

**A：查不到就返回空表（静默）**

```text
步骤1: query_ad_report({"adv_id": 999}) -> {"rows": [], "totals": {"spend": 0, "revenue": 0, "roi": null, ...}}
```

模型回答（节选）：

```text
我查了广告主 999 最近 3 天的投放数据，结果如下：
| 消耗 | 0 |   收入 | 0 |   转化 | 0 |   ROI | —（无数据，无法计算）|
也就是说，最近 3 天该广告主没有任何投放数据。
可能的原因包括：1. ID 有误；2. 账户近 3 天确实没跑量；3. 数据延迟或未回传；…
```

**B：查不到就显式报错**

```text
步骤1: query_ad_report({"adv_id": 999}) -> {"error": "ad_report 里没有 adv_id=999 的数据"}
```

模型回答（节选）：

```text
我查了 adv_id=999 最近三天的投放数据，但系统里没有这个广告主的记录：
ad_report 里没有 adv_id=999 的数据
可能的原因：广告主 ID 记错了或位数不对；该广告主尚未产生投放数据；…
```

差别在哪？A 的回答**是在陈述一个可能为假的结论**——「该广告主最近 3 天没有任何投放数据」。真实情况是**这个 ID 根本不存在**。空数组把「查不到」伪装成了「查到了，只是没有」。

B 则老老实实报告了查询失败。

> 坑：工具返回「空结果」时，模型容易当成「没有这个数据」，而真相可能是**查询失败了**。
> 这两件事在业务上完全不同——一个是「这个广告主没投」，一个是「我连它是谁都不知道」。

### 附带一条：返回值要收敛

工具返回多少，直接决定后面每一轮的 token。同一句话「847 最近 60 天的投放数据给我看看」，我做了三档：

| 方案 | 回传字符 | 下一轮 prompt_tokens |
|---|---|---|
| A 原始明细全量（每天每渠道一行） | 13544 | 6421 |
| B 按天 × 渠道聚合 | 13418 | **6734** |
| C 只给决策要的数（合计 + 渠道汇总 + 最差 3 天） | 409 | **641** |

B 那一行值得盯住：**字符数少了 1%，token 反而多了 5%。**

这就是「我以为我聚合了」的典型——按天×渠道分组，行数几乎没变，只是换了个排法。真正省下来的是 C：**只返回模型做判断需要的那几个数**（字符 −97%，token −90%）。

顺带一个结论：**别拿字符数估 token**。这两档的字符和 token 是反向走的。

## 四、工具太多怎么办

先看成本的硬数字。同一句话，只改工具数量：

```text
只给 1 个工具       prompt_tokens=350   模型选了 = ['query_ad_report']
一次给 12 个工具    prompt_tokens=977   模型选了 = ['query_ad_report']
```

**多出来的 627 个 token，是每一次模型调用都要付的。** 在 01 篇那个循环里，一个任务跑 5 步，就是 5 倍。而且这一条跟你问什么无关——工具表是每轮都发的。

选错这件事，我这次**没有测出来**：12 个工具摆上去，模型仍然选对了 `query_ad_report`。原因是那 12 个的描述之间还有可区分的信息。

真正会翻车的是第三章那个实验——**描述之间没有任何可区分信息时，它会把三个全调一遍**。所以工具多的风险不在「多」，在「像」：

| 症状 | 真正的原因 |
|---|---|
| 模型选的工具不是你想要的 | 两个工具的描述指向同一个语义 |
| 模型一次调好几个 | 它分不出来，干脆都试试 |
| 参数总填错 | 描述里没写类型和示例 |

三种应对，按侵入性从小到大：

1. **先改描述**（最省事）：让每个工具的描述里带上「什么时候用我、什么时候别用我」。上面那个实验里，12 个工具之所以没选错，靠的就是这一点。
2. **分组**：按业务域拆成几组，一次只暴露当前任务相关的那一组。
3. **分层**：先让模型选「类别」，再给那一类的工具——两次调用，但每次的工具表都很小。

第 2、3 种做法都会牺牲「模型自主发现工具」的能力，用之前先算一下账：**省下的 token 值不值这次任务的灵活性**。

## 五、MCP：把工具的暴露方式标准化

前三章你写的工具长这样：

```python
TOOLS = [...]                          # 声明
TOOL_IMPL = {"query_ad_report": ...}   # 实现
```

这两样东西都**粘在你的程序里**。同事想让 Cursor 用同一个工具，得把你的 Python 抄过去；你想让 Claude Code 用，再抄一遍。

MCP（Model Context Protocol）做的事就一句话：**把「提供工具」这件事变成一个协议**，工具放服务端，客户端用统一方式问它要。

```text
Agent -> MCP Client -> MCP Server -> 工具/数据源
```

和基础篇的比喻一致：MCP 是 Agent 世界的 USB-C。这一篇要做的，就是把你刚写的那个工具插上这个口。

## 六、动手：写一个最小 MCP Server

### 先认清协议：三个请求 + 一次通知

MCP 听起来很大，但「暴露工具」这条链路只有四条消息——**三个请求会得到应答，一次通知不会**：

| 消息 | 谁发 | 干什么 | 要不要应答 |
|---|---|---|---|
| `initialize` | 客户端 | 握手：报协议版本、交换能力 | 要 |
| `notifications/initialized` | 客户端 | 通知服务端「我准备好了」 | **不要** |
| `tools/list` | 客户端 | 问你有哪些工具 | 要 |
| `tools/call` | 客户端 | 调用某个工具 | 要 |

传输用 **stdio**：换行分隔的 JSON-RPC 2.0，**一行一条消息**。

两条硬规矩，违反任何一条客户端都会挂：

1. **stdout 只能出现协议消息**。日志、`print` 调试、警告——一律走 stderr。stdout 混进一行非协议文本，客户端就在那里解析失败。
2. **通知（没有 `id`）不应答**——就是表里那行「不要」。给它回包同样是协议错误。

### 服务端

完整代码不长，用标准库就够，**不需要任何模型 Key**：

```python
import json, sys
from ad_tool import TOOL_IMPL, TOOLS, build_db

PROTOCOL_VERSION = "2025-06-18"
SERVER_INFO = {"name": "ad-report-server", "title": "广告投放报表 MCP Server", "version": "0.1.0"}

def log(*a):
    print(*a, file=sys.stderr, flush=True)        # 诊断只走 stderr

def send(msg):
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def reply(req_id, result):
    send({"jsonrpc": "2.0", "id": req_id, "result": result})

def fail(req_id, code, message):
    send({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}})

def handle(req):
    method, req_id = req.get("method"), req.get("id")

    if method == "initialize":
        want = (req.get("params") or {}).get("protocolVersion")
        reply(req_id, {
            # 版本协商：是我们支持的就回声，否则报我们自己支持的那个
            "protocolVersion": want if want == PROTOCOL_VERSION else PROTOCOL_VERSION,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": SERVER_INFO,
        })

    elif method == "notifications/initialized":
        log("[server] 客户端就绪，开始正常通信")     # 通知：只记日志，不回包

    elif method == "tools/list":
        reply(req_id, {"tools": [
            {"name": t["function"]["name"],
             "description": t["function"]["description"],
             "inputSchema": t["function"]["parameters"]}
            for t in TOOLS
        ]})

    elif method == "tools/call":
        params = req.get("params") or {}
        name, args = params.get("name"), params.get("arguments") or {}
        fn = TOOL_IMPL.get(name)
        if fn is None:
            fail(req_id, -32602, f"未知工具：{name}")     # 协议级错误
            return
        try:
            out = fn(**args)
        except Exception as e:
            log(f"[server] {name} 执行失败：{e}")
            reply(req_id, {"content": [{"type": "text", "text": f"{type(e).__name__}: {e}"}],
                           "isError": True})              # 工具执行错误：仍是成功应答
            return
        reply(req_id, {"content": [{"type": "text", "text": json.dumps(out, ensure_ascii=False)}],
                       "isError": False})

    elif req_id is not None:
        fail(req_id, -32601, f"未实现的方法：{method}")

def main():
    build_db()
    log(f"[server] 已启动（{SERVER_INFO['name']}），等待客户端…")
    for line in sys.stdin:                 # 换行分隔：一行一条消息
        line = line.strip()
        if not line:
            continue
        try:
            handle(json.loads(line))
        except json.JSONDecodeError as e:
            fail(None, -32700, f"JSON 解析失败：{e}")
    log("[server] 客户端关闭了输入，退出")


if __name__ == "__main__":
    main()
```

有两处设计值得单独说，因为它们正是第三章那三条规则在协议层的对应物：

- **`isError: True` vs JSON-RPC error**：工具**执行失败**（查不到数据、接口挂了）走 `isError: True`，仍然是一次正常应答；**协议级错误**（调了不存在的工具、参数解析不了）才走 JSON-RPC `error`，带 `-32602` 这类标准码。搞混了，客户端要么把业务失败当协议崩溃，要么反过来。
- **定义在 `inputSchema` 里**：注意 MCP 用的字段名是 `inputSchema`，不是 OpenAI 那套 `parameters`。这就是要写一层转换的原因。

## 七、跑起来

### 协议级自测：先别接客户端

「可被任何支持 MCP 的客户端接入」这句话，最容易的验证方式反而是**不接任何客户端**——自己起一个测试客户端，把往返报文打出来。

```text
=== ① 握手 ===
-->  {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "ad-report-test-client", "version": "0.1.0"}}}
<--  {"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": "2025-06-18", "capabilities": {"tools": {"listChanged": false}}, "serverInfo": {"name": "ad-report-server", "title": "广告投放报表 MCP Server", "version": "0.1.0"}}}

-->  {"jsonrpc": "2.0", "method": "notifications/initialized"}
<--  （通知，不应答）

=== ② 发现工具 ===
-->  {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}
<--  {"jsonrpc": "2.0", "id": 2, "result": {"tools": [{"name": "query_ad_report", "description": "查询某个广告主最近几天的投放消耗与收入，按天和渠道拆分，并给出合计与 ROI。", "inputSchema": {…}}]}}

=== ③ 正常调用 ===
-->  {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "query_ad_report", "arguments": {"adv_id": 847, "days": 3}}}
<--  {"jsonrpc": "2.0", "id": 3, "result": {"content": [{"type": "text", "text": "{\"adv_id\": 847, \"days\": 3, \"rows\": […], \"totals\": {\"spend\": 6200.0, \"revenue\": 5864.0, \"roi\": 0.95, \"conversions\": 121}}"}], "isError": false}}
```

**故意让它失败两次**，两种失败长得不一样：

```text
=== ④ 工具执行失败：查一个不存在的广告主 ===
-->  {"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "query_ad_report", "arguments": {"adv_id": 999}}}
<--  {"jsonrpc": "2.0", "id": 4, "result": {"content": [{"type": "text", "text": "ValueError: ad_report 里没有 adv_id=999 的数据"}], "isError": true}}

=== ⑤ 协议级错误：调一个不存在的工具 ===
-->  {"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": {"name": "no_such_tool", "arguments": {}}}
<--  {"jsonrpc": "2.0", "id": 5, "error": {"code": -32602, "message": "未知工具：no_such_tool"}}
```

④ 是 `result` + `isError: true`，⑤ 是 `error` + `-32602`。**一个是业务失败，一个是协议失败**，客户端该走的代码路径完全不同。

最后关掉输入流，看服务端是否干净退出：

```text
=== ⑥ 关闭输入流 ===
server stderr（诊断信息都在这，不在 stdout）:
[server] 已启动（ad-report-server 0.1.0），等待客户端…
[server] 客户端就绪，开始正常通信
[server] query_ad_report 执行失败：ad_report 里没有 adv_id=999 的数据
[server] 客户端关闭了输入，退出

server 退出码: 0
```

### 让 Agent 从 MCP 拿工具

这才是这一篇的重点。下面这段是**完整的、存成 .py 就能跑的**代码——它自带两样东西：和 01 篇一样的 `chat()`，以及一个最小的 MCP 客户端。

重点看最后那段 Agent：它**完全不认识 `query_ad_report`**，工具是运行时问出来的。

```python
import json, os, subprocess, urllib.request

API_KEY = os.environ["OPENAI_API_KEY"]
BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.deepseek.com/v1")
MODEL = os.environ.get("MODEL", "deepseek-chat")


def chat(messages, tools=None):
    """与 01 篇完全一样：发一次请求，拿回一个字典。"""
    body = {"model": MODEL, "messages": messages, "stream": False}
    if tools:
        body["tools"] = tools
    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


class McpClient:
    """最小 MCP 客户端：起一个子进程，按 id 一问一答。"""

    def __init__(self, command=("python3", "mcp_server.py")):
        self.p = subprocess.Popen(
            list(command),
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, bufsize=1,                  # 行缓冲：一行一条消息
        )
        self._id = 0
        self.call("initialize", {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "agent", "version": "0.1.0"},
        })
        self.notify("notifications/initialized")    # 握手第二步：通知，不等应答

    def call(self, method, params=None):
        """发一条请求，等一条应答。"""
        self._id += 1
        req = {"jsonrpc": "2.0", "id": self._id, "method": method}
        if params is not None:
            req["params"] = params
        self.p.stdin.write(json.dumps(req) + "\n")
        self.p.stdin.flush()
        return json.loads(self.p.stdout.readline())

    def notify(self, method, params=None):
        """发一条通知——没有 id，所以不等应答。"""
        msg = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        self.p.stdin.write(json.dumps(msg) + "\n")
        self.p.stdin.flush()

    def list_tools(self):
        return self.call("tools/list")["result"]["tools"]

    def call_tool(self, name, arguments):
        result = self.call("tools/call", {"name": name, "arguments": arguments})["result"]
        text = result["content"][0]["text"]
        if result.get("isError"):        # 工具失败：抛出去，由 Agent 决定怎么回传
            raise RuntimeError(text)
        return json.loads(text)

    def close(self):
        self.p.stdin.close()              # 关掉 stdin 就是告诉服务端「结束」
        self.p.wait(timeout=10)


# ---------------- Agent：工具是运行时问出来的 ----------------

mcp = McpClient()

TOOLS = [{"type": "function", "function": {
    "name": t["name"],
    "description": t["description"],
    "parameters": t["inputSchema"],      # 注意字段改名：MCP 叫 inputSchema
}} for t in mcp.list_tools()]

print("运行时从 MCP 拿到的工具：", [t["function"]["name"] for t in TOOLS])


def run_agent(question, max_steps=8):
    msgs = [{"role": "user", "content": question}]

    for step in range(1, max_steps + 1):
        msg = chat(msgs, TOOLS)["choices"][0]["message"]
        msgs.append(msg)

        tool_calls = msg.get("tool_calls") or []
        if not tool_calls:                           # 退出条件①：模型不再要工具
            return msg.get("content") or ""

        for tc in tool_calls:
            name = tc["function"]["name"]
            args = json.loads(tc["function"]["arguments"])
            try:
                out = json.dumps(mcp.call_tool(name, args), ensure_ascii=False)
            except Exception as e:
                out = json.dumps({"error": str(e)}, ensure_ascii=False)
            print(f"  步骤{step}: 经 MCP 调用 {name}({json.dumps(args, ensure_ascii=False)})")
            msgs.append({"role": "tool", "tool_call_id": tc["id"], "content": out})

    return f"[已达步数上限 {max_steps}，任务未完成]"      # 退出条件②：兜底


print(run_agent("847 最近三天投放怎么样？"))
mcp.close()
```

三处要留意：

1. **`McpClient` 只是「换了个写法的 HTTP 客户端」**——`call()` 发一条、读一行，`notify()` 发一条、不读。整个类和业务完全无关，换任何 MCP Server 都适用。
2. **`raise RuntimeError(text)`**——工具失败时在客户端就抛出去，交给 Agent 循环里那个 `except` 转成 `{"error": ...}` 回传给模型。这是第三章「失败要显式」在客户端的延续。
3. **`mcp.close()`**——关掉子进程的 stdin，服务端那个 `for line in sys.stdin` 循环自然结束。不关的话子进程会一直挂着。

跑起来：

```text
运行时从 MCP 拿到的工具： ['query_ad_report']
  步骤1: 经 MCP 调用 query_ad_report({"adv_id": 847, "days": 3})
## 广告主 847 最近三天投放概览（2026-10-25 ~ 10-27）

**整体：花 6200 美元，收入 5864 美元，ROI 0.95，转化 121 次** —— 整体是微亏状态（每花 1 美元回 0.95 美元）。

### 按天看：趋势在恶化

| 日期 | 消耗 | 收入 | ROI | 转化 |
|---|---|---|---|---|
| 10-25 | 2000 | 2024 | 1.01 | 44 |
| 10-26 | 2100 | 1980 | 0.94 | 41 |
| 10-27 | 2100 | 1860 | 0.89 | 36 |

消耗在往上加，收入和转化却在往下掉，三天 ROI 从 1.01 一路跌到 0.89。

### 按渠道看：Facebook 拖后腿，Google 表现好

| 渠道 | 消耗 | 收入 | ROI |
|---|---|---|---|
| Facebook | 3950 | 3164 | **0.80** |
| Google | 2250 | 2700 | **1.20** |

随后是三条投放建议（砍 Facebook 预算、向 Google 倾斜、设止损线），与本段要点无关，这里略去。
```

（上面是一次真实运行的原样输出。模型每次回答的措辞都不一样——你跑出来的会是另一种说法，但只要 `步骤1` 那行和数字对得上，就说明链路是通的。）

对照第七章前半段——同样的工具、同样的循环、同样的回答。差别只有一个：**工具不再写死在你的代码里**。

这就是 MCP 的实际收益：

| | 直接函数工具 | 走 MCP |
|---|---|---|
| 加工具的代价 | 改 `TOOLS` + 改 `TOOL_IMPL`，重新部署 | 服务端自己改，客户端不动 |
| 换客户端 | 抄一遍代码 | 换一个配置 |
| 工具和模型的边界 | 粘在一个进程里 | 两个进程，可以分别升级 |

代价也要说清：**多了一个进程边界和一层 JSON-RPC 封装**。单次调用比直接函数调用慢，这是实打实的开销——所以工具少、场景固定的程序，未必需要上 MCP。

## 八、常见坑

**① 参数类型不匹配——但报的往往不是类型错**

我原本以为「模型给字符串、工具要数字」会直接炸。实测**没有**：

```text
adv_id="847"  -> {'spend': 2100.0, 'revenue': 1860.0, 'roi': 0.89, 'conversions': 36}
WHERE adv_id = 847    -> 命中 120 行
WHERE adv_id = '847'  -> 命中 120 行
```

SQLite 按列的类型把字符串**静默转成了整数**。真正的坑在这儿：

```text
adv_id='abc'  -> ValueError: ad_report 里没有 adv_id=abc 的数据
adv_id=None   -> ValueError: ad_report 里没有 adv_id=None 的数据
```

**报的是「数据不存在」，真因是「参数类型不对」。** 失败是可见了，但报的是错的原因——模型会据此去查 ID 是不是写错了，而真正该改的是它自己填参数的方式。

对策是第三章规则二：把类型和示例写进 schema，让模型一开始就填对；工具内部再显式校验一次参数类型，别指望下游帮你拦。

**② 工具描述含糊**

见第三章那个实验：三个描述一模一样的工具，模型把三个全调了一遍。**描述不是给你看的，是给你和模型之间划边界的。**

**③ 返回内容过大**

见第三章最后那张三档表。要点不是「要聚合」，而是**要收敛到模型决策需要的粒度**——按天×渠道聚合这种「看起来聚合了」的做法，实测字符只降 1%。

**④ 权限边界缺失**

我这个小服务端没有任何权限检查：**谁能起它，谁就能查任何 `adv_id`。** 本地自用没问题，一旦挂到网络上，至少要三样东西：

| 缺的东西 | 后果 |
|---|---|
| 谁可以连（认证） | 任何人拿到地址都能调你的工具 |
| 你能查什么（授权） | 一个 `adv_id` 参数就能横向遍历全部数据 |
| 一次能要多少（限流 / 上限） | 一个 `days: 100000` 就能把库拖空 |

基础篇讲过工具分「查询类 / 修改类 / 支付类」，MCP 官方规范里也建议把 `readOnlyHint`、`destructiveHint` 这类注解带上。**注解只是提示，不是强制**——真正的边界要在服务端自己拦。

**⑤ 调试信息写进了 stdout**

这条最容易踩，而且症状很迷惑：客户端**卡住**或者报「JSON 解析失败」，你的服务端却一切正常。

原因就是那条硬规矩——stdio 上 stdout 是协议专用通道。一行 `print("正在查询…")` 混进去，客户端读到那一行就崩。

**所有诊断信息走 stderr**，并且在发布前加个测试：断言 stdout 上的每一行都能被 `json.loads` 解析。

## 九、下一步

到这里，工具这一环补齐了：能查真数据、失败可见、能跨客户端复用。留下的缺口是**跑不稳**。

回看这一篇的循环——它仍然只有 01 篇那两条退出条件：

```python
def run_agent(question):
    for step in range(1, MAX_STEPS + 1):
        ...
        if not tool_calls:
            return msg.get("content") or ""             # ① 模型不再要工具
    return f"[已达步数上限 {MAX_STEPS}，任务未完成]"     # ② 步数上限
```

三件事没解决：

- **工具挂了怎么办**——`urllib.request.urlopen(req, timeout=120)` 只有超时，没有重试、没有降级。数据库抖一下，整轮任务从头再来。
- **跑到一半进程崩了怎么办**——`msgs` 只在内存里，前面几步全白跑。
- **MCP 服务端拉不起来怎么办**——子进程起不来、握手超时，现在没有任何处理。

MCP 把工具挪到了进程外，这件事**同时**带来了复用和新的失败面：网络、进程、版本协商，每一层都能出问题。

**补在哪**：《Agent Runtime 实战》——状态机、超时重试、错误恢复、断点续跑。

:::info 与基础篇的关系
基础篇《Tool Calling 与 MCP》→ 讲**调用协议与生态**；本篇 → 讲**怎么写一个好用的工具、怎么发布**。
:::

:::note 关于文中的运行结果
本篇所有输出都是**实际运行结果**（模型用火山方舟的 `deepseek-v4-1-flash` 跑出）。
代码只用 Python 标准库（`sqlite3` / `json` / `urllib` / `subprocess`），不依赖任何第三方包——
MCP 那部分是手写的 stdio JSON-RPC，没有装官方 SDK。
:::
