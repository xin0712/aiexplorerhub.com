---
title: 开源 Agent 框架清单
sidebar_position: 1
---

# 开源 Agent 框架清单

框架（Framework / SDK）是**用来「造」Agent 的**——你基于它写代码，拼出一个能执行任务的智能体。

下面是 2026 年仍在活跃更新的主流框架（更新于 2026-10，生态变化快，选型前建议再核实）：

| 框架 | 出品方 | 开源地址 | 一句话选它 |
|------|--------|---------|-----------|
| LangGraph | LangChain | [github](https://github.com/langchain-ai/langgraph) | 要可恢复、可审计、复杂流程，生产首选 |
| CrewAI | CrewAI Inc | [github](https://github.com/crewAIInc/crewAI) | 要快速搭「研究员 + 写手」这类团队 |
| OpenAI Agents SDK | OpenAI | [github](https://github.com/openai/openai-agents-python) | 全栈 OpenAI，想要最原生 |
| Claude Agent SDK | Anthropic | [github](https://github.com/anthropics/claude-agent-sdk-python) | 全栈 Claude（Python 版 MIT 开源）|
| AgentScope | 阿里（AgentScope 团队）| [github](https://github.com/agentscope-ai/agentscope) | 多智能体、阿里生态 |
| QwenPaw | 阿里（AgentScope 团队）| [github](https://github.com/agentscope-ai/QwenPaw) | 本地优先的个人 Agent 框架（Apache-2.0）|
| Spring AI Alibaba | 阿里 | [github](https://github.com/alibaba/spring-ai-alibaba) | Java 技术栈 |
| Microsoft Agent Framework | 微软 | GitHub 可搜 | .NET 或 Azure 生态 |
| Google ADK | Google | GitHub 可搜 | Google 生态 |
| Mastra | Mastra | GitHub 可搜 | TypeScript 状态机 |
| PydanticAI | Pydantic | GitHub 可搜 | 类型安全、轻量 |

:::warning AutoGen 已进维护模式
[AutoGen](https://github.com/microsoft/autogen) 于 2025-09 起不再出新功能，微软官方建议迁到 Microsoft Agent Framework。**新项目别再选 AutoGen。**
:::

## 注意：有两个不是框架，是 Harness

下面两个名字里带 Harness，**按定义它们不是「你 import 的库」，而是「你跑在里面的运行时」**——
不要拿它们当框架来选型。两者区别见 [Agent Harness](./agent-harness) 的「Harness 和 Agent 框架什么关系」一节。

| Harness | 出品方 | 开源地址 | 一句话选它 |
|------|--------|---------|-----------|
| DeepSeek Harness | DeepSeek | [github](https://github.com/deepseek-ai/deepseek-harness) | 「一切皆插件」、基于 Cordis 微内核 |
| Codex Harness | OpenAI | [github](https://github.com/openai/codex) | Rust 内核、Apache-2.0、生产级嵌入 |

> 提醒：这条界线**正在模糊**（2026 年两个方向都在靠）——有些框架在长出运行时能力，
> 有些 Harness 把内核开源成了可 import 的库。选型时看的是「这东西让我怎么用它」。

## 怎么选

- 要**可恢复、可审计的复杂流程** → LangGraph；
- 要**快速搭角色团队** → CrewAI；
- 已经**全栈 OpenAI / Claude** → 对应官方 SDK；
- 要 **TypeScript + 状态机** → Mastra；
- 要**类型安全** → PydanticAI；
- 要**阿里生态 / 本地优先个人 Agent** → AgentScope / QwenPaw；
- 想要**「一切皆插件」的极致灵活** → 那是 Harness（DeepSeek Harness），不是框架，用它意味着你跑在它里面而非 import 它。
