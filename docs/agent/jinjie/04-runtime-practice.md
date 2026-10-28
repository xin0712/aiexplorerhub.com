---
title: Agent Runtime 实战
sidebar_position: 4
---

# Agent Runtime 实战：让它不崩、能续、可中断

:::tip 先看结论
Demo 和生产的差距，几乎全在 Runtime：**超时、重试、状态恢复、中断处理**。

这篇不讲概念，讲落地——我们**真的把服务打挂**（真 500、真超时、真连不上），看 Agent 怎么反应；
再**真的把进程强杀**，看它重启后能不能接上。
:::

## 这篇解决什么问题

基础篇《Agent Runtime》讲的是 **Runtime 由哪些部分组成**；
这一篇讲的是**怎么把这些部分实现出来**，并让 Agent 在真实网络和真实故障下活下来。

上一篇《Tool Calling 实战》结尾留了三件事：

```python
urllib.request.urlopen(req, timeout=120)      # 只有超时，没有重试、没有降级
```

```python
msgs = [{"role": "user", "content": question}]   # 只在内存里，崩一次全白干
```

外加 MCP 把工具挪到进程外之后新增的那些失败面——子进程起不来、握手超时。

这三件事是同一类：**03 篇的循环假设「调用总会成功」，而真实世界不是。** 这一篇把那个假设拆掉。

## 一、Runtime 到底在管什么

回看 03 篇结束时那个循环，它只有两条退出条件：

```python
def run_agent(question):
    for step in range(1, MAX_STEPS + 1):
        ...
        if not tool_calls:
            return msg.get("content") or ""              # ① 模型不再要工具
    return f"[已达步数上限 {MAX_STEPS}，任务未完成]"      # ② 步数上限
```

**这两条管的是「什么时候停」，没管「出事了怎么办」。** Runtime 补的就是后面这半：

| Runtime 管什么 | Demo 里的默认假设 | 真实世界 |
|---|---|---|
| 状态 | 一个 `for` 循环就够了 | 跑到哪了、卡在哪个环节，要能看见、能存盘 |
| 超时 | 对方总会回 | 对方可能永远不回 |
| 重试 | 调用一次就成 | 网络会抖、服务会 5xx、会被限流 |
| 恢复 | 进程一直活着 | 会被 Ctrl+C、会崩、会被强杀 |

一句话：**Demo 假设一切顺利，Runtime 假设一定会失败。**

## 二、状态机：把执行变明确

先给状态一个名字。这不是为了好看——**状态是你要存进检查点的东西**，也是排查时唯一能回答「它现在到底在干嘛」的东西。

```python
class S:
    READY = "READY"        # 有新任务
    THINKING = "THINKING"  # 等模型
    ACTING = "ACTING"      # 执行工具
    DONE = "DONE"          # 正常结束
    FAILED = "FAILED"      # 放弃
    PAUSED = "PAUSED"      # 被中断，已存档


def go(cur, nxt):
    print(f"    [状态] {cur} → {nxt}")
    return nxt
```

六个状态，迁移条件只有三条：

| 迁移 | 条件 |
|---|---|
| `READY → THINKING` | 开始一轮，发请求给模型 |
| `THINKING → ACTING` | 模型要求调工具 |
| `THINKING → DONE` | 模型不再要工具，它给出最终答案了 |
| 任意 → `FAILED` / `PAUSED` | 出错放弃 / 被中断 |

**为什么不用一堆 `if`？** 因为状态机让「当前处在哪」变成一个**可以打印、可以存盘、可以判断的值**。第三篇那个循环里没有这个概念——出问题时你只能看日志猜。这一段加了 `go()` 之后，真实运行长这样：

```text
    [状态] READY → THINKING
    [状态] THINKING → ACTING
  步骤1: query_ad_report({"adv_id": 847, "days": 3}) -> {...}
    [状态] ACTING → THINKING
    [状态] THINKING → DONE
```

**一眼就能看出：这一次转了两轮、调了一个工具、正常结束。** 后面恢复逻辑能不能接上，靠的也是这个状态。

## 三、超时：每一层都要有

### 三层超时，缺一层就漏

