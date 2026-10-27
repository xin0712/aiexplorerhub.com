/**
 * build-knowledge.mjs — 把全站文章合成一份「知识库」文本，供 AI 助手全文注入。
 *
 * 产出：thincoder 无依赖，输出到 api/knowledge.generated.mjs（供 serverless 函数 import）。
 *
 * 为什么「全文注入」而不是向量检索：
 *   全站实质文章约 22 万字符 ≈ 12 万 token，DeepSeek 上下文 1M token，装得下。
 *   模型看到全文 ⇒ 不会被「检索没命中」坑到（检索式 RAG 的典型失败模式）。
 *   内容继续增长到装不下时，再换成检索式——那时前端零改，只换后端。
 *
 * 收录规则：只收「实质文章」（正文 ≥ MIN_CHARS），跳过占位空壳（「作者还在努力输出中」之类）。
 *
 * 用法：node scripts/build-knowledge.mjs
 */

import {readFileSync, writeFileSync, readdirSync, statSync, mkdirSync} from 'node:fs';
import {join, relative, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'api', 'knowledge.generated.mjs');

/** 判定「实质文章」的最小正文字符数——低于此值视为占位页 */
const MIN_CHARS = 1000;

/** 跳过这些目录（Docusaurus 自带示例，不是本站内容） */
const SKIP_DIRS = new Set(['tutorial-basics', 'tutorial-extras', '_archive', 'node_modules']);

/** 扫描 roots 下所有 .md / .mdx */
function collectFiles() {
  const out = [];
  for (const base of ['docs', 'blog']) {
    const basePath = join(ROOT, base);
    let exists = true;
    try { statSync(basePath); } catch { exists = false; }
    if (!exists) continue;

    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue;
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) { walk(p); continue; }
        if (!/\.mdx?$/.test(name)) continue;
        out.push({path: p, section: base});
      }
    };
    walk(basePath);
  }
  return out;
}

/** 解析 frontmatter（只取 title），返回 { title, body } */
function parse(raw, fallbackTitle) {
  let title = fallbackTitle;
  let body = raw;
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (m) {
    const fm = m[1];
    const t = /^title:\s*(.+)$/m.exec(fm);
    if (t) title = t[1].trim().replace(/^["']|["']$/g, '');
    body = raw.slice(m[0].length);
  }
  // 正文里若以 `# 标题` 开头，去掉（标题我们单独给）
  body = body.replace(/^\s*#\s+.+\r?\n/, '');
  return {title, body: body.trim()};
}

/** 文章在站点上的 URL（用于回答里标注出处） */
function urlFor(section, filePath) {
  const rel = relative(join(ROOT, section), filePath).replace(/\.mdx?$/, '');
  if (section === 'blog') {
    return `https://www.aiexplorerhub.com/blog/${basename(rel)}`;
  }
  return `https://www.aiexplorerhub.com/_hidden-docs/${rel}`;
}

const files = collectFiles();
const included = [];
const skipped = [];

for (const {path, section} of files) {
  const raw = readFileSync(path, 'utf8');
  const {title, body} = parse(raw, basename(path, '.md'));
  if (body.length < MIN_CHARS) {
    skipped.push({path: relative(ROOT, path), len: body.length});
    continue;
  }
  included.push({
    section,
    title,
    url: urlFor(section, path),
    source: relative(ROOT, path),
    body,
  });
}

// 按栏目分组输出，Agent 栏目排前面（助手主要服务对象）
const order = {docs: 0, blog: 1};
included.sort((a, b) => {
  const ga = a.source.startsWith('docs/agent') ? -1 : 0;
  const gb = b.source.startsWith('docs/agent') ? -1 : 0;
  if (ga !== gb) return ga - gb;
  if (order[a.section] !== order[b.section]) return order[a.section] - order[b.section];
  return a.source.localeCompare(b.source);
});

const parts = [];
parts.push('# AI ExplorER Hub 全站内容');
parts.push('');
parts.push(
  `本站共 ${included.length} 篇文章。以下每篇以「===== 标题 | URL =====」开头，正文紧随其后。` +
    `回答用户问题时，请优先依据这些内容；引用时说明来自哪一篇。`,
);
parts.push('');

for (const doc of included) {
  parts.push(`===== ${doc.title} | ${doc.url} =====`);
  parts.push(doc.body);
  parts.push('');
}

const knowledge = parts.join('\n');

// 输出成 ESM 模块（字符串字面量，避免运行时读文件——Vercel 函数里没有这些源文件）
const header = `/**
 * 本文件由 scripts/build-knowledge.mjs 自动生成，请勿手工编辑。
 * 生成时间: ${new Date().toISOString()}
 * 收录: ${included.length} 篇 / 跳过占位: ${skipped.length} 篇 / 共 ${knowledge.length} 字符
 */
`;

const out = `${header}export const KNOWLEDGE_TEXT = ${JSON.stringify(knowledge)};\n` +
  `export const KNOWLEDGE_STATS = ${JSON.stringify({
    articles: included.length,
    skipped: skipped.length,
    chars: knowledge.length,
    generatedAt: new Date().toISOString(),
  }, null, 2)};\n`;

mkdirSync(join(ROOT, 'api'), {recursive: true});
writeFileSync(OUT, out, 'utf8');

console.log(`✓ 已生成 ${relative(ROOT, OUT)}`);
console.log(`  收录文章: ${included.length} 篇`);
console.log(`  跳过占位: ${skipped.length} 篇`);
console.log(`  知识库字符数: ${knowledge.length.toLocaleString()}`);
console.log(`  估算 token: 约 ${Math.round(knowledge.length / 1.4).toLocaleString()}（中文约 1.4 字符/token）`);
