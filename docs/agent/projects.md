---
title: 开源 Agent 项目清单
sidebar_position: 2
---

# 开源 Agent 项目清单

项目（Project / Runtime）是**拿来「用」或「学」的成品**——装好就能跑，也可以读源码学习别人的工程思路。

| 项目 | 仓库 | 一句话 |
|------|------|--------|
| [ThinCoder](https://github.com/xinbo-tech/thincoder) | xinbo-tech | MIT、零依赖 Node.js、三端（CLI / VS Code / 桌面）+ ACP，工程洁癖代表作 |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | deepseek-ai | MIT、「一切皆插件」、基于 Cordis 微内核，连 agent 主循环都可替换 |
| Claude Code | Anthropic | 闭源，Anthropic 的旗舰编码 Agent |
| Codex | OpenAI | 闭源（CLI 部分开源），OpenAI 的编码 Agent |
| OpenCode / Pi Agent | 开源社区 | 轻量开源编码 Agent，基准测试里的黑马 |

## 两个值得深挖的极端

- **ThinCoder**：走「零依赖、极简」路线——能不用第三方库就不用，全靠 Node 标准库；
- **DeepSeek Harness**：走「一切皆插件、极灵活」路线——模型、工具、会话、甚至 agent 主循环都能换。

一个极简、一个极灵活，正好是两个极端，对比着研究会很有价值。