| 层 | 卡住的后果 | 本文用的值 |
|---|---|---|
| 模型调用 | 一个请求挂住，整个任务停在那 | `MODEL_TIMEOUT = 60` 秒 |
| 工具执行 | 外部 API 永远不返回，循环出不来 | `TOOL_TIMEOUT = 10` 秒 |
| 整体任务 | 跑一整天，账单爆炸 | `MAX_STEPS = 6` 步 |

### 工具超时怎么写

模型那边好办，`urlopen(req, timeout=...)` 就行。**工具不行**——如果工具是个普通函数，它会一直阻塞在那一行。得让它跑在另一个线程里，主线程只等有限时间：

```python
_pool = ThreadPoolExecutor(max_workers=4)


def call_tool(name, args, timeout=TOOL_TIMEOUT):
    """工具也必须有超时——外部 API 可能永远不返回。"""
    fut = _pool.submit(TOOL_IMPL[name], **args)
    try:
        return fut.result(timeout=timeout)
    except FutureTimeout:
        raise TimeoutError(f"工具 {name} 超过 {timeout}s 没返回")
```

**这里有个真实限制要说清楚**：超时之后那个线程**并没有被杀掉**，它还在后台跑（Python 杀不了线程）。所以 `fut.result(timeout=...)` 只能让**你**不等它，不能让它停。真要能杀，得把工具做成子进程（就是 MCP 那种形态）再 `kill`。

### 超时算「可重试」

超时意味着「对方没在约定时间内回话」——可能是网络抖、可能是对方正忙。**这是临时状况，重试有意义。** 下一节会看到它的分类结果。

## 四、重试：什么时候该重试

**不是所有失败都值得重试。** 这是这一节唯一的重点。

### 先给错误分类

```python
# 这些状态码重试有意义；其余 4xx 是「你自己发错了」，重试只是浪费
RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504}


def categorize(exc):
    """判断一个异常该不该重试。返回 (类别, 说明)。"""
    if isinstance(exc, urllib.error.HTTPError):
        if exc.code in RETRYABLE_STATUS:
            return "retryable", f"HTTP {exc.code}"
        return "fatal", f"HTTP {exc.code}"
    if isinstance(exc, (socket.timeout, TimeoutError)):
        return "retryable", "超时"
    if isinstance(exc, urllib.error.URLError):
        return "retryable", f"连接失败（{exc.reason}）"
    return "fatal", f"{type(exc).__name__}: {exc}"
```

三类的判断依据：

| 情况 | 分类 | 为什么 |
|---|---|---|
| 429 / 5xx | 可重试 | 服务端忙、临时故障——等一会儿再试是对的 |
| **其余 4xx** | **不可重试** | 400 参数错、401 凭据失效、404 地址不存在——**再试一百次也一样** |
| 超时 / 连接失败 | 可重试 | 网络抖动、对方临时不可达 |

**看最后那一行 `return "fatal", ...`**：**默认归为不可重试**。这个默认值很重要——把不确定的错都当可重试，会在真正出问题时疯狂重试，把小故障放大成大故障。

### 重试的实现：指数退避 + 抖动

```python
def retry_call(fn, *, what, max_retries=MAX_RETRIES, base=BASE_DELAY):
    """带指数退避 + 抖动的重试；不可重试的错误立刻抛出。"""
    for attempt in range(1, max_retries + 1):
        try:
            return fn()
        except Exception as e:
            kind, why = categorize(e)
            if kind == "fatal":
                print(f"    [重试] {what} 失败：{why} —— 不可重试，放弃")
                raise
            if attempt == max_retries:
                print(f"    [重试] {what} 第 {attempt} 次仍失败：{why} —— 用尽")
                raise
            delay = base * (2 ** (attempt - 1)) * (0.5 + random.random())
            print(f"    [重试] {what} 第 {attempt} 次失败：{why} —— 等 {delay:.2f}s 再试")
            time.sleep(delay)
```

三个细节：

