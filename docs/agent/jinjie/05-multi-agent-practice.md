---
title: Multi-Agent 实战
sidebar_position: 5
---

# Multi-Agent 实战：三种编排各跑一遍

:::tip 先看结论
多智能体不是「越多越好」。**先问一件事：这个任务真的需要多个 Agent 吗？**

这篇把三种编排各写一遍、各跑一遍，然后拿**单 Agent 做同一件事**当基线对比。
跑完的结论很干脆：**只有「并行」这一种形态带来确定的收益（实测快 2.7 倍）；顺序和层级是拿成本换可控性，效果不一定更好。**
:::

## 这篇解决什么问题

基础篇《Multi-Agent 多智能体系统》讲的是**有哪几种架构**；
这一篇讲的是**三种编排各写一个 demo**，并对比它们的实际开销与收益。

上一篇《Agent Runtime 实战》结尾留的缺口是「它只有一个」——一个任务、一条 `msgs`、一个模型调用序列。这一篇补掉它，并且顺手回答一个更值钱的问题：**补完之后，到底值不值。**

## 一、先回答：真的需要多 Agent 吗

先看判断依据，再决定要不要往下读。

| 该拆 | 不该拆 |
|---|---|
| **职责差异大**：一个在查数据、一个在写文案，提示词根本不像同一件事 | **只是步骤多**：查 A、查 B、查 C 然后汇总——这是一个 Agent + 三个工具的事 |
| **要并行**：几个子任务互不依赖，可以同时跑 | **要串行**：B 必须等 A 的结果才能开始 |
| **要隔离上下文**：不想让 A 的长篇中间产物污染 B 的判断 | **上下文本来就小**：塞得下就没必要隔离 |

**最容易犯的错是把「步骤多」当成「需要多 Agent」。** 第四节的对比会给你看这个错有多贵。

## 二、三种编排形态

| 形态 | 结构 | 适合 |
|---|---|---|
| 顺序 | A 做完交 B，B 做完交 C | 流水线任务（写 → 审 → 改） |
| 并行 | 多个 Agent 同时干，最后汇总 | 可独立拆分的子任务 |
| 层级 | 一个主管 Agent 分配、汇总 | 任务复杂且需要动态分工 |

## 三、先写一个能复用的最小 Agent

三种编排都用同一个 `agent()`，区别只在**怎么把它们串起来**。

```python
USAGE = {"prompt": 0, "completion": 0, "calls": 0}


def chat(messages, tools=None):
    body = {"model": MODEL, "messages": messages, "stream": False}
    if tools:
        body["tools"] = tools
    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.load(r)
    u = resp.get("usage") or {}
    USAGE["prompt"] += u.get("prompt_tokens", 0)
    USAGE["completion"] += u.get("completion_tokens", 0)
    USAGE["calls"] += 1
    return resp


def agent(system, question, tools=None, impl=None, max_steps=4, label=""):
    """一个最小 Agent：给系统提示 + 问题，自己决定要不要调工具。"""
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": question}]
    used = []
    for _ in range(max_steps):
        msg = chat(msgs, tools)["choices"][0]["message"]
        msgs.append(msg)
        tcs = msg.get("tool_calls") or []
        if not tcs:
            text = msg.get("content") or ""
            if label:
                print(f"    [{label}] 调用工具 {len(used)} 次，输出 {len(text)} 字")
            return text, used
        for tc in tcs:
            name = tc["function"]["name"]
            args = json.loads(tc["function"]["arguments"])
            used.append(name)
            try:
                out = json.dumps(impl[name](**args), ensure_ascii=False)
            except Exception as e:
                out = json.dumps({"error": str(e)}, ensure_ascii=False)
            msgs.append({"role": "tool", "tool_call_id": tc["id"], "content": out})
    return "[步数上限]", used
```

把它和一个入口拼起来就能跑（工具层复用第三篇的 `ad_tool`）：

