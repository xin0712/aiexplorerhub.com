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
| DeepSeek Harness | DeepSeek | [github](https://github.com/deepseek-ai/deepseek-harness) | 「一切皆插件」、基于 Cordis 微内核 |
| Spring AI Alibaba | 阿里 | [github](https://github.com/alibaba/spring-ai-alibaba) | Java 技术栈 |
| Microsoft Agent Framework | 微软 | GitHub 可搜 | .NET 或 Azure 生态 |
| Google ADK | Google | GitHub 可搜 | Google 生态 |
| Mastra | Mastra | GitHub 可搜 | TypeScript 状态机 |
| PydanticAI | Pydantic | GitHub 可搜 | 类型安全、轻量 |

:::warning AutoGen 已进维护模式
[AutoGen](https://github.com/microsoft/autogen) 于 2025-09 起不再出新功能，微软官方建议迁到 Microsoft Agent Framework。**新项目别再选 AutoGen。**
:::

## 怎么选

- 要**可恢复、可审计的复杂流程** → LangGraph；
- 要**快速搭角色团队** → CrewAI；
- 已经**全栈 OpenAI / Claude** → 对应官方 SDK；
- 要 **TypeScript + 状态机** → Mastra；
- 要**类型安全** → PydanticAI；
- 要**阿里生态 / 本地优先个人 Agent** → AgentScope / QwenPaw；
- 要**「一切皆插件」的极致灵活** → DeepSeek Harness。
