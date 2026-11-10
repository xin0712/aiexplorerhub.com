---
title: 计算机系统
sidebar_position: 3
description: CS:APP、OSTEP、计算机网络、DDIA —— 理解机器如何运行
---

# 计算机系统

这个领域回答：**你的代码从写下到跑起来，中间发生了什么。**

对做 Agent 的人来说，这一块决定了你排查问题的上限——**不懂系统，遇到问题只能猜。**

## Computer Systems: A Programmer's Perspective (CS:APP)

**Randal E. Bryant、David R. O'Hallaron** · 第 3 版

**领域**：计算机系统

CMU 计算机系统课程的**核心教材**，涵盖二进制、汇编、CPU、内存、链接、进程、虚拟内存和并发。

**定位**：建立计算机系统整体认知的核心教材，**难度较高**。

> 这本书的特点是：**每个概念都告诉你"这对写程序意味着什么"**。

### 配套资源

CMU 官方提供课程实验（Lab），**做实验比读书更重要**。这是少数"光读没用"的书。

## Operating Systems: Three Easy Pieces (OSTEP)

**Remzi H. Arpaci-Dusseau、Andrea C. Arpaci-Dusseau**

**领域**：操作系统

围绕**虚拟化、并发、持久化**三大主题讲解进程、线程、内存管理、锁和文件系统。

**定位**：操作系统原理**非常值得学习**的一本经典现代教材。

> **作者提供免费在线版**——这是它比其他 OS 教材更受欢迎的原因之一。

## Computer Networking: A Top-Down Approach

**James F. Kurose、Keith W. Ross** · 第 9 版

**领域**：计算机网络

从 HTTP、DNS、TCP/IP、路由讲到网络协议与网络安全。

**定位**：了解**浏览器、服务器、API、网络请求和分布式应用**的基础教材。

> "自顶向下"的顺序是它的特色——先讲你天天用的 HTTP，再往下挖。

## Designing Data-Intensive Applications (DDIA)

**Martin Kleppmann** · 初版 2017 · 第 2 版 2026（与 Chris Riccomini 合著）

**领域**：数据库与分布式系统

讲数据存储、数据库、分布式事务、复制、一致性与**架构取舍**。

**定位**：尚不像 SICP 那样有数十年历史，但**已是现代数据系统设计极具代表性的著作**。

> 这本书最大的价值是**讲清了各种方案的代价**——没有银弹，只有取舍。

---

## 这个领域怎么排

| 顺序 | 书 | 策略 |
|---|---|---|
| 1 | CS:APP | 核心章节 + 做实验 |
| 2 | OSTEP | 三大主题通读（有免费版） |
| 3 | Computer Networking | 网络基础精读 |
| 4 | DDIA | 分布式系统选读 |

:::tip 提醒
**CS:APP 和 OSTEP 有重叠**（都在讲内存、并发）。按需选一本精读，另一本挑缺的部分补。
:::