- **`2 ** (attempt - 1)`**——指数退避：等 1 倍、2 倍、4 倍。第一版用 `base=0.5`，所以是 0.5s、1s、2s 起步。
- **`* (0.5 + random.random())`**——**抖动**，把等待时间打散到 0.5~1.5 倍。**为什么需要**：如果一千个客户端同时被限流，大家都「等 1 秒再试」，那一秒后它们又同时打过去，把服务端再打挂一次。抖动让重试时间错开。
- **`if kind == "fatal": raise`**——不可重试的**立刻抛出**，不浪费时间。

### 真实对照：500 试了两次，404 一次都没试

同一个程序、同一个问题，只换被打挂的方式。

**服务端真的返回 500**（我在中间放了一个会返回 500 的代理，前两次请求返回真 500）：

```text
  [全新] 没有可用检查点
    [状态] READY → THINKING
    [重试] 模型调用 第 1 次失败：HTTP 500 —— 等 0.70s 再试
    [重试] 模型调用 第 2 次失败：HTTP 500 —— 等 1.20s 再试
    [状态] THINKING → ACTING
  步骤1: query_ad_report({"adv_id": 847, "days": 3}) -> {"adv_id": 847, ...
```

**第三次成功，任务照常跑完。** 注意那两行等待时间：0.70s 和 1.20s——就是指数退避乘上抖动后的真实值（不是 0.5 和 1.0）。

**换成一个 404**（真实接口 + 一个不存在的模型名）：

```text
    [重试] 模型调用 失败：HTTP 404 —— 不可重试，放弃
    [状态] THINKING → FAILED
```

**只尝试了一次。** 因为模型名写错是你自己的问题，重试一百次也是 404——省下来的两次调用和等待，就是分类的价值。

### 重试之前先问一句：这个操作做两次会怎样

**幂等**的操作（查询类）随便重试。**不幂等**的操作（下单、转账、发消息）重试会变成做两次。

工具如果可能不幂等，要么设计成幂等的（带请求 ID 去重），要么在重试前先确认上一次到底成没成。

## 五、错误恢复：三种失败三种处理

| 失败类型 | 例子（都是实测的） | 处理 |
|---|---|---|
| 可恢复 | `HTTP 500` → 重试 2 次后成功 | 重试 / 换路径 |
| 不可恢复 | `HTTP 404` → 一次就放弃 | 停止 + 明确上报 |
| 部分成功 | 第 1 步成了、第 2 步挂了 | 记录进度，从断点续（下一节） |

**连接不上**也属于可恢复——实测的真实报错：

```text
    [重试] 模型调用 第 1 次失败：连接失败（[Errno 61] Connection refused） —— 等 0.44s 再试
    [重试] 模型调用 第 2 次仍失败：连接失败（[Errno 61] Connection refused） —— 用尽
    [状态] THINKING → FAILED
  [失败] retryable：连接失败（[Errno 61] Connection refused）
```

**失败要报出「是什么失败」**，不能只说「失败了」。`retryable` 还是 `fatal`，决定了对方该等一会儿再试、还是该去改配置。

## 六、可中断与可续跑

这是整篇最实用的一节，也是我踩坑最多的一节。

### 存什么

**存的就是「接着跑需要的最小信息」**：状态、消息历史、跑到第几步。

```python
def save_state(state, msgs, step):
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"state": state, "msgs": msgs, "step": step}, f, ensure_ascii=False)
    os.replace(tmp, STATE_FILE)   # 原子替换：崩在写一半也不会留下坏文件
```

**最后那行是重点。** 直接 `open(STATE_FILE, "w")` 写，如果正好写到一半进程被杀，磁盘上会留下一个**残缺的 JSON**——下次启动解析失败，比没有检查点还糟。先写临时文件、再 `os.replace` 原子替换，保证读到的永远是完整的旧版或完整的新版。

### 什么时候存

**每完成一步就存。** 存太勤慢，存太疏丢得多。一步一存的结果是：**最坏情况只丢当前这一步。**

### 我踩的那个坑：只认 `PAUSED`

第一版恢复逻辑我写的是：

```python
if saved and saved["state"] == S.PAUSED:      # ← 第一版写错了
    msgs, start = saved["msgs"], saved["step"]
```

