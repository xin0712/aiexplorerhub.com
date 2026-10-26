---
title: 手写一个最小 Agent 循环
sidebar_position: 1
---

# 手写一个最小 Agent 循环

:::tip 先看结论
一个 Agent 循环，最少只要四样东西：**一次模型调用、一张工具表、一个循环、一个退出条件**。
这篇我们不用任何框架，用不到 80 行代码把它跑起来——看清框架替我们做了什么。
:::

## 这篇解决什么问题

基础篇的「从 0 开始构建一个 Agent」讲的是**架构**：任务边界、输入输出、Prompt、工具接口、Memory、Controller。
这一篇讲的是**代码**：把那份架构真的敲出来，并让它跑出结果。

读完你会得到：一个能自己调用工具、看结果、再决定下一步的最小 Agent，以及一份可以继续往上加东西的骨架。

## 一、先明确：一个循环最少需要什么

一个能跑的最小 Agent，必需四件：

| 必需件 | 作用 |
|---|---|
| 模型调用 | 决定下一步做什么 |
| 工具表 | 告诉模型有哪些能力可用 |
| 循环 | 让「决策 → 执行 → 观察」重复起来 |
| 退出条件 | 什么时候停 |

这三样**可以暂时不要**：记忆、多轮规划、错误恢复。先跑通，再往上加。

## 二、定一个真实任务

**任务：让 Agent 查「北京今天天气」并回答。**

选它的理由：只需要一次工具调用，够简单；但已经能看出循环的全部要素——模型决策、执行、回传、收敛。

## 三、v0：单轮调用

先只发一次请求，看模型会不会要求调工具。

```python
import json, os, urllib.request

API_KEY = os.environ["OPENAI_API_KEY"]
BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.deepseek.com/v1")
MODEL = os.environ.get("MODEL", "deepseek-chat")

TOOLS = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "查询指定城市的当前天气",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string", "description": "城市名，如 北京"}},
            "required": ["city"],
        },
    },
}]

def chat(messages, tools=None):
    body = {"model": MODEL, "messages": messages, "stream": False}
    if tools:
        body["tools"] = tools
    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

msgs = [{"role": "user", "content": "北京今天天气怎么样？"}]
resp = chat(msgs, TOOLS)
msg = resp["choices"][0]["message"]
print("content   =", repr(msg.get("content")))
print("tool_calls=", json.dumps(msg.get("tool_calls"), ensure_ascii=False, indent=2))
```

实际跑出来是这样（模型没直接回答，而是要调工具）：

```text
content   = '我来帮您查询北京今天的天气。'
tool_calls= [
  {
    "function": {
      "arguments": "{\"city\": \"北京\"}",
      "name": "get_weather"
    },
    "id": "call_00_0i0eqxdrea08172d4tgqeqeq",
    "type": "function"
  }
]
```

**关键点**：模型的「回答」可能同时包含一段文字和一个 `tool_calls` 列表。
只要 `tool_calls` 非空，就说明它**还没给出最终答案**——它在等你执行工具。

### 拆一下 `chat()` 里那两行

有个地方容易卡住，单独说一下：

```python
body = {"model": MODEL, "messages": messages, "stream": False}   # 这里只有 3 个键
if tools:
    body["tools"] = tools                                        # 这一行给它【加】了第 4 个键
```

**`body["tools"] = tools` 不是「修改」，是「新增一个键」。**

Python 的字典是可变的，建好之后还能往里加东西。实际跑一下：

```python
body = {"model": "m", "messages": [], "stream": False}
print(len(body))        # 3

body["tools"] = [{"type": "function"}]
print(len(body))        # 4 —— 同一个字典，多了一个键
print(body)
# {'model': 'm', 'messages': [], 'stream': False, 'tools': [{'type': 'function'}]}
```

所以它跟下面这种写法是**等价**的：

```python
if tools:
    body = {"model": MODEL, "messages": messages, "stream": False, "tools": tools}
else:
    body = {"model": MODEL, "messages": messages, "stream": False}
```

文里选了前一种，因为后面还要加别的字段（`temperature`、`max_tokens` 等），
用 `if` 一个个追加，比反复重写整个字典清爽。

### 为什么写成「有才加」