```python
import json
import os
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from ad_tool import TOOL_IMPL, TOOLS, build_db

API_KEY = os.environ["OPENAI_API_KEY"]
BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.deepseek.com/v1")
MODEL = os.environ.get("MODEL", "deepseek-chat")

# ……上面那两个函数（chat / agent）……

if __name__ == "__main__":
    build_db()
    for fn in (run_sequential, run_parallel, run_hierarchical):
        print(f"\n═══ {fn.__name__} ═══")
        fn()
```

两处和前面几篇不一样：

- **`system` 消息**——多 Agent 里每个角色的差异主要靠它：同一个问题，换个 system 提示就是一个不同的「人」。
- **`USAGE` 累加**——后面所有成本对比都靠这三个计数器。**没有这个，多 Agent 的好坏就只能靠感觉。**

## 四、顺序编排：调研 → 写作 → 校对

**场景**：让三个 Agent 接力完成一份投放简报。每个 Agent 只拿到上游的产出，看不到别人的对话。

```python
def run_sequential():
    q = "847 最近三天投放怎么样？"

    facts, _ = agent("你是数据分析师。只输出关键事实和数字，不要写建议，不要写客套话。",
                     q, TOOLS, TOOL_IMPL, label="① 调研")
    draft, _ = agent("你是投放运营。基于给定事实，写一段给老板看的结论（不超过 120 字）。",
                     facts, label="② 写作")
    checked, _ = agent("你是校对。逐条核对草稿里的数字与事实是否一致，只指出不一致的地方；"
                       "全部一致就只回四个字：核对无误。",
                       f"【事实】\n{facts}\n\n【草稿】\n{draft}", label="③ 校对")
    return facts, draft, checked
```

**关键设计在「中间结果怎么传」**：这里传的是**上一个 Agent 的完整输出**。如果把原始对话历史也传下去（每个 Agent 都带全量 `msgs`），token 会成倍涨——第七节会细说。

跑出来是这样：

```text
    [① 调研] 调用工具 1 次，输出 763 字
    [② 写作] 调用工具 0 次，输出 118 字
    [③ 校对] 调用工具 0 次，输出 4 字
```

三个阶段的实际产出：

```text
① 调研（前 200 字）：
**847 · 2026-10-25 至 10-27 合计**
- 消耗 6200，收入 5864，ROI 0.95，转化 121
**按天**
| 日期 | 消耗 | 收入 | ROI | 转化 |
| 10-25 | 2000 | 2024 | 1.01 | 44 |
...

② 写作：
合计ROI 0.95，未回本；10-27降至0.89，趋势恶化。Facebook占消耗63.7%，
消耗增16.7%但ROI 0.92→0.70，是主要拖累；Google ROI升至1.26。
建议压Facebook预算，加投Google。

③ 校对：
核对无误
```

**注意三个 Agent 的分工是真的不同**：① 只准出事实、不许写建议；② 只准写结论、不许再调工具；③ 只负责核对数字。**提示词相互排斥**，这才是「职责隔离」，而不是把同一件事说三遍。

这一轮的总开销：

```text
── 顺序编排：模型调用 4 次，token 5347（输入 2234 + 输出 3113），墙钟 34.1s
```

## 五、并行编排：同时查 3 个广告主

**场景**：三个广告主的数据互不依赖，同时查。

```python
def run_parallel():
    ids = [847, 1523, 3390]

    def one(i):
        return agent("你是数据分析师。只给关键数字，一两句话说完。",
                     f"{i} 最近三天投放怎么样？", TOOLS, TOOL_IMPL)

    t0 = time.time()
    serial = [one(i) for i in ids]              # 串行：一个一个来
    t_serial = time.time() - t0

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=3) as ex:
        parallel = list(ex.map(one, ids))       # 并行：三个同时发
    t_par = time.time() - t0
```

**实现上什么特别的东西都没有**——就是 Python 的线程池。因为瓶颈是等模型返回（I/O 等待），不是 CPU 计算，所以线程池完全够用，不需要 asyncio 或多进程。

跑出来：

```text
  串行：21.1s   token 3950
  并行：7.7s   token 3916
  提速：2.7 倍（token 基本不变）
```

**这是三种编排里唯一一个「收益确定」的**：等你三个回合同样多的时间，只花了一份。**token 几乎没变（3950 → 3916），因为该发的请求一个没少，只是同时发了。**

