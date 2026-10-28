---
title: 框架深挖·动手篇：用 3 个框架搭同一个 Agent
sidebar_position: 8
---

# 框架深挖·动手篇：用 3 个框架搭同一个 Agent

:::tip 先看结论
评判框架的最好方法不是读文档，而是**用同一个任务把三个框架各搭一遍**。

跑完的结论有点反直觉：**三份代码都能跑对，token 也差不多，但「手感」差得很远**——而且差距不在代码量上。
:::

## 这篇解决什么问题

资料篇给了框架清单，高级篇会做源码级对比。这一篇是**动手对比**：同一个任务、同一个数据文件、同一个模型，用三种范式各写一遍。

前置条件是前七篇——你已经知道一个 Agent 由哪些零件组成（循环、工具、状态、重试）。**只有自己搭过一遍，才能判断框架替你省掉的到底是哪部分。**

## 选哪三个框架

按三种范式各挑一个：

| 范式 | 选的框架 | 本文用的版本 | 特点 |
|---|---|---|---|
| 图编排 / 状态机 | **LangGraph** | `1.2.18` | 生产级、状态与持久化强，适合复杂流程 |
| 角色多智能体 | **CrewAI** | `1.15.32` | 上手快、role 分工直观 |
| 轻量运行时 | **OpenAI Agents SDK** | `0.20.0` | 简单可控、贴近大模型原生 |

> 选型不是定论。你完全可以换掉其中一个，按自己的场景挑。

**环境**：本机是 Python 3.9，这三个框架都要求更高版本，所以用一个 3.12 的独立虚拟环境：

```bash
uv venv --python 3.12 .venv
uv pip install langgraph langchain-openai crewai openai-agents
```

（实测这一步 `uv` 会自动下载一个 CPython 3.12.14，约 24MB。）

## 统一的任务

为了让对比公平，三个框架都实现**同一个任务**：

> 读一个本地数据文件 → 分析 → 输出结论

数据文件 `ads.json` 是三个广告主三天的投放记录，共 12 行（下面节选 4 行）：

```json
[
  {"adv_id": 847, "dt": "2026-10-25", "channel": "Facebook", "spend": 1200, "revenue": 1104, "conv": 24},
  {"adv_id": 847, "dt": "2026-10-25", "channel": "Google",   "spend": 800,  "revenue": 920,  "conv": 20},
  {"adv_id": 1523, "dt": "2026-10-25", "channel": "Facebook", "spend": 800, "revenue": 1000, "conv": 20},
  {"adv_id": 3390, "dt": "2026-10-25", "channel": "TikTok", "spend": 900,  "revenue": 300, "conv": 6}
]
```

**三个框架共用同一个工具实现**——这样比出来的差异才来自框架本身：

```python
DATA = pathlib.Path(__file__).with_name("ads.json")


def read_ads(adv_id: int) -> str:
    """读取指定广告主最近三天的投放数据，返回 JSON 文本。"""
    rows = [r for r in json.loads(DATA.read_text()) if r["adv_id"] == adv_id]
    if not rows:
        return json.dumps({"error": f"没有广告主 {adv_id} 的数据"}, ensure_ascii=False)
    return json.dumps(rows, ensure_ascii=False)
```

统一的问题：

```python
QUESTION = ("用 read_ads 工具分别读取 847、1523、3390 这三个广告主最近三天的投放数据，"
            "算出各自的 ROI，找出最需要关注的那个，给出一句话结论和理由。")
SYSTEM = "你是投放分析师。必须先用工具拿到真实数据再下结论，不要凭印象回答。"
```

## 一、先说清楚怎么比

五个维度，**前两个是数字，后三个只能靠跑完之后的感受**：

| 维度 | 怎么量 |
|---|---|
| 代码量 | 实现同一件事写了多少行 |
| 用量与耗时 | 总 token、墙钟 |
| 可读性 | 隔一周回来看，能不能看懂 |
| 调试体验 | 出错时能不能看到中间状态 |
| 生态与扩展 | 要做更复杂的东西，顺不顺手 |

## 二、LangGraph 版

**思路：把 Agent 循环表达成一张图。** 节点是「思考」和「调工具」，边是它们之间的流转。

