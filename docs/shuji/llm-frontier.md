---
title: 大模型与前沿
sidebar_position: 6
description: 当代代表性著作与 Agent 领域的四篇奠基论文
---

# 大模型与前沿

:::info 先说清楚
**这个领域还没有出现地位堪比 SICP、CLRS 的长期公认经典。**

原因很简单：LLM Agent 是近年的工程方向，**还没经过时间检验**。

所以这里的选法不同——**选有代表性的现代著作，再直接读奠基论文。**
:::

## 当代著作

### Hands-On Large Language Models

**Jay Alammar、Maarten Grootendorst** · 2024

从 **Transformer、Embedding 到模型训练、微调与应用实践**。

**定位**：偏实践，适合建立对 LLM 工作方式的直觉。

> 作者 Jay Alammar 的图解文章在业界流传很广，这本书延续了那种「把复杂东西画明白」的风格。

### AI Engineering

**Chip Huyen** · 2025 年前后

**模型选型、RAG、评测、部署、成本和生产级 AI 应用工程。**

**定位**：**从「会调用模型」到「能交付 AI 产品」之间缺的那一环。**

> 她上一本 *Designing Machine Learning Systems* 讲的是 ML 系统工程，这本转向了 LLM 应用工程。

## Agent 更应该读的四篇奠基论文

**论文比书更接近这个领域的思想源头。**

| 论文 | 年份 | 核心意义 |
|---|---|---|
| **Attention Is All You Need** | 2017 | Transformer 架构，当今一切的基础 |
| **Retrieval-Augmented Generation** | 2020 | RAG 的代表性早期研究 |
| **ReAct** | 2023 | 推理与行动交替执行 |
| **Toolformer** | 2023 | 语言模型自主使用工具 |

### 每篇为什么重要

**Attention Is All You Need（2017）**
提出了 Transformer——**今天所有主流大模型的架构基础**。不看这篇，你很难理解为什么模型能处理长文本、为什么要算 attention。

**Retrieval-Augmented Generation（2020）**
RAG 的奠基之作。**解决了"模型知识过时/不足"这个根本问题**——检索外部知识再生成。

**ReAct（2023）**
**推理（Reasoning）+ 行动（Acting）交替**。这是现代 Agent 循环的直接理论来源——「想一步、做一步、看结果、再想」。

**Toolformer（2023）**
让模型**自己学会什么时候该调用工具**，而不是靠人硬编码。

:::warning 提醒
**这四篇并不覆盖当今 Agent 工程的全部内容。**

这三年发展极快，涌现了大量新技术（多智能体编排、记忆系统、评测体系等）。

**但它们有助于理解今天许多框架背后的基本思想**——看懂这些，你就不容易被框架的表面 API 迷惑。
:::

---

## 怎么用这一块

| 材料 | 策略 |
|---|---|
| Hands-On LLMs | 核心实践章节 |
| AI Engineering | AI 工程核心章节 |
| 四篇论文 | 精读原文，配合实现 |

:::tip 三条原则
**经典书负责打底，原始论文负责理解思想来源，现代工程资料负责实现。**

三者配合，才既有深度又不脱离当下。
:::