看函数签名：`def chat(messages, tools=None)`——`tools` 是**可选参数**。

```python
chat(msgs, TOOLS)   # 带工具：请求体里有 tools 字段
chat(msgs)          # 不带：tools 是 None，那行不执行，请求体里就没这个字段
```

为什么需要「不带」的情况？因为不是每次调用都要工具。而且**省略比传空数组干净**——
有些服务端对 `"tools": []` 的处理不一致，干脆不带。

## 四、v1：加上工具执行

现在把工具真正跑起来，并把结果**回传**给模型。

```python
def get_weather(city: str) -> dict:
    """假装查天气（真实项目里换成 HTTP 调用）。"""
    fake_db = {"北京": {"temp_c": 12, "desc": "晴"}, "上海": {"temp_c": 18, "desc": "多云"}}
    if city not in fake_db:
        raise ValueError(f"查不到城市：{city}")
    return fake_db[city]

TOOL_IMPL = {"get_weather": get_weather}

msgs = [{"role": "user", "content": "北京今天天气怎么样？"}]

# 第一轮：模型要求调工具
msg = chat(msgs, TOOLS)["choices"][0]["message"]
msgs.append(msg)

# 执行工具，把结果作为 tool 消息回传
for tc in msg.get("tool_calls", []):
    name = tc["function"]["name"]
    args = json.loads(tc["function"]["arguments"])
    print(f"[执行工具] {name}({args})")
    try:
        result = TOOL_IMPL[name](**args)
        content = json.dumps(result, ensure_ascii=False)
    except Exception as e:
        content = json.dumps({"error": str(e)}, ensure_ascii=False)   # 失败也要回传
    print(f"[工具结果] {content}")
    msgs.append({"role": "tool", "tool_call_id": tc["id"], "content": content})

# 第二轮：模型基于工具结果作答
final = chat(msgs, TOOLS)["choices"][0]["message"]
print("[最终回答]", final.get("content"))
```

跑起来：

```text
[执行工具] get_weather({'city': '北京'})
[工具结果] {"temp_c": 12, "desc": "晴"}
[最终回答] 北京今天天气晴朗，气温大约 12°C。
```

这里有**三个必须做对的地方**：

1. **把模型的 `tool_calls` 消息本身也 append 进历史**——漏了这一步，服务端会因为「工具结果没有对应的调用」而报错；
2. **`tool_call_id` 必须对上**——它是结果和调用的关联键；
3. **工具失败也要回传**，用 `{"error": ...}` 的形式——不要吞掉异常。

第 3 点值得展开。故意让工具查一个不存在的城市：

```text
[工具结果] {"error": "查不到城市：火星"}
[最终回答] 我按照你的要求调用了 get_weather 工具查询「火星」的天气，返回结果是：
           {"error": "查不到城市：火星"}
           也就是说，该天气服务里没有「火星」这个城市，无法给出查询结果。
```

模型如实说明了失败，而不是编一个假天气。**这就是「错误可见」的价值**——如果当时把异常吞掉、返回一个空字典，模型很可能会当成「火星没有天气数据」然后自己编一个。

## 五、v2：加上循环与退出条件

v1 只处理了一次工具调用。真实任务可能要多步——加循环。

```python
MAX_STEPS = 8

def run_agent(question: str) -> str:
    msgs = [{"role": "user", "content": question}]

    for step in range(1, MAX_STEPS + 1):
        msg = chat(msgs, TOOLS)["choices"][0]["message"]
        msgs.append(msg)

        tool_calls = msg.get("tool_calls") or []
        # 退出条件①：模型不再要工具，就是最终答案
        if not tool_calls:
            return msg.get("content") or ""

        for tc in tool_calls:
            name = tc["function"]["name"]
            try:
                args = json.loads(tc["function"]["arguments"])
                result = TOOL_IMPL[name](**args)
                content = json.dumps(result, ensure_ascii=False)
            except Exception as e:
                content = json.dumps({"error": str(e)}, ensure_ascii=False)
            print(f"  步骤{step}: {name}({args}) -> {content}")
            msgs.append({"role": "tool", "tool_call_id": tc["id"], "content": content})

    # 退出条件②：步数上限 —— 收敛而不是无限跑
    return f"[已达步数上限 {MAX_STEPS}，任务未完成]"
```