看起来合理：被中断了才叫 `PAUSED`，才需要恢复。**然后我用 SIGKILL 强杀进程测了一次**——检查点文件里 state 是 `THINKING`，不是 `PAUSED`，恢复逻辑认不出来，**从头重跑了一遍**。

原因很简单，但不想清楚就会写错：

> **被 SIGKILL 杀掉的进程，没有机会写「我被中断了」。**

`PAUSED` 只有在进程**自己**决定停的时候才写得进去（比如收到 Ctrl+C）。被强杀、被 OOM 杀掉、机器断电——**这些情况下进程连一句话都留不下来**，检查点里就是它倒下的那一刻的状态：`THINKING`。

所以**恢复的判据不能是「状态等于 PAUSED」，只能反过来：只要不是终态，就可以续**。

```python
TERMINAL = {S.DONE}     # 只有「正常跑完」才算不用再接


def run(question):
    saved = load_state()
    if saved and saved["state"] not in TERMINAL:
        # 不能只认 PAUSED——被 SIGKILL 杀掉的进程没机会写下「我被中断了」
        msgs, start = saved["msgs"], saved["step"]
        print(f"  [恢复] 读到检查点：状态 {saved['state']}，已完成 {start} 步，从第 {start + 1} 步接着跑")
    else:
        msgs, start = [{"role": "user", "content": question}], 0
        print("  [全新] 没有可用检查点")
```

**改成「非终态皆可续」之后，两种中断才都能接上。** 这是本篇我最想让你带走的一条。

### 完整主循环

```python
def run(question):
    saved = load_state()
    if saved and saved["state"] not in TERMINAL:
        msgs, start = saved["msgs"], saved["step"]
        print(f"  [恢复] 读到检查点：状态 {saved['state']}，已完成 {start} 步，从第 {start + 1} 步接着跑")
    else:
        msgs, start = [{"role": "user", "content": question}], 0
        print("  [全新] 没有可用检查点")

    state = S.READY
    step = start
    try:
        for step in range(start + 1, MAX_STEPS + 1):
            state = go(state, S.THINKING)
            msg = chat(msgs)["choices"][0]["message"]
            msgs.append(msg)

            tool_calls = msg.get("tool_calls") or []
            if not tool_calls:
                save_state(S.DONE, msgs, step)
                return go(state, S.DONE), msg.get("content") or ""

            state = go(state, S.ACTING)
            for tc in tool_calls:
                name = tc["function"]["name"]
                args = json.loads(tc["function"]["arguments"])
                try:
                    out = json.dumps(call_tool(name, args), ensure_ascii=False)
                except Exception as e:
                    kind, why = categorize(e)
                    out = json.dumps({"error": why}, ensure_ascii=False)
                print(f"  步骤{step}: {name}({json.dumps(args, ensure_ascii=False)}) -> {out[:80]}")
                msgs.append({"role": "tool", "tool_call_id": tc["id"], "content": out})

            save_state(S.THINKING, msgs, step)     # 每步结束就落盘
            if SELFKILL == step:
                print(f"    [演示] 第 {step} 步结束，对自身发 SIGKILL（模拟被强杀）")
                os.kill(os.getpid(), signal.SIGKILL)
            if SELFINT == step:
                print(f"    [演示] 第 {step} 步结束，对自身发 SIGINT（相当于 Ctrl+C）")
                os.kill(os.getpid(), signal.SIGINT)

        state = go(state, S.FAILED)
    except KeyboardInterrupt:
        state = go(state, S.PAUSED)
        save_state(state, msgs, step)
        print(f"  [中断] 已存档到检查点（{step} 步），下次运行会接上")
        return state, f"[已暂停于第 {step} 步]"
    except Exception as e:
        kind, why = categorize(e)
        state = go(state, S.FAILED)
        save_state(state, msgs, step)
        print(f"  [失败] {kind}：{why}")
        return state, f"[失败：{why}]"

    return state, f"[已达步数上限 {MAX_STEPS}，任务未完成]"
```

**`except KeyboardInterrupt` 必须写在 `except Exception` 前面。** 因为 `KeyboardInterrupt` 继承自 `BaseException` 而不是 `Exception`——如果你只写 `except Exception`，**Ctrl+C 不会被它接住**，进程直接死，检查点也就没了。

