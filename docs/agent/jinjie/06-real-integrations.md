---
title: 接真实工具：数据库 / API / 飞书
sidebar_position: 6
---

# 接真实工具：数据库 / API / 飞书

:::tip 先看结论
玩具工具和真实工具的差别只有一个字：**脏**。

这篇接三个真实的系统——本地数据库、公开 API、飞书。
难点一处都不在「怎么调」，全在**接了之后才发现**的那些事：只读闸门、脏数据的两种形态、限流、凭据。
:::

## 这篇解决什么问题

前面五篇的工具都是「造出来的」：`ad_report` 是我为了演示建的表，字段干净、类型规整、查询永远成功。

真实的系统不长这样。这一篇接**真实的东西**：一个有 129 行数据的库、一个真的会返回 404 的公开 API、一个真的需要 app_secret 才能进的企业平台。

**做完之后你会发现：调用是最简单的一步。**

## 一、接外部系统前，先问六个问题

这六个问题每一个都在本文里有对应的真实演示。

| # | 问题 | 为什么先问 |
|---|---|---|
| 1 | 凭据怎么放？ | **绝不能写进代码**——提交进 git 就是泄露 |
| 2 | 有没有速率限制？ | 有额度的接口，Agent 一高兴就能调掉一天的配额 |
| 3 | 失败时返回什么？ | 是超时、是 4xx、还是 200 但字段没了？**三种都要防** |
| 4 | 数据可能缺哪些字段？ | 缺了要报错，不能返回 `None` 让下游猜 |
| 5 | 这个操作可不可逆？ | 发消息、改数据、下单——不可逆的要有闸门 |
| 6 | 出错了谁负责？ | 自动重试还是人工介入？这是业务问题，不是技术问题 |

## 二、接数据库

### 只读优先：闸门要放在代码里，不是提示词里

**第一原则：先接查询，别急着给写权限。**

你把「不要删表」写进系统提示词是没用的——提示词是建议，模型可以不听。**闸门必须是代码。**

三道闸门，从外到内：

```python
FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|replace|truncate|grant|attach|vacuum)\b",
    re.IGNORECASE,
)


def guard(sql):
    """写操作一律拒绝——闸门放在你自己的代码里，不是放在提示词里。"""
    s = sql.strip()
    if not s.lower().startswith(("select", "with")):
        raise PermissionError(f"只允许查询语句，拒绝执行：{s[:60]}")
    hit = FORBIDDEN.search(s)
    if hit:
        raise PermissionError(f"语句里出现写操作关键字「{hit.group(0)}」，拒绝执行")
    return s


def run_sql(sql, max_rows=50):
    """只读查询：连接本身就是只读的，再加行数上限。"""
    sql = guard(sql)
    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)   # ← 只读方式打开
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute(sql).fetchmany(max_rows + 1)
    finally:
        con.close()
    truncated = len(rows) > max_rows          # 截断了就明说，不静默
    rows = rows[:max_rows]
    return {"rows": [dict(r) for r in rows], "returned": len(rows), "truncated": truncated}
```

三道闸门各挡一层：

| 闸门 | 挡什么 |
|---|---|
| `startswith(("select", "with"))` | 一眼就不是查询的语句 |
| 关键字黑名单 | **伪装成查询的写操作**（下一段会看到为什么需要它） |
| `mode=ro` 打开连接 | 前两道都漏了时的最后一道——**数据库自己拒写** |

### 跑一遍

```text
① 正常查询
  {'rows': [{'n': 129}], 'returned': 1, 'truncated': False}

② 试图删表
  PermissionError - 只允许查询语句，拒绝执行：DROP TABLE ad_report

③ 伪装成查询的写操作（用 WITH 开头绕过第一个检查）
  PermissionError - 语句里出现写操作关键字「DELETE」，拒绝执行

④ 结果集过大（全表 129 行，上限 50）
  返回 50 行，是否被截断 = True

⑤ 确认库还在（闸门确实拦住了）
  {'rows': [{'n': 129}], 'returned': 1, 'truncated': False}
```

**第 ③ 条是这一节的重点。** 如果只写第一道闸门（`startswith("select")`），下面这句能过去：

```sql
WITH x AS (SELECT 1) DELETE FROM ad_report
```

它**以 `with` 开头**，看着像查询，实际是删除。SQLite 支持这种写法。**这就是为什么闸门不能只判前缀**——也让「只给只读账号」这个建议有了分量：代码里的黑名单总会有漏的，权限不会。

**第 ④ 条是第二个重点。** 全表 129 行，上限 50：

- **不是静默截断**——`truncated: true` 明确告诉模型「你看到的不全」
- 不告诉它会怎样？它会基于 50 行得出「整体情况如何」的结论，**而它以为这是全部**

一句话总结这一节：**只读账号 + 代码闸门 + 行数上限，三样都要。**

## 三、接第三方 API

### 凭据：永远从环境变量来

```python
API_KEY = os.environ["OPENAI_API_KEY"]        # 中括号：取不到就报错
BASE_URL = os.environ.get("BASE_URL", "默认值")
```

