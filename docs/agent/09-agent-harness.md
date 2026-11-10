---
title: Agent Harness
sidebar_position: 11
---

:::tip 先看结论
**Agent = Model + Harness**。Harness 就是「**模型之外的一切**」——执行循环、工具、记忆、上下文管理、权限、可观测性，全算。

它不是 Runtime 的同类项，而是**它们的总称**。这篇把前面讲过的所有部件收束到一起，回答一个问题：**这些零件装成的整台机器，叫什么。**
:::

## 这篇解决什么问题

前面几篇我们分别讲了 LLM、Memory、Tools、Runtime、Planner / Controller。

但你可能有个疑问：**这些部件合在一起，叫什么？**

答案就是 Harness。

这个词在 2026 年成了行业热词。有人说：

> **2025 是 agents 的年份，2026 是 agent harnesses 的年份。**

这篇讲清楚三件事：它是什么、包含什么、为什么它比模型更值得你花时间。

## 一、一句话定义

LangChain 的 Vivek Trivedy 在 2026 年初提出的公式，现在已经是行业共识：

```
Agent = Model + Harness
```

翻译过来：**Agent 不是一个裸模型，而是「模型 + 外挂系统」。**

AWS 那篇讲得更直白：

> **If you're not the model, you're the harness.**
> 工具、记忆、提示词、编排、可观测性、护栏、路由、部署——全是 harness。

微软官方文档的定义（Agent Framework）：

> An agent harness is the **runtime scaffolding** that turns a language model into an agent that can perform work. It drives model and tool calls, manages conversation state and context, applies approval policies, and can keep the agent progressing through a multistep task.

### 一个比喻：发动机和汽车

这是最容易理解的入口：

> **模型是发动机。Harness 是底盘、方向盘、刹车、仪表盘、安全带。**
>
> 发动机提供动力，但你不能把一台光秃秃的发动机交给家人开。
> 一台好发动机，不保证是一台好车。

### 这个词原本的意思

Harness 在英文里是「**马具**」——套在马身上、让它能拉车干活的那一整套装备（马鞍 + 缰绳 + 马蹄铁）。

用在 Agent 语境里意思一样：**套在模型外面、让模型能真正干活的那一整套系统。**

## 二、Harness 包含什么

按用途分两半（AWS 那篇的分类）：

| 开发侧（让模型能做更多） | 运维侧（让它稳定可靠） |
|---|---|
| 记忆（跨会话） | 可观测性 |
| 工具 / MCP | 评测 |
| 检索与上下文 | 护栏 |
| 系统提示词 | 路由 |
| 规划 | 监控（漂移、成本） |
| 编排 | 部署与扩缩容 |

**微软官方的 Harness 能力清单**（Agent Framework）可以作为对照——它默认就带上这些：

| 能力 | 说明 |
|---|---|
| 函数调用 | 带可配置的每请求迭代上限 |
| 历史持久化 | 每次模型调用后保存 |
| 上下文压缩 | 给 token 上限时启用 |
| 待办追踪 | 默认开启 |
| 计划 / 执行模式 | 默认开启 |
| 文件记忆与文件访问 | 会话文件记忆默认开 |
| 工具审批 | 常设审批 + 自动审批规则 |
| 可观测性 | OpenTelemetry，默认开 |
| Web 搜索 | 所选客户端支持时默认加 |
| 后台 Agent | 可选的子 Agent 并行委派 |

**注意这张表**——它列的几乎全是「模型之外」的事。这印证了那个说法：

> 把每个能力标上「模型」或「harness」，你会发现分工极度不对称：**只有少数几行是模型，其余全是 harness。**

## 三、它在 Agent 架构里的位置

**这是最容易搞混的地方**，也是最值得说清的。

常见的错误说法是把它跟 Runtime 并列：

```
❌ 错的：
Planner = 制定计划
Controller = 控制流程
Runtime = 执行动作
Harness = 承载整个系统运行      ← 并列在这，矛盾
```

**为什么矛盾**：如果 Harness 是「承载整个系统运行」，那它**包含** Runtime —— 一个容器不能被列在它装的东西旁边。

正确的层级关系是**包含**，不是并列：

```
✅ 对的：

┌─ Harness（模型之外的一切）────────────────────┐
│                                              │
│   ┌─ 开发侧 ────────────────────────────┐    │
│   │  执行循环 · Tools · Memory           │    │
│   │  上下文管理 · Planner / Controller   │    │
│   │  Multi-Agent 编排                    │    │
│   └─────────────────────────────────────┘    │
│                                              │
│   ┌─ 运维侧 ────────────────────────────┐    │
│   │  Runtime · 权限 · 审计日志           │    │
│   │  评测 · 成本控制 · 可观测性          │    │
│   └─────────────────────────────────────┘    │
│                                              │
└──────────────────────────────────────────────┘
        ↑ 外面只剩一样东西：Model
```

**一句话**：**Runtime 是 Harness 里面的一层，不是它的邻居。**

（注意微软那篇的原话：*The Harness composes existing building blocks **rather than defining a separate agent runtime***——它明确说 harness 是把已有的构件组合起来，而**不是**另起一个 runtime。这正好印证了「包含」的关系。）

## 四、Harness 和 Agent 框架什么关系

这是最常见的混淆点。一句话：

> **框架是你用来「造」Harness 的工具；Harness 是「造出来的那个东西」。**
> 一个是**工具箱**，一个是**成品**。

成立于 2026 年的一篇 harness 系统性研究（arXiv 论文《Harness Engineering》，源码级分析了 11 个系统）专门辟了一节讲这个混淆，原话：