**一个失败怎么办？** 并行的麻烦也在这里：三个里挂一个，你要决定是「整体失败」还是「用两个的结果继续」。这取决于业务——查询类通常可以用两个继续，写入类则必须整体回滚。

（本节为了对比清楚，代码里省掉了错误处理。真实项目里每个 `one(i)` 都要包上第四篇那套重试与分类。）

## 六、层级编排：主管拆活，下属分头查

**场景**：一个主管 Agent 自己决定要查谁、然后汇总下属汇报。

```python
def run_hierarchical():
    plan, _ = agent(
        "你是主管。可用的广告主 ID 只有 847、1523、3390。"
        "用户想知道整体投放情况。你要决定派下属去查哪几个。只输出 ID，一行一个，不要解释。",
        "看一下这几个广告主最近三天谁最需要关注")
    ids = [int(x) for x in re.findall(r"\d+", plan) if int(x) in (847, 1523, 3390)]
    ids = sorted(set(ids)) or [847, 1523, 3390]

    reports = []
    for i in ids:
        r, _ = agent("你是数据分析师。用三句话汇报：消耗多少、ROI 多少、有没有异常。",
                     f"{i} 最近三天投放情况", TOOLS, TOOL_IMPL)
        reports.append(f"【{i} 的汇报】\n{r}")

    final, _ = agent("你是主管。汇总下属汇报，输出：整体结论一句话 + 最该关注哪个广告主及理由。",
                     "\n\n".join(reports))
    return ids, reports, final
```

**主管的这一句提示词是整段的关键**——它被限制了可选范围（只有三个 ID），否则主管可能编出一个不存在的 ID 派下去，下属再报一堆「查不到」。

跑出来：

```text
  主管决定查：[847, 1523, 3390]
    下属 847 汇报完成（271 字）
    下属 1523 汇报完成（282 字）
    下属 3390 汇报完成（233 字）

  主管汇总：
整体结论：三位广告主表现分化，847 接近打平但 Facebook 越投越亏，
1523 仍盈利但边际走弱，3390 则持续深度亏损且逐日恶化，是当前最大风险点。

最该关注广告主：**3390**。
理由：其近三天消耗 900→950→1000 美元递增，但收入 300→280→260 美元递减，
ROI 仅 0.29，且 0.33→0.29→0.26 单边下滑，转化 6→4 下降……
```

看起来不错。**但先别下结论，看下一节。**

## 七、三种形态对比：拿单 Agent 当基线

**所有对比都必须有基线**，否则你不知道多花的钱买到了什么。同一个问题（「847、1523、3390 谁最需要关注」）只用**一个** Agent 跑一遍：

```text
═══ 单 Agent 基线（同一个问题）═══
| 广告主 | 花费 | 收入 | ROI | 转化 | 趋势 |
| **847** | 6,200 | 5,864 | **0.95** | 121 | Facebook 持续恶化（0.92→0.80→0.70）|
| **1523** | 2,490 | 3,085 | **1.24** | 59 | 稳定，略降但仍在盈利 |
| **3390** | 2,850 | 840 | **0.29** | 15 | 三连跌（0.33→0.29→0.26） |

## 结论：最需要关注的是 3390
🔴 3390 —— 紧急，建议立即介入
ROI 仅 0.29，等于每花 1 元只收回 0.29 元，三天净亏约 2,010 元

  模型调用 2 次
  token    2792（输入 1908 + 输出 884）
  墙钟     13.1s
  调工具   3 次：['query_ad_report', 'query_ad_report', 'query_ad_report']
```

现在把四个数字并排放：

| 做法 | 模型调用 | token | 墙钟 | 结论对不对 |
|---|---|---|---|---|
| **单 Agent（基线）** | 2 | **2792** | **13.1s** | ✅ 对（3390） |
| 顺序（调研→写作→校对） | 4 | 5347（1.9×） | 34.1s（2.6×） | ✅ 对 |
| 并行（3 个数据源） | — | 3916 | **7.7s** | —（不同任务，见下） |
| 层级（主管 + 3 下属） | 8 | **6414（2.3×）** | 44.4s（3.4×） | ✅ 对 |