**取不到直接报错，比默认成空字符串好。** 空字符串会带着一个没有鉴权的请求跑到对面，然后收到一个莫名其妙的 401——而报错当场就告诉你「你忘了配 Key」。

### 真实调用

用的是一个免费的货币汇率接口（无需 Key），真返回：

```text
① 真实调用（货币汇率，无需 Key）
  {'base': 'CNY', 'quote': 'USD', 'rate': 0.14998, 'as_of': '2026-10-27'}
  {'base': 'CNY', 'quote': 'JPY', 'rate': 23.67, 'as_of': '2026-10-27'}
```

### 脏数据有两种形态——这是这一节最值钱的一条

我第一版只防了一种，然后就被打脸了。

**形态一：接口直接拒绝（4xx）**

```python
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.load(r)
except urllib.error.HTTPError as e:
    # 接口拒绝服务时，正文里通常有它自己的说明——要读出来，别只报「404」
    body = e.read().decode(errors="replace")[:160]
    raise RuntimeError(f"接口返回 HTTP {e.code}：{body}") from e
```

要一个接口不支持的币种时：

```text
② 脏数据的第一种形态：接口直接拒绝（4xx）
  RuntimeError - 接口返回 HTTP 404：{"message":"not found"}
```

**注意我做了什么**：没让 404 裸奔，而是**把正文读出来一起报**。`{"message":"not found"}` 是接口自己说的，比光秃秃一个「404」有用得多。

**形态二：HTTP 200，但字段没了**

```python
def pick_rate(data, quote):
    """从响应里取汇率。字段缺失就报错——不返回 None 让下游猜。"""
    rate = (data.get("rates") or {}).get(quote)     # ← 层层判空，别直接链式取
    if rate is None:
        raise ValueError(f"接口没返回 {quote} 的汇率，原始响应：{json.dumps(data, ensure_ascii=False)[:160]}")
    return rate
```

```text
③ 脏数据的第二种形态：HTTP 200 但字段没了（用伪造响应体演示这道防线）
  ValueError - 接口没返回 USD 的汇率，原始响应：{"amount": 1.0, "base": "CNY", "date": "2026-10-27", "rates": {}}
```

**这一条为什么必须写成「报错」而不是「返回 None」？**

因为返回 `None` 的话，下游会拿它算出 `0`、或者让模型自己编一个数字。**一个缺失的汇率和一个真的等于 0 的汇率，在代码里长得一模一样。**

（第三条：`data["rates"][quote]` 这种链式取值——`rates` 缺了就 `KeyError`，`quote` 缺了就 `KeyError`，报错信息里没有上下文。`(data.get("rates") or {}).get(quote)` 至少能让你自己写一句看得懂的错。）

### 限流：把额度量化出来

```python
def probe_rate_limit():
    req = urllib.request.Request("https://api.github.com/repos/...",
                                 headers={"User-Agent": "agent-demo"})
    with urllib.request.urlopen(req, timeout=10) as r:
        h = r.headers
    return {"limit": h.get("x-ratelimit-limit"),
            "remaining": h.get("x-ratelimit-remaining"),
            "reset": h.get("x-ratelimit-reset")}
```

真实响应头：

```text
④ 限流：真实响应头（GitHub 未认证 = 60 次/小时）
  {'limit': '60', 'remaining': '57', 'reset': '1793171951'}
```

**60 次/小时。** 这个数字要跟前面几篇的循环放在一起看：

一个 Agent 任务跑 5 步、每步可能调 2 次工具——**十几次就没了**。你手动测两轮就见底。而按次计费的接口更直接：**每次调用都是钱**。

所以「限流处理」不只是「遇到 429 就退避」（第四篇讲过），更要**在调用之前就知道额度还剩多少**。响应头里既然给了 `remaining`，就该把它记下来、在快用完时提前收手。

## 四、接飞书（企业协作平台）

### 凭据只从配置来，且绝不打印

```python
def feishu_creds():
    cfg = json.loads(pathlib.Path("~/.thincoder/config.json").expanduser().read_text())
    f = cfg.get("feishu") or {}
    return f.get("appId"), f.get("appSecret")
```

### 鉴权是真的

```python
def feishu_token(app_id, app_secret):
    body = json.dumps({"app_id": app_id, "app_secret": app_secret}).encode()
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        data=body, headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        d = json.load(r)
    if d.get("code") != 0:
        raise RuntimeError(f"飞书鉴权失败 code={d.get('code')} msg={d.get('msg')}")
    return d["tenant_access_token"], d.get("expire")
```

跑出来：

```text
凭据来源：本机配置（app_id 前 6 位 cli_a7…，secret 长度 32）
① 鉴权成功：token 长度 42，2088 秒后过期
   （token 不打印，和 API Key 一个待遇）
```

**两个在读这段输出时会忽略的细节：**

- **报的是「长度 42」而不是 token 本身。** 你要给人看的是「有没有拿到」，不是「拿到了什么」。**日志里少一个密钥，就少一个泄露面。**
- **`2088 秒后过期`**——token 是会过期的。真实项目里要缓存它、在过期前刷新。每次调用都重新鉴权，既慢又快把鉴权接口的额度用光。