```python
from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

import creds
from fwtools import read_ads


@tool
def read_ads_tool(adv_id: int) -> str:
    """读取指定广告主最近三天的投放数据（JSON 文本）。"""
    return read_ads(adv_id)


llm = ChatOpenAI(model=creds.MODEL, base_url=creds.BASE_URL, api_key=creds.API_KEY, temperature=0)
llm_with_tools = llm.bind_tools([read_ads_tool])


class State(TypedDict):
    messages: Annotated[list, add_messages]


def agent_node(state: State):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


def tools_node(state: State):
    out = []
    for tc in state["messages"][-1].tool_calls:
        out.append(ToolMessage(content=str(read_ads_tool.invoke(tc["args"])), tool_call_id=tc["id"]))
    return {"messages": out}


def should_continue(state: State):
    return "tools" if state["messages"][-1].tool_calls else END


g = StateGraph(State)
g.add_node("agent", agent_node)
g.add_node("tools", tools_node)
g.set_entry_point("agent")
g.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
g.add_edge("tools", "agent")
app = g.compile()

if __name__ == "__main__":
    result = app.invoke({"messages": [SystemMessage(SYSTEM), HumanMessage(QUESTION)]})
    print(result["messages"][-1].content)
```

**和手写循环对照着看**，一眼能看出它把什么变明确了：

| 手写（第一篇） | LangGraph |
|---|---|
| `msgs` 列表 | `State`（带类型的图状态） |
| `for step in range(...)` | `agent` → `tools` 的边 |
| `if not tool_calls: return` | `should_continue()` 条件边 |
| 上下文靠变量传 | 状态由 `add_messages` 自动合并 |

跑出来：

```text
最需要关注的是广告主 3390——三天 ROI 仅 0.29（每花 1 元只收回 0.29 元），
且花费在加、收入在跌，属于「越投越亏」的失血状态，必须立刻止损调优。
```

**这一版的感受**：**结构最"重"，但最像工程。** 节点、边、条件边各有名字，中间状态（`state["messages"]`）随时可查——这对调试是实打实的好处。代价是概念多：`StateGraph`、`add_messages`、`bind_tools`、条件边映射，第一次读要花时间。

## 三、CrewAI 版

**思路：把任务表达成「角色」。** 一个角色、一件任务、一组工具。

```python
import warnings

warnings.filterwarnings("ignore")

from crewai import LLM, Agent, Crew, Task
from crewai.tools import tool

import creds
from fwtools import read_ads

llm = LLM(model=f"openai/{creds.MODEL}", base_url=creds.BASE_URL,
          api_key=creds.API_KEY, temperature=0)


@tool("read_ads")
def read_ads_tool(adv_id: int) -> str:
    """读取指定广告主最近三天的投放数据（JSON 文本）。adv_id 是整数广告主 ID。"""
    return read_ads(adv_id)


analyst = Agent(
    role="投放数据分析师",
    goal="用工具拿到真实数据，算出各广告主的 ROI，找出最需要关注的那个",
    backstory="你只相信工具返回的数字，不凭印象下结论。",
    tools=[read_ads_tool],
    llm=llm,
    verbose=False,
)

task = Task(
    description=QUESTION,
    expected_output="一句话结论 + 理由，必须包含具体 ROI 数字",
    agent=analyst,
)

crew = Crew(agents=[analyst], tasks=[task], verbose=False)

if __name__ == "__main__":
    print(crew.kickoff())
```

跑出来：

```text
最需要关注的是广告主 3390，它最近三天 ROI 仅 0.29（花费 2850、营收 840，净亏 2010），
是全组唯一低于 0.3 的账户，且花费递增、营收与转化递减，属于典型的"越投越亏"恶化账户，
应立即暂停或收缩 TikTok 预算止损。
```

**这一版的感受**：**代码最短，概念最贴合业务语言。** `role` / `goal` / `backstory` / `expected_output` 这几个词，一个不懂技术的人也能看懂——这是它真正的好。而且它和框架自带的多 Agent 协作（第五篇那种主管-下属）是同一套抽象，扩展时不用换脑子。

**但第 7 行那个 `warnings.filterwarnings("ignore")` 是我加上去的——为什么？** 去掉它再跑一遍：

```text
Using an approximate input token count for model 'deepseek-v4-1-flash-260910':
assuming one token per four characters because a native token count is unavailable.
WARNING:crewai.llms.base_llm:Using an approximate input token count for model ...
WARNING:crewai.llms.base_llm:Using an approximate input token count for model ...
（连续刷屏）
```