**两个退出条件缺一不可**：

- **条件①（正常结束）**：模型不再要求调工具，说明它认为可以回答了；
- **条件②（兜底）**：步数上限。没有它，模型一旦陷入反复调用，任务会一直跑下去——烧钱且永不结束。

多工具版本：把 `TOOLS` 换成下面这份（新增汇率换算工具），再问一个需要两个工具的问题。

```python
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查询指定城市的当前天气",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string", "description": "城市名，如 北京"}},
                "required": ["city"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "convert_currency",
            "description": "把人民币换算成美元",
            "parameters": {
                "type": "object",
                "properties": {"cny": {"type": "number", "description": "人民币金额"}},
                "required": ["cny"],
            },
        },
    },
]

# 实现与注册：
def convert_currency(cny: float) -> dict:
    return {"cny": cny, "usd": round(cny / 7.2, 2), "rate": 7.2}

TOOL_IMPL["convert_currency"] = convert_currency
```

然后问：

```text
== 问题：北京天气怎么样？顺便告诉我 720 元是多少美元。
  步骤1: get_weather({'city': '北京'}) -> {"temp_c": 12, "desc": "晴"}
  步骤1: convert_currency({'cny': 720}) -> {"cny": 720, "usd": 100.0, "rate": 7.2}
== 回答：两件事都已经查好了：
        - 北京天气：晴，气温 12°C。
        - 720 元：按当前汇率 7.2 换算，约合 100 美元。
```

注意两行都是**步骤 1**：模型在同一次回复里发起了**两个工具调用**（并行调用）。这是能力，但也意味着你的循环要能处理「一次多个调用」。

把步数上限调成 1，就能看到兜底逻辑生效：

```text
  步骤1: get_weather({'city': '北京'}) -> {"temp_c": 12, "desc": "晴"}
  步骤1: convert_currency({'cny': 720}) -> {"cny": 720, "usd": 100.0, "rate": 7.2}
[已达步数上限 1，任务未完成]
```

它**明确报告了未完成**，而不是假装成功。

## 六、常见坑

**① 死循环**
模型可能反复调同一个工具。步数上限是第一道防线；更细的做法是检测「同一个工具 + 同一组参数连续出现」。

**② 工具结果没回传 / 回传格式不对**
- 忘了把模型的 `tool_calls` 消息 append 进历史 → 服务端报错；
- `tool_call_id` 对不上 → 服务端报错；
- 把结果拼成普通文本而不是 `role: "tool"` 消息 → 模型看不到。

**③ 上下文爆掉**
每轮都把完整历史发一遍，轮数多了 token 会失控。这是下一篇《Memory 实战》要解决的问题。

**④ 静默失败**
工具报错被吞掉、返回空值，模型会当成「查询成功但没数据」，然后接着往下编。
**永远让失败可见**——这是我们在这篇里反复强调的一点。

**⑤ 「工具没被调用」不等于「不需要」**
实测中我们发现：问「火星天气怎么样」时，模型可能**根本不调工具**，直接用自己的知识回答。
如果你需要它一定调用某个工具，得在 Prompt 里明确要求（我们在测试里就是这么做的）；否则它的判断和你的预期可能不一致。

## 七、下一步

跑通之后，你会发现这个骨架缺三样东西：

| 缺什么 | 症状 | 补在哪篇 |
|---|---|---|
| 记不住事 | 长对话后忘掉前面说过的 | Memory 实战 |
| 工具太少 / 不好用 | 能做的事有限 | Tool Calling 实战 |
| 容易崩 | 网络抖动、超时就整个失败 | Agent Runtime 实战 |

:::info 与基础篇的关系
基础篇《从 0 开始构建一个 Agent》→ 讲**怎么设计**；本篇 → 讲**怎么写出来、跑起来**。
两篇配合读，效果最好。
:::

:::note 关于文中的运行结果
本篇所有输出都是**实际运行结果**（模型用火山方舟的 `deepseek-v4-1-flash` 跑出）。
代码只用 Python 标准库，不依赖任何第三方包——把它存成 `.py` 就能跑。
:::