### 发送默认不发

```python
def send_message(token, chat_id, text, dry_run=True):
    """发送消息。**默认 dry_run**——不确认不发真实消息到群里。"""
    payload = {"receive_id": chat_id, "msg_type": "text",
               "content": json.dumps({"text": text}, ensure_ascii=False)}
    if dry_run:
        return {"dry_run": True, "would_post_to": "im/v1/messages?receive_id_type=chat_id",
                "payload": payload}
    ...
```

```text
② 发送消息（dry_run，不会真发）
  {"dry_run": true, "would_post_to": "im/v1/messages?receive_id_type=chat_id", "payload":
   {"receive_id": "oc_xxxxxxxx", "msg_type": "text",
    "content": "{\"text\": \"847 最近三天 ROI 0.95，需要关注。\"}"}}
  → 真发只要把 dry_run=False，但那条消息会进群，发之前想清楚
```

**`dry_run=True` 是默认值，不是选项。** 理由是这一节开头那第六个问题——**「这个操作可不可逆」**：发到群里的消息撤不回来，一百个人已经看到了。

默认值定成「不发」，想让 Agent 发的时候你**必须显式改一行**。这样「误发」的成本是从「全群都看到」降到「你在代码里多写一个参数」。

> 顺带：发消息这类**不可逆操作应该走人工确认**（基础篇讲的 Human-in-the-Loop）。`dry_run` 是开发期的防线；生产环境该加的是「发之前弹给人看一眼」。

## 五、统一：给所有外部工具加一层「防护」

三个系统接完，会发现它们的防护需求长得一样。抽成一层：

| 防护 | 数据库 | API | 飞书 |
|---|---|---|---|
| 凭据不落代码 | 连接串 | 环境变量 | 配置文件 |
| 只读 / 最小权限 | `mode=ro` + 闸门 | 用只读接口 | 只申请需要的权限 |
| 结果集上限 | `max_rows` + `truncated` | 分页 | 条数上限 |
| 超时 | 查询超时 | `timeout=` | `timeout=` |
| 重试分类 | — | 第四篇那套 | 第四篇那套 |
| 额度意识 | — | 读 `remaining` | 注意接口频控 |
| 调用日志 | 记 SQL | 记 URL + 状态码 | 记发给谁、发了什么 |
| 不可逆操作 | 闸门拦住 | — | `dry_run` + 人工确认 |

**最后一列「调用日志」值得单独说。** 出了问题你要能回答：**它调了什么、参数是什么、对面回了什么。** 没有这个，你面对的是一句「Agent 说查不到」，然后无从下手。

## 六、常见坑

**① 凭据硬编码**

写进 `.py` 的那一刻，只要这个文件进过 git，**历史里就永远有了**——删掉当前这行不管用，`git log` 里还能翻出来。做法只有一个：**环境变量或配置文件，且配置文件进 `.gitignore`。**

**② 权限给太大**

最省事的做法是给一个能读能写的账号。三个月后某次调试，Agent 顺手 `UPDATE` 了一下——**生产数据就变了**。先给只读，需要写再说。

**③ 只判前缀的 SQL 闸门**

`WITH x AS (SELECT 1) DELETE FROM ad_report` 能过去。**黑名单不是万无一失的**，真正兜底的是只读账号。

**④ 把「字段缺失」当成「值等于 0」**

返回 `None` 会让下游算出错误结果，而且**看不出来错**。缺失就报错。

**⑤ 静默截断**

查 129 行只返回 50 行、却不告诉调用方——模型会以为这就是全部。**截断必须显式**（本文的 `truncated` 字段）。

**⑥ 不可逆操作没有二次确认**

发消息、改数据、下单。**判断标准很简单：做错了能不能撤销？** 不能撤销的，默认值就该是「不做」。

## 七、下一步

到这里，你的 Agent 能接真实系统了。**但它干得好不好，你其实还不知道。**

前面六篇所有的「跑通了」，说的都是**这一次**跑通了。下次呢？改了提示词之后呢？换了个模型之后呢？

现在你的验证方式大概是：跑一遍，看一眼输出，觉得「还行」。**这就是「感觉还行」——它不是评价。**

更要命的是回归：你这次改好了 A，有没有弄坏 B？没有量化，你分不清「变好」和「运气好」。

**补在哪**：《评测你的 Agent》——写几个用例，让「这次改动到底有没有变好」变成一个能回答的问题。

:::info 与基础篇的关系
基础篇《企业级 Agent 架构》→ 讲**系统层面怎么设计**；本篇 → 讲**具体怎么接一个真实系统、接上之后要防什么**。
:::

:::note 关于文中的运行结果
本篇所有输出都是**实际运行结果**：
数据库是真实的 SQLite 库（129 行数据），汇率是真实的公开 API（无需 Key），
飞书那一段是**真实鉴权**（拿到了真的 `tenant_access_token`，只打印长度不打印内容）。
发送消息走的是 `dry_run`，**没有真的往任何群里发消息**。
代码只用 Python 标准库，不依赖任何第三方包。
:::
