---
title: 机器学习与深度学习
sidebar_position: 4
description: 从概率模型到神经网络再到语言模型的经典教材
---

# 机器学习与深度学习

这一部分的重点：**从数学、概率和神经网络，逐渐过渡到 Transformer 和大语言模型。**

## Pattern Recognition and Machine Learning (PRML)

**Christopher M. Bishop** · 2006

**领域**：机器学习理论

机器学习理论的经典教材，重点是**概率模型、贝叶斯推断、分类、回归和近似推断**。

**定位**：曾被斯坦福 CS229 课程列为推荐读物。**数学要求较高**。

> 如果你想知道「机器学习为什么是这样」，而不是「怎么调包」，这本书是答案。

### 前置要求

需要**线性代数、概率论、微积分**基础。建议配合 *Mathematics for Machine Learning* 一起看（见下）。

## Deep Learning

**Ian Goodfellow、Yoshua Bengio、Aaron Courville** · 2016

**领域**：深度学习

深度学习的**代表性经典教材**，讲神经网络、反向传播、优化、正则化、序列建模等理论。

**定位**：这个领域公认的权威教材，作者是深度学习的三位奠基人。

> **官方提供免费在线版**（deeplearningbook.org）。

### 怎么读

- **第一部分（数学基础）**——补课用，不必逐页
- **第二部分（现代实践）**——核心，重点读
- **第三部分（研究）**——按需

## Speech and Language Processing

**Daniel Jurafsky、James H. Martin** · 第 3 版草稿（持续更新）

**领域**：自然语言处理

NLP 领域的经典教科书。新版涵盖**语言模型、Transformer、预训练、解码**等内容。

**定位**：**斯坦福官方提供免费在线版**，作者持续更新到第 3 版。

> 这本书的特殊价值：**它从传统 NLP 一路讲到 LLM**，能看到技术演进的完整脉络。

## Reinforcement Learning: An Introduction

**Richard S. Sutton、Andrew G. Barto** · 1998 · 第 2 版 2018

**领域**：强化学习

强化学习经典教材。涵盖**智能体与环境、奖励、策略、价值函数和决策过程**。

**定位**：对理解 **Agent 背后的序列决策理论**很重要。

:::warning 一个重要区分
这是**强化学习的理论基础**，**不等于现代 LLM Agent 工程教程**。

现代 Agent 大量使用「提示词 + 工具调用 + 循环」，跟经典 RL 的路径不完全一样。这本书帮你理解「智能体为什么这样做决策」，但不教你怎么写 Agent。
:::

## 并行参考：Mathematics for Machine Learning

**Deisenroth、Faisal、Ong** · 剑桥大学出版社

补**线性代数、微积分、概率和优化**。

**为什么建议并行读**：**数学薄弱会直接限制对深度学习、Transformer 的理解**——不是"学不会"，而是"看不懂推导过程"，只能停留在调包层面。

## 延伸：The Elements of Statistical Learning (ESL)

**Hastie、Tibshirani、Friedman**

统计学习领域**更偏数学、理论**的经典教材。建议在第一年之后深入研究。

---

## 这个领域怎么排

| 顺序 | 书 | 策略 |
|---|---|---|
| 并行 | Mathematics for ML | 全年参考，随时补数学 |
| 1 | Deep Learning | 重点读数学、神经网络、优化 |
| 2 | Speech and Language Processing | 精读语言模型与 Transformer |
| 3 | PRML | 数学要求高，可后置 |
| 4 | Reinforcement Learning | 理解 Agent 理论基础 |
| 后置 | ESL | 第一年之后 |