> **A harness is not an agentic framework.** A framework (LangChain, AutoGen, CrewAI) is a **library the developer imports to build an agent**; a harness is a **runtime the developer works inside of**.

| | 框架（Framework） | Harness |
|---|---|---|
| 是什么 | **库**（library） | **运行时**（runtime） |
| 你的动作 | `import` 它，**在它外面**写代码 | **在它里面**干活 |
| 例子 | LangChain、AutoGen、CrewAI | Claude Code、Cursor、Codex |

**关键在「方向」**：

```text
框架：你的代码 ──import──> 框架        （框架是你的依赖）
Harness：你的应用 ──跑在──> Harness    （你是 Harness 的一部分）
```

### 用那个公式看更清楚

回到 `Agent = Model + Harness`：

**框架不在这条公式里。** 因为框架不是 Agent 的组成部分——它是**你用来搭建它的工具**。

```text
框架   = 造车用的扳手和零件目录
Harness = 造出来的那台车
模型   = 发动机
```

### 但这条件正在模糊

那篇论文明确警告：**这条界线在 2025 年很清晰，在 2026 年正在模糊**（*The distinction was clean in 2025 and is dissolving in 2026—from both directions*）。

两个方向都在靠：

- **框架在变成 Harness**：LangChain 推出 Deep Agents，从「库」往「运行时」走；
- **Harness 在开源成框架**：Claude Code、Codex 把内核开源，你也能 import 了。

**所以别把这条线当铁律**——它是个正在移动的分界。选型时看的是「这东西让我怎么用它」，而不是它叫什么名字。

（本教程的框架清单见此：见「资料篇」的《开源 Agent 框架清单》一篇。）

## 五、这篇教程和 Harness 的关系

**这一节是这篇存在的真实理由。**

你可能没意识到：**你已经亲手搭过一个 Harness 的核心骨架了。**

回头看进阶篇那 8 篇——每一篇都在给你的 Harness 加一个部件：

| 进阶篇 | 加的是 Harness 的哪个部件 |
|---|---|
| 01 手写一个最小 Agent 循环 | **执行循环 + 工具** |
| 02 Memory 实战 | **记忆** |
| 03 Tool Calling 实战 | **工具 / MCP** |
| 04 Agent Runtime 实战 | **运行时** |
| 05 Multi-Agent 实战 | **编排** |
| 06 接真实工具 | **集成** |
| 07 评测你的 Agent | **评测** |
| 08 框架深挖 | **框架选型** |

基础篇那几篇讲的 LLM / Memory / Tools / Runtime / Planner，是这些部件的**概念**；进阶篇是它们的**实现**。

**八篇加完，一个 Harness 的核心骨架就搭好了。** 只是当时我们没用这个词而已。

生产级实现（Claude Code、Cursor、Codex）还会在此基础上叠加：文件系统沙箱、浏览器交互、Git 集成、模型路由等。**但骨架是一样的。**

**所以 Harness 这个概念的位置是**：它是**收纳箱**，把前面所有分散的部件装进一个名字里。理解了它，你再看任何 Agent 产品，都能问出一句：

> 「它的 Harness 里，哪些部件做得好，哪些是缺的？」

## 六、为什么它比模型更值得投入

最常见的反驳是：

> 「Harness 当然有用——**但等模型变聪明，这些活儿不就白干了吗？**」

**先承认对的部分**：确实有一部分会被模型吸收。上下文管理的技巧、部分提示词工程，正在被新模型吃掉。**假装不会发生是不诚实的。**

**但证据显示**：同样的模型，只换 Harness，效果能差出一大截。

下面几条来自 AWS Builder Center 的整理（作者在 AWS Summit Hong Kong 2026 的分享），**我照实转述，未独立验证**：

| 案例 | 只改 Harness，模型不变 | 结果 |
|---|---|---|
| **Vercel v0** | 工具从 15 个砍到 2 个（bash + 文件系统） | 准确率 **80% → 100%**，token 成本 **-37%**，响应快 **3.5 倍** |
| **LangChain**（Terminal Bench 2.0） | 加了自检循环、完成前检查清单、循环检测 | 得分 **52.8% → 66.5%**（约从 top 30 到 top 5） |
| **Hebia** | 用小模型 + harness 优先的搭法 | 比旗舰模型通过率更高、来源标注更好，**成本更低** |

**第一条特别反直觉**：**减少能力反而变好了**——因为上下文里塞太多东西会「腐烂」（陈旧、降准、变慢）。

**还有个总结说得很好**：

> 一个**小模型 + 好 harness**，能打赢**大模型 + 差 harness**。

## 七、一句话总结

**模型负责「聪明」，Harness 负责「能干成事」。**

模型在商品化（大家都能调到差不多的模型），**Harness 才是差异化所在**——它也是你作为工程师真正能持续投入的地方。

## 八、下一步

回到进阶篇，按顺序把 8 篇跑一遍——**你搭的就是一个 Harness**。

或者直接看 [Multi-Agent 实战](./jinjie/multi-agent-practice)——那是 Harness 里「编排」这一块的具体实现。

:::info 本篇参考
- LangChain / Vivek Trivedy 的 **Agent = Model + Harness** 公式（2026 年初提出，现为行业通行说法）
- AWS Builder Center《Agent Harness: Where Engineers Add Value When Models Keep Getting Smarter》
- 微软官方文档《Agent Harness》（Agent Framework）——用于交叉印证能力清单
:::
