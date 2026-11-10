---
title: AI 与 Agent
sidebar_position: 5
description: AI 学科体系与多智能体系统的经典理论著作
---

# AI 与 Agent

**这一块是理解 Agent 的理论根基。**

## Artificial Intelligence: A Modern Approach (AIMA)

**Stuart Russell、Peter Norvig** · 初版 1995 · 第 4 版

**领域**：人工智能（学科全景）

> **我认为这是理解完整 AI 学科体系最值得拥有的一本书。**

涵盖 Intelligent Agents、搜索、推理、知识表示、规划、概率决策、机器学习和强化学习。

**定位**：官方介绍称其被**全球超过 1500 所学校采用**。

**伯克利官方原著网站**：aima.cs.berkeley.edu（有配套代码和习题）

### 为什么它重要

它把 AI 当成一个**完整学科**来讲，而不是一堆技术的拼盘。

**对做 Agent 的人尤其重要**——书里的「Intelligent Agents」章节，是整个 Agent 概念的最早系统化表述。

### 怎么读

不必从头读到尾。**对 Agent 方向，重点看这几部分**：

| 章节主题 | 为什么看 |
|---|---|
| Intelligent Agents | Agent 概念的源头定义 |
| 搜索 | 规划与决策的基础 |
| 规划 | 任务分解的理论 |
| 概率决策 | 不确定环境下的选择 |
| 强化学习 | 与 Sutton & Barto 互补 |

## An Introduction to MultiAgent Systems

**Michael Wooldridge** · 第 2 版 2009

**领域**：多智能体系统

多智能体系统领域的经典教材，涵盖 **Agent 自主性、协作、通信、协调、谈判和博弈**。

**定位**：牛津大学出版社/John Wiley 出版，是这个子领域公认的教科书。

:::warning 特别注意
这是**传统 Multi-Agent Systems 理论**（源自分布式 AI 研究），**不是现代基于 LLM 的 Agent 框架使用指南**。

但**理论基础很值得研究**——「多个智能体怎么协作、怎么协调、冲突怎么解决」这些问题，跟今天做多 Agent 系统面临的挑战是同一批。
:::

### 跟现代 LLM Agent 的关系

| 传统 MAS 理论 | 现代 LLM Agent |
|---|---|
| 智能体 = 理性决策者 | 智能体 = LLM + 工具 + 循环 |
| 协作协议、谈判机制 | 提示词编排、角色分工 |
| 形式化验证 | 经验性调优 |

**理论没变的是"多智能体协作的核心难题"**：通信开销、目标冲突、协调成本。这些今天依然存在。

---

## 这个领域怎么排

| 顺序 | 书 | 策略 |
|---|---|---|
| 1 | AIMA | Agent、搜索、规划、决策章节 |
| 2 | MultiAgent Systems | 多智能体协作理论，按需 |

:::tip 一句话
**AIMA 给你 AI 的全景，Wooldridge 给你多智能体的理论基础。** 两本都不教框架用法，教的是「为什么」。
:::