（中间那两个 `if SELFKILL / SELFINT` 是**演示用的开关**，让我能确定性地在「第 N 步结束」那一刻制造强杀和 Ctrl+C。真实项目里删掉。）

## 七、跑起来

### 完整的运行代码

这一段是上面所有片段拼起来的完整文件。它复用 03 篇的 `ad_tool`（工具层），`chat()` 与 01 篇同形。

```python
import json
import os
import random
import signal
import socket
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout

from ad_tool import TOOL_IMPL, TOOLS, build_db

API_KEY = os.environ["OPENAI_API_KEY"]
BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.deepseek.com/v1")
MODEL = os.environ.get("MODEL", "deepseek-chat")

STATE_FILE = "/tmp/rt_demo/run_state.json"

MODEL_TIMEOUT = float(os.environ.get("MODEL_TIMEOUT", "60"))
TOOL_TIMEOUT = float(os.environ.get("TOOL_TIMEOUT", "10"))
MAX_STEPS = int(os.environ.get("MAX_STEPS", "6"))
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "3"))
BASE_DELAY = 0.5
```

（后面接上第二节到第六节里的每一段：状态类、`categorize`、`retry_call`、`chat_once` / `chat` / `call_tool`、`save_state` / `load_state`、`run`，最后是入口。）

```python
if __name__ == "__main__":
    build_db()
    q = os.environ.get("QUESTION", "847 最近三天投放怎么样？")
    print(f"== 问题：{q} ==")
    state, answer = run(q)
    print(f"== 结束状态：{state} ==")
    print(answer)
```

### 制造四种真实故障

我写了一个「故障注入代理」站在真实模型接口前面——**它返回的 500 是真的 HTTP 500，超时是真的超时**，不是伪造的异常：

```python
class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        _hits["n"] += 1
        n = _hits["n"]
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))

        if PLAN == "fail2" and n <= 2:
            self._reply(500, json.dumps({"error": {"message": "injected 500"}}).encode())
            return

        if PLAN == "slow":
            time.sleep(8)                      # 拖到客户端超时

        req = urllib.request.Request(
            REAL_BASE + self.path, data=body,
            headers={"Authorization": f"Bearer {REAL_KEY}", "Content-Type": "application/json"},
        )
        ...
```

四种故障的实测结果：

| 故障 | 怎么造的 | Agent 的反应 |
|---|---|---|
| **真 500** | 代理前两次请求返回 500 | 重试 2 次（等 0.70s、1.20s）→ **成功** |
| **真超时** | 代理先睡 8 秒，客户端只等 3 秒 | 重试 2 次全超时 → `FAILED` |
| **真连不上** | 端口 9999 没人监听 | 重试 2 次全失败 → `FAILED` |
| **真 404** | 真实接口 + 不存在的模型名 | **一次都没重试** → `FAILED` |

### 强杀进程，看能不能接上

```text
== 问题：847 最近三天投放怎么样？ ==
  [全新] 没有可用检查点
    [状态] READY → THINKING
    [状态] THINKING → ACTING
  步骤1: query_ad_report({"adv_id": 847, "days": 3}) -> {"adv_id": 847, ...
    [演示] 第 1 步结束，对自身发 SIGKILL（模拟被强杀）
```

进程在这里被 **SIGKILL** 干掉，退出码 137。磁盘上留下：

```text
  状态   : THINKING   ← 不是 PAUSED，因为没机会写
  已完成 : 1 步
  消息数 : 3 条
```

重新运行：

```text
  [恢复] 读到检查点：状态 THINKING，已完成 1 步，从第 2 步接着跑
    [状态] READY → THINKING
    [状态] THINKING → DONE
== 结束状态：DONE ==
```

**没有重跑第 1 步，直接接着往下。** 注意第二行——它一上来就是 `THINKING`，因为第 1 步的结果（工具返回值）已经在 `msgs` 里了，模型看到它就能直接作答。

### Ctrl+C，优雅暂停

```text
    [演示] 第 1 步结束，对自身发 SIGINT（相当于 Ctrl+C）
    [状态] ACTING → PAUSED
  [中断] 已存档到检查点（1 步），下次运行会接上
== 结束状态：PAUSED ==
[已暂停于第 1 步]
```

