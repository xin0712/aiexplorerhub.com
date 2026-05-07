---
title: models
sidebar_position: 2
---



官方文档：  
[https://deepmind.google/models/](https://deepmind.google/models/)



## 一、文本模型（Text Models）

| 类型 | 系列               | 模型名称                      | 发布日期    | 价格                       | 主要特点                    | 使用平台                                              | API 平台               |
| -- | ---------------- | ------------------------- | ------- | ------------------------ | ----------------------- | ------------------------------------------------- | -------------------- |
| 文本 | **Gemini 系列**    | **Gemini 3 Pro（3 Pro）**   | 2025-11 | 按 token 计费（需查 AI Studio） | 最新旗舰级大模型，长上下文、多模态、强推理能力 | Gemini App、Google AI Studio、Antigravity、Vertex AI | Gemini API、Vertex AI |
| 文本 | Gemini 系列        | **Gemini 2.5 Flash**      | 2024-?? | 低成本（token 便宜）            | 高速、低延迟、适合大规模调用          | Gemini App / AI Studio / Vertex                   | Gemini API           |
| 文本 | Gemini 系列        | **Gemini 2.5 Flash-Lite** | 2024    | 极低成本                     | 面向移动端、轻量推理场景            | AI Studio、移动端 SDK                                 | Gemini API           |
| 文本 | **Gemma 系列（开源）** | Gemma 3                   | 2025-10 | 免费开源                     | SOTA 轻量开源模型             | 本地运行、Colab、AI Studio                              | 开源模型（HuggingFace 等）  |
| 文本 | Gemma 系列         | Gemma 3n                  | 2025-10 | 免费开源                     | 更小参数、更高效推理              | 本地运行 / Colab                                      | 开源 API               |
| 文本 | Gemma 系列         | T5Gemma                   | 2024    | 免费                       | 适合文本生成、翻译               | 本地/Colab                                          | 开源                   |
| 文本 | Gemma 系列         | EmbeddingGemma            | 2024    | 免费                       | 高性能 embedding 模型        | 本地/Colab                                          | 开源                   |

## 二、图片模型（Image Models）

| 类型 | 系列                  | 模型名称                                | 发布日期    | 价格               | 主要特点              | 使用平台                                 | API 平台           |
| -- | ------------------- | ----------------------------------- | ------- | ---------------- | ----------------- | ------------------------------------ | ---------------- |
| 图片 | **Gemini Image 系列** | Gemini 3 Pro Image（Nano Banana Pro） | 2025-11 | 按图片计费（AI Studio） | 最先进图像生成/编辑模型，可控性强 | Gemini App、AI Studio、Vertex          | Gemini Image API |
| 图片 | Gemini Image 系列     | 2.5 Flash Image                     | 2024    | 低成本              | 高速图片生成            | Gemini App、AI Studio、Vertex          | Gemini API       |
| 图片 | **Imagen 系列**       | Imagen                              | 持续更新    | 按图片计费            | 强写实风格与创意生成能力      | Gemini App、Whisk 工具、AI Studio、Vertex | Imagen API       |

## 三、视频模型（Video Models）

| 类型 | 系列         | 模型名称                 | 发布日期      | 价格      | 特点                              | 使用平台                             | API 平台    |
| -- | ---------- | -------------------- | --------- | ------- | ------------------------------- | -------------------------------- | --------- |
| 视频 | **Veo 系列** | Veo                  | 2025      | 按视频长度计费 | Google SOTA 视频生成模型，支持电影级运动和场景过渡 | Gemini App、Flow、AI Studio、Vertex | Veo API   |
| 视频 | Veo 系列     | **Veo 3.1（最新）**      | 2025-10   | 同上      | 更高逼真度、动作一致性提升                   | Flow、AI Studio                   | Veo API   |
| 视频 | Gemini 生态  | **Project Astra**    | 2024–2025 | -（实验模型） | 实时视觉理解、人机交互                     | Google Labs（等待名单）                | 暂无开发者 API |
| 视频 | Gemini 生态  | **Gemini Diffusion** | 2025      | -       | 基于扩散架构的图像/视频生成                  | 等待名单                             | 暂无        |

## 四、音乐模型（Music Models）

| 类型 | 系列           | 模型名称  | 发布日期      | 价格      | 特点                          | 使用平台                        | API 平台    |
| -- | ------------ | ----- | --------- | ------- | --------------------------- | --------------------------- | --------- |
| 音乐 | **Lyria 系列** | Lyria | 2024–2025 | 按生成长度计费 | Google 最新音乐生成模型，可生成多风格编曲、歌声 | MusicFX DJ、AI Studio、Vertex | Lyria API |

## 五、音频模型（Audio Models）

（Google 归类在 Gemini 生态中）

| 类型    | 系列        | 模型名称             | 发布日期      | 特点          | 使用平台             | API        |
| ----- | --------- | ---------------- | --------- | ----------- | ---------------- | ---------- |
| 音频/语音 | Gemini 生态 | **Gemini Audio** | 2024–2025 | 高级语音对话、音频生成 | AI Studio、Vertex | Gemini API |

## 六、机器人与动作模型（Vision-Language-Action）

| 类型     | 系列        | 模型名称                | 使用场景               | 平台                 |
| ------ | --------- | ------------------- | ------------------ | ------------------ |
| 动作/机器人 | Gemini 生态 | **Gemini Robotics** | VLM + Action 控制机器人 | 等待名单（Google Forms） |
| 其他     | Gemini 生态 | **Project Mariner** | 通用 AI 助理的未来方向      | Google Labs        |

## 七、生成内容的安全模型

| 类型   | 系列      | 模型名称    | 特点        | 使用平台 |
| ---- | ------- | ------- | --------- | ---- |
| 内容鉴别 | SynthID | SynthID | AI 内容水印标记 | 等待名单 |

## 总结：Google 模型体系一图看懂

```text
📌 文本：Gemini、Gemma（开源）
📌 图片：Gemini Image、Imagen
📌 视频：Veo、Astra、Diffusion
📌 音乐：Lyria
📌 音频：Gemini Audio
📌 机器人：Gemini Robotics
📌 内容水印：SynthID
```


