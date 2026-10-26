/**
 * ChatWidget — 全站悬浮的 AI 学习助手。
 *
 * 挂在 src/theme/Root.tsx 上（Docusaurus 的根组件），因此每个页面都能用。
 * 它只调用本站后端 /api/chat —— API Key 在服务端，前端接触不到。
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import styles from './styles.module.css';

type Role = 'user' | 'assistant';

type Message = {
  role: Role;
  content: string;
};

const STORAGE_KEY = 'aieh-chat-history';
const MAX_STORED = 40;

/** 把助手回复按 ``` 代码块切开，分别渲染 —— 不用 dangerouslySetInnerHTML，无 XSS 风险。 */
function renderContent(text: string) {
  const parts = text.split(/```/);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // 代码块（可带语言标记，首行去掉）
      const lines = part.replace(/^\n/, '').split('\n');
      const body = lines.join('\n').replace(/\n$/, '');
      return (
        <pre key={i} className={styles.codeBlock}>
          <code>{body}</code>
        </pre>
      );
    }
    return (
      <span key={i} className={styles.plainText}>
        {part}
      </span>
    );
  });
}

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_STORED);
  } catch {
    return [];
  }
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 首次挂载时读回历史（仅浏览器）
  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  // 滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  // 打开面板时聚焦输入框
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // 持久化历史
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (messages.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
      }
    } catch {
      // 存储不可用（隐私模式等）不影响聊天本身
    }
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const next: Message[] = [...messages, {role: 'user', content: text}];
    setMessages(next);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({messages: next}),
      });

      let data: {reply?: string; error?: string} = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`服务端返回了无法解析的内容（HTTP ${res.status}）`);
      }

      if (!res.ok) {
        throw new Error(data.error || `请求失败（HTTP ${res.status}）`);
      }
      if (!data.reply) {
        throw new Error('服务端没有返回内容');
      }

      setMessages([...next, {role: 'assistant', content: data.reply}]);
    } catch (err) {
      // 错误显式展示，不静默吞掉
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const clearAll = () => {
    setMessages([]);
    setError('');
  };

  return (
    <>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="AI 学习助手">
          <div className={styles.header}>
            <span className={styles.title}>AI 学习助手</span>
            <div className={styles.headerActions}>
              {messages.length > 0 && (
                <button className={styles.textBtn} onClick={clearAll} type="button">
                  清空
                </button>
              )}
              <button
                className={styles.textBtn}
                onClick={() => setOpen(false)}
                type="button"
                aria-label="关闭">
                ✕
              </button>
            </div>
          </div>

          <div className={styles.list} ref={listRef}>
            {messages.length === 0 && (
              <div className={styles.empty}>
                学习中有问题？直接问我。
                <br />
                比如：「Agent 循环为什么要设步数上限？」
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? styles.userMsg : styles.botMsg}>
                {m.role === 'user' ? m.content : renderContent(m.content)}
              </div>
            ))}
            {loading && <div className={styles.botMsg}>正在思考…</div>}
            {error && <div className={styles.errorMsg}>出错了：{error}</div>}
          </div>

          <div className={styles.composer}>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="输入问题，回车发送（Shift+回车换行）"
              rows={2}
            />
            <button
              className={styles.sendBtn}
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              type="button">
              发送
            </button>
          </div>
        </div>
      )}

      <button
        className={styles.launcher}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-label={open ? '收起 AI 助手' : '打开 AI 助手'}>
        {open ? '✕' : 'AI'}
      </button>
    </>
  );
}