**它在抱怨不认识这个模型名**，所以 token 数只能按「四个字符算一个 token」估。这条警告重复刷了很多遍，把输出淹了。

这件事有两层含义，都值得记住：

1. **调试体验的直接体现**：换个模型就冒出一堆重复警告，你还得先去搞明白它在说什么。**用国产模型或自部署模型时，这类"框架不认识你"的摩擦很常见。**
2. **下一节的 token 对比要打折扣**：CrewAI 报出来的那个数是它**自己估的**，不是接口返回的真实用量。别拿它当准数。

## 四、轻量 SDK 版

**思路：不就是个循环嘛。** 直接写工具 + 一个 Agent，剩下的交给 SDK。

```python
import asyncio

from agents import Agent, OpenAIChatCompletionsModel, Runner, function_tool
from openai import AsyncOpenAI

import creds
from fwtools import read_ads

client = AsyncOpenAI(base_url=creds.BASE_URL, api_key=creds.API_KEY)
model = OpenAIChatCompletionsModel(model=creds.MODEL, openai_client=client)


@function_tool
def read_ads_tool(adv_id: int) -> str:
    """读取指定广告主最近三天的投放数据（JSON 文本）。adv_id 是整数广告主 ID。"""
    return read_ads(adv_id)


agent = Agent(
    name="投放分析师",
    instructions="必须先用工具拿到真实数据再下结论，不要凭印象回答。",
    model=model,
    tools=[read_ads_tool],
)

if __name__ == "__main__":
    result = asyncio.run(Runner.run(agent, QUESTION))
    print(result.final_output)
```

跑出来：

```text
**结论：最该关注的是 3390——三天 ROI 仅 0.29，即每花 1 元只收回 0.29 元，
且花费上升的同时收入、转化同步下滑，是典型的"越投越亏"的恶化趋势，建议立即排查/暂停。**
```

**这一版的感受**：**代码最少、概念最少。** 装饰器加在函数上就完事，工具描述直接取函数的 docstring——这和手写那套 `TOOLS` 声明 + `TOOL_IMPL` 字典比，省掉了最容易写错的那部分（声明和实现不一致）。

**它也有自己的噪音**，而且是跑起来才看到的：

```text
OPENAI_API_KEY is not set, skipping trace export
```

**它想给 OpenAI 平台上报 trace，但没有那个 Key**——用的是自定义 `base_url`，所以上报不了。不报错、不影响运行，就是每次多一行。这行字你可能永远不需要管，但第一次看到它时得先确认「是不是我配错了」。

## 五、三版并列对比

同一个任务、同一个数据文件、同一个模型，各跑一遍：

| | LangGraph | CrewAI | OpenAI Agents SDK |
|---|---|---|---|
| **代码行数**（含空行注释） | **60** | 44 | **37** |
| 去掉空行与注释 | 42 | 32 | **26** |
| **总 token** | 2269 | 2612 ⚠️ | 2267 |
| **墙钟** | 10.7s | 12.6s | 14.4s |
| **结论对不对** | ✅ 答对 3390 | ✅ 答对 3390 | ✅ 答对 3390 |
| 引入的概念 | 图 / 状态 / 条件边 | 角色 / 任务 / 团队 | Agent / Runner / 工具装饰器 |
| 中间状态可查 | ✅ `state["messages"]` | 需开 `verbose=True` | 需看 `result.raw_responses` |

**逐条说清楚，因为每一条都有陷阱：**

**① 代码量：SDK 最短，但差距没那么大。** 37 / 44 / 60 行——**最长和最短只差 23 行**。也就是说：**为这一个任务挑框架，省不下多少代码。** 框架的价值不在这一屏代码里，而在后面要做复杂流程时。

**② token：三个数几乎一样，而且其中一个不准。**

- LangGraph 2269、SDK 2267——**几乎完全相同**，因为它们底层都是同一个模型、同样的两轮调用。
- CrewAI 的 2612 **带那个警告符号**：上一节说了，这是它自己按「四字符一 token」估的，不是接口返回的真实值。

**结论：token 消耗取决于你的提示词和循环步数，不取决于用哪个框架。** 换框架不会让你变便宜或变贵。

**③ 墙钟：别信一次跑的数字。** 我把三份各跑了两次：

