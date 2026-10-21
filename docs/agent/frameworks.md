---
title: 开源 Agent 框架清单
sidebar_position: 1
---

# 开源 Agent 框架清单

框架（Framework / SDK）是**用来「造」Agent 的**——你基于它写代码，拼出一个能执行任务的智能体。

下面是 2026 年仍在活跃更新的主流框架（更新于 2026-10，生态变化快，选型前建议再核实）：

| 框架 | 出品方 | 定位 | 一句话选它 |
|------|--------|------|-----------|
| [LangGraph](https://github.com/langchain-ai/langgraph) | LangChain | 图 / 状态机编排 | 要可恢复、可审计、复杂流程，生产首选 |
| [CrewAI](https://github.com/crewAIInc/crewAI) | CrewAI Inc | 角色 + 任务多智能体 | 要快速搭「研究员 + 写手」这类团队 |
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | OpenAI | 官方原语（Agent / Handoff / Guardrail）| 全栈 OpenAI，想要最原生 |
| Claude Agent SDK | Anthropic | 官方原语 | 全栈 Claude |
| Microsoft Agent Framework | 微软 | AutoGen + Semantic Kernel 统一继承者 | 要 .NET 或 Azure 生态 |
| Google ADK | Google | Gemini 原生 | Google 生态 |
| Mastra | TS 社区 | 状态机 + Suspend/Resume | TypeScript 技术栈 |
| PydanticAI | Pydantic | 类型安全、轻量 | 想要类型检查 + 少抽象 |

:::warning AutoGen 已进维护模式
[AutoGen](https://github.com/microsoft/autogen) 于 2025-09 起不再出新功能，微软官方建议迁到 Microsoft Agent Framework。**新项目别再选 AutoGen。**
:::

## 怎么选

- 要**可恢复、可审计的复杂流程** → LangGraph；
- 要**快速搭角色团队** → CrewAI；
- 已经**全栈 OpenAI / Claude** → 对应官方 SDK；
- 要 **TypeScript + 状态机** → Mastra；
- 要**类型安全** → PydanticAI。