重新运行：

```text
  [恢复] 读到检查点：已完成 1 步，从第 2 步接着跑
    [状态] READY → THINKING
    [状态] THINKING → DONE
== 结束状态：DONE ==
```

**两种中断（强杀 / Ctrl+C）现在都能接上**——但这是修了第六节那个 bug 之后才成立的。

## 八、常见坑

**① 只认 `PAUSED` 的恢复逻辑**（我自己踩的）

强杀的进程写不下 `PAUSED`。恢复判据只能反过来写：**非终态皆可续**。第六节有完整经过。

**② 重试把故障放大**

服务端已经过载了，你的重试让它更糟。防线有三道：**退避**（别立刻打回去）、**抖动**（别让所有客户端同时打回去）、**上限**（`max_retries` 到了就放弃）。少任何一道，重试就从「救火」变成「火上浇油」。

**③ 超时设太长**

`timeout=600` 看着很宽容，实际是**一个卡住的请求能让整个任务停十分钟**。超时要按「这个操作正常该多久」来定，不是按「最多能忍多久」。

**④ 检查点不是原子写的**

直接覆盖写，崩在写一半会留下残缺 JSON，下次启动解析失败——比没有检查点更糟。先写临时文件再 `os.replace`。

**⑤ 吞异常**

```python
try:
    out = call_tool(name, args)
except Exception:
    out = "{}"          # ← 错得最隐蔽的一种
```

这意味着工具失败了，模型却收到一个「查询成功但没数据」，然后基于这个错误前提继续推理。**要吞就必须带上原因**：

```python
try:
    out = call_tool(name, args)
except Exception as e:
    kind, why = categorize(e)
    out = json.dumps({"error": why}, ensure_ascii=False)
```

**⑥ MCP 服务端拉不起来**

顺着 03 篇的话头：把客户端指向一个不存在的服务端脚本，实测是这样——

```text
  客户端 readline() 拿到 : ''    ← 空字符串！不是崩溃，是「什么都没有」
  子进程退出码           : 2
  子进程最后一行 stderr  : ...can't open file '...': [Errno 2] No such file or directory
```

**最迷惑的地方在于：它不是抛异常，是安静地返回一个空字符串。**（日志走 stderr 是对的，见名词解释里那条；但你的客户端必须自己判。）

紧接着 `json.loads('')` 会炸：

```text
    JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

**正确的做法是把它当「启动失败」处理**：先判空 / 先看退出码，给一句能看懂的报错。而且启动失败属于**可重试**——子进程起不来常常是临时的（资源紧张、端口占用），跟「404 模型名不存在」不是一回事。

## 九、下一步

到这一篇，你的 Agent 已经能查真数据（01 / 03）、有记忆（02）、跑得稳（本篇）。

留下的缺口是**它只有一个**。

现在这个 Runtime 从头到尾处理的是一个任务、一条 `msgs`、一个模型调用序列。但如果任务本身需要「同时查三个维度，然后汇总」，单线程地一个个查就是三倍的时间——而它们本来可以并行。

更麻烦的是分工：一个 Agent 既要想策略、又要查数据、还要写报告，提示词会越写越长，边界越来越糊。

**补在哪**：《Multi-Agent 实战》——怎么把一个 Agent 拆成几个各有明确职责的 Agent，它们之间怎么交接、怎么汇总、以及拆开之后**多出来的失败面**（一个子 Agent 挂了，整条链路怎么办）。

:::info 与基础篇的关系
基础篇《Agent Runtime》→ 讲 **Runtime 的职责与组成**；本篇 → 讲**这些职责怎么落地成代码、以及落地时会踩什么坑**。
:::

:::note 关于文中的运行结果
本篇所有输出都是**实际运行结果**（模型用火山方舟的 `deepseek-v4-1-flash` 跑出）。
「真 500」是中间一个代理真的返回 HTTP 500，「真超时」是服务端真的睡了 8 秒，
「真 404」是真实接口对不存在的模型名回的 404。
代码只用 Python 标准库，不依赖任何第三方包。
:::