| | 第一次 | 第二次 |
|---|---|---|
| LangGraph | 10.2s | 10.7s |
| CrewAI | 14.7s | 12.6s |
| SDK | 11.1s | **14.4s** |

**顺序变了。** SDK 从第二快变成最慢，CrewAI 从最慢变成中间。**这就是第七篇那条结论的现场版：单次跑出来的时间说明不了什么。** 真要比较延迟，每个跑 5 次取中位数——但就这个任务的量级（10~15 秒，大部分时间在等模型），**框架带来的延迟差异小于网络抖动**。

**④ 三份都答对了。** 这是最该记住的一条：**这个任务太简单，三个框架都能做对。** 用它们区分优劣是选错了尺子。

### 那到底该怎么选

**按「你的任务长什么样」选，不是按「哪个更好」选：**

| 你的任务 | 建议 |
|---|---|
| 就是「模型 + 几个工具 + 循环」 | **别上框架。** 前面七篇手写的那套更好调试，也更好改 |
| 流程有明确的分支、回退、人工审批节点 | **LangGraph**——它的图模型就是为这个设计的 |
| 角色分工是核心（分析师 / 审核 / 写手） | **CrewAI**——用业务语言就能描述清楚 |
| 想要最少的概念、贴近原生 API | **轻量 SDK**——它基本就是「官方版的手写循环」 |

## 六、常见坑

**① 照着文档抄一遍就以为会了**

上面三份代码都是从官方文档起步改的。**必须自己改一个需求**——比如「让它把结论写进一个文件」——你才会碰到这个框架真正的边界在哪。

**② 用同一个任务之外的场景下结论**

本文这个任务三份都做对了，**所以它不能用来判断"哪个框架更好"**，只能用来判断「哪个更好上手」。框架的优劣高度依赖场景。

**③ 忽略版本差异**

本文三个框架用的是 `langgraph 1.2.18` / `crewai 1.15.32` / `openai-agents 0.20.0`。这些库迭代很快，**照着半年前的教程写，多半跑不起来**。遇到报错先查版本，别急着怀疑自己。

**④ 只看上手速度**

CrewAI 上手最快，但上面那条重复刷屏的警告说明：**它对非主流模型的支持是"能用但不精致"**。上手快是「第一天」的事，维护是「第一年」的事。

**⑤ 用国产 / 自部署模型时的额外摩擦**

本文就是用自定义 `base_url` 接的模型，遇到了两种噪音：CrewAI 的 token 估算警告、SDK 的 trace 上报提示。**都不影响运行，但初次接触时容易误判成"我配错了"。** 先确认「这是提示还是错误」，再决定要不要管。

## 七、下一步

进阶篇到这里就结束了。

回头看这八篇，你手上有一套**完全自己写的**东西：循环、记忆、工具、Runtime、多 Agent、真实接入、评测，再加上今天的三个框架对照。

**它们全都不到几百行。** 这就是这一篇最想让你带走的东西：**框架不是魔法，它就是把你在前七篇里手写过的东西，换了个更通用的写法。**

那接下来该往哪走？手写到这里够用，但生产环境还有几件这一层看不到的事：

- **性能**：并发上去了怎么办、缓存放在哪一层
- **成本**：token 花在哪了、怎么系统性降下来
- **安全**：提示词注入、工具越权、数据出域
- **评估体系**：运行期间的质量监控（第七篇只讲了开发期的几个用例）

**补在哪**：高级篇。进阶篇讲的是「怎么把它做出来」，高级篇讲的是「**怎么让它活着**」。

:::info 与高级篇、资料篇的关系
- 资料篇《开源 Agent 框架清单》→ 有哪些框架、怎么快速选；
- 本篇 → 动手各搭一遍，比手感；
- 高级篇《框架选型·源码级》→ 读源码、比架构。
:::

:::note 关于文中的运行结果
本篇所有输出都是**实际运行结果**（模型用火山方舟的 `deepseek-v4-1-flash` 跑出）。
三个框架装在独立的 Python 3.12 虚拟环境里，版本号见正文。
「代码行数」是 `wc -l` 的真实输出；「墙钟」是 `time` 的真实输出。
CrewAI 那个 token 数**是它自己的估算值**（它明说不认识这个模型），已在正文标注。
代码只用三个框架本身 + Python 标准库。
:::