**这张表就是这一篇的结论。逐条读：**

**① 层级编排：花 2.3 倍 token、3.4 倍时间，结论没有更好。** 单 Agent 给的是一个干净的对比表 + 一句「最需要关注 3390，三天净亏 2010」；层级编排给的是三段下属汇报 + 一段汇总，说的是同一件事。**这次多花的 3600 多个 token，买到的不是更好的答案。**

**② 顺序编排：1.9 倍成本，买到的是「不许越界」。** 调研 Agent 被禁止写建议、写作 Agent 被禁止查数据、校对 Agent 只做核对。**这个钱花得值不值，取决于你是否真的需要这些约束**——比如对外发布的文案，「先写再校」是流程刚需；内部看一眼数据，单 Agent 就够了。

**③ 并行：唯一确定的赢家。** 提速 2.7 倍，token 不变。**因为它买到的是「时间」这件明确的东西，而不是「可能更好的答案」。**

（并行那一行和前三行不是同一个任务：前三行答的是「谁最需要关注」一个问题，并行是「分别查三个广告主」三件事。放在一张表里只是为了让你看清各自的成本量级，不能直接横比。）

### 什么时候该退回单 Agent

- **子任务之间共享大量上下文**——拆开就得反复传，token 翻倍而不是翻几倍
- **答案只要求「差不多对」**——那不值得为职责隔离付 2 倍成本
- **流程是固定的**——固定流程用代码编排，不需要让 Agent 自己决定分几步

## 八、常见坑

**① 把「步骤多」误判成「需要多 Agent」**

最贵的那个错。查三个广告主再汇总——这是**一个 Agent + 一个能查三个 ID 的工具**的事，不是三个 Agent 的事。判断法很简单：**子任务之间需不需要「不同的人格」？** 不需要，就别拆。

**② 上下文重复传递**

每个 Agent 都带全量历史，token 直接乘上 Agent 数。正确做法是**只传下游需要的那部分**：第四节的顺序编排里，写作 Agent 拿到的是调研 Agent 的**输出**，不是它的对话历史。

**③ 职责重叠**

两个 Agent 干同一件事，互相打架。判断法：**把每个 Agent 的 system 提示并排读一遍，如果有两句意思重合，就是重叠了。** 第四节那三个提示词（只出事实 / 只写结论 / 只做核对）互不重叠，才对。

**④ 无限委派**

Agent 之间互相甩锅，任务永远不结束。要有**委派深度上限**——A 派给 B、B 再派给 C 就到顶，不许再往下派。

**⑤ 错误传播**

上游错了，下游照着错下去。上面的「校对」角色就是防线的一种：**在下游加一个只核对、不生产的环节。** 但注意——校对 Agent 只能核对「草稿和事实一致不一致」，**它核对不了「事实本身对不对」**，那是数据源的事。

## 九、下一步

到这里，进阶篇的「能跑」部分齐了：Agent 能查数据、有记忆、跑得稳、还能拆成多个。

**但前面五篇用的数据，都是我们自己造的。**

`ad_report` 这张表是我为了演示建的：字段干净、类型规整、查询永远成功。真实系统不长这样——真实数据有**缺失字段、格式混乱、权限限制、速率限制**，而且**你经常不能直接查库，只能走别人给的 API**。

下一篇《接真实工具》就接这个：数据库、第三方 API、飞书。难点不在调用本身，而在**对接上之后才发现**的那些事。

:::info 与基础篇的关系
基础篇《Multi-Agent 多智能体系统》→ 讲**架构模式与适用场景**；本篇 → 讲**每种模式怎么写出来、代价多大**。
:::

:::note 关于文中的运行结果
本篇所有输出都是**实际运行结果**（模型用火山方舟的 `deepseek-v4-1-flash` 跑出）。
表里的 token 数与耗时都是真实累计值——`USAGE` 三个计数器就贴在代码里，你可以自己核。
代码只用 Python 标准库（`json` / `urllib` / `concurrent.futures`），不依赖任何第三方包。
:::
