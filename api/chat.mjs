/**
 * AI 助手后端（Vercel Serverless Function）。
 *
 * 放在根目录 api/ 下的文件会被 Vercel 自动变成一个接口：
 *   POST /api/chat  { messages: [{ role, content }] }  →  { reply: "..." }
 *
 * 用 .mjs 后缀 = 原生 ESM（Vercel 文档：无 "type":"module" 时 .js 会被编译成 CommonJS）。
 * API Key 只在这里读取（环境变量），永远不会发到浏览器。
 */

const API_KEY = process.env.AI_API_KEY;
const BASE_URL = process.env.AI_BASE_URL || 'https://api.deepseek.com/v1';
const MODEL = process.env.AI_MODEL || 'deepseek-chat';

// 系统提示词：限定助手的角色与边界
const SYSTEM_PROMPT = `你是「AI Explorer Hub」网站的 AI 学习助手，帮助读者理解本站的 Agent 教程。

回答要求：
- 用中文回答，简洁、直接、口语化，避免套话。
- 面向正在学 Agent 开发的读者，可以假设对方懂一点编程。
- 如果你不确定，就说不确定，不要编造。
- 代码示例用 Markdown 代码块，标明语言。
- 不要用破折号堆砌排比，不要每句都加粗。`;

// 会话限制：防止单次请求过大或过于费钱
const MAX_MESSAGES = 20;      // 最多保留多少轮历史
const MAX_CHARS = 4000;       // 单条消息最长字符数
const MAX_TOKENS = 2000;      // 单次回复上限

/** 简易限流：同一 IP 每分钟最多 N 次（内存态，实例级） */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_LIMIT) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  // 顺手清理过期条目，避免 Map 无限增长
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json; charset=utf-8'},
  });
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({error: 'Method not allowed'}, 405);
    }

    if (!API_KEY) {
      // 明确报错，不静默失败
      return json({error: '服务端未配置 AI_API_KEY，请联系站点管理员'}, 500);
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    if (rateLimited(ip)) {
      return json({error: '提问太频繁了，请等一分钟再试'}, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({error: '请求格式错误：不是合法 JSON'}, 400);
    }

    const incoming = Array.isArray(payload?.messages) ? payload.messages : [];
    if (incoming.length === 0) {
      return json({error: '没有收到任何消息'}, 400);
    }

    // 清洗：只保留 role/content，裁掉超长内容，限制轮数
    const cleaned = incoming
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({role: m.role, content: String(m.content ?? '').slice(0, MAX_CHARS)}))
      .slice(-MAX_MESSAGES);

    const messages = [{role: 'system', content: SYSTEM_PROMPT}, ...cleaned];

    let upstream;
    try {
      upstream = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          stream: false,
          max_tokens: MAX_TOKENS,
        }),
        signal: AbortSignal.timeout(55_000),
      });
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      return json({error: timedOut ? '模型响应超时，请重试' : '无法连接模型服务'}, 504);
    }

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('[chat] upstream error', upstream.status, detail.slice(0, 500));
      return json({error: `模型服务返回错误（${upstream.status}）`}, 502);
    }

    let data;
    try {
      data = await upstream.json();
    } catch {
      return json({error: '模型返回的内容无法解析'}, 502);
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      return json({error: '模型没有返回内容，请重试'}, 502);
    }

    return json({reply});
  },
};
