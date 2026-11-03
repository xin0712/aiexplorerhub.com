/**
 * useDragPanel — 让聊天面板可以按住标题栏拖动。
 *
 * 用 Pointer Events 而不是鼠标事件：一套代码同时覆盖鼠标、触摸笔和手指，
 * 不用为移动端另写一份。
 *
 * 位置存 localStorage，刷新后停在你放的地方。
 */

import {useCallback, useEffect, useRef, useState} from 'react';

type Pos = {x: number; y: number};

const POS_KEY = 'aieh-chat-pos';

/** 横向至少留出这么多可见，防止面板被拖出屏幕后找不回来。 */
const MIN_VISIBLE = 60;

/** 纵向至少留出这么多高度——否则面板被压扁，输入框没法用。 */
const MIN_HEIGHT = 280;

/** 底部留的空隙（面板到窗口底边）。 */
const BOTTOM_GAP = 16;

/** 窄屏断点，与 styles.module.css 的 @media 保持一致。 */
const NARROW = '(max-width: 480px)';

/** 拖动时禁掉文本选中，避免把标题栏文字选蓝。 */
function lockSelect(on: boolean) {
  document.body.style.userSelect = on ? 'none' : '';
  document.body.style.cursor = on ? 'grabbing' : '';
}

function readPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x === 'number' && typeof p?.y === 'number') return p;
  } catch {
    // 存储坏了就当没存过——位置丢了不影响聊天
  }
  return null;
}

function savePos(p: Pos) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    // 隐私模式等场景存不了，不影响本次使用
  }
}

function clearPos() {
  try {
    localStorage.removeItem(POS_KEY);
  } catch {
    // 清不掉也不影响，面板已经回到默认位置
  }
}

/** 夹到视口内：横向留 MIN_VISIBLE，纵向保证撑得开。 */
function clamp(p: Pos, w: number): Pos {
  // 纵向两处要一致：这里留够 MIN_HEIGHT，加上底边 BOTTOM_GAP，
  // 才和下面 style 里的 maxHeight 算出来的可用高度对得上（否则会少一个 BOTTOM_GAP）。
  const maxY = Math.max(0, window.innerHeight - MIN_HEIGHT - BOTTOM_GAP);
  return {
    x: Math.min(Math.max(p.x, MIN_VISIBLE - w), window.innerWidth - MIN_VISIBLE),
    y: Math.min(Math.max(p.y, 0), maxY),
  };
}

export function useDragPanel(panelRef: React.RefObject<HTMLElement>) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [narrow, setNarrow] = useState(false);
  const dragging = useRef(false);
  const offset = useRef({dx: 0, dy: 0});

  const measure = () => panelRef.current?.offsetWidth ?? 380;

  // 挂载时读回上次位置。
  // 这里只夹显示范围、**不回写存储**——在小窗口里打开不该把用户在大屏上放的位置抹掉。
  useEffect(() => {
    const raw = readPos();
    if (raw) setPos(clamp(raw, measure()));
  }, [panelRef]);

  // 窄屏时不应用拖动坐标：手机上面板本来就占满宽度，拖动没有意义，还会和内联样式打架
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // 窗口尺寸变化时把面板拉回可见范围（缩小窗口容易把它挤出去）
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p, measure()) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [panelRef]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 只响应主键；右键/中键不触发拖动
      if (e.button !== 0) return;
      // 点在按钮上时不拖——那是「清空」「关闭」这些操作
      if ((e.target as HTMLElement).closest('button')) return;

      const el = panelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      dragging.current = true;
      offset.current = {dx: e.clientX - rect.left, dy: e.clientY - rect.top};
      lockSelect(true);

      // 从实际渲染位置起算，避免和「上次存的」有偏差
      setPos({x: rect.left, y: rect.top});

      e.currentTarget.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    },
    [panelRef],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      setPos(clamp({x: e.clientX - offset.current.dx, y: e.clientY - offset.current.dy}, measure()));
    },
    [panelRef],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    lockSelect(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // 松手才写盘——拖动过程中每帧都写太浪费
    setPos((p) => {
      if (p) savePos(p);
      return p;
    });
  }, []);

  /** 双击标题栏复位到默认位置（右下角）。 */
  const reset = useCallback(() => {
    setPos(null);
    clearPos();
  }, []);

  // 窄屏或无拖动位置时返回空对象，走 CSS 里的默认定位
  const active = pos && !narrow;
  const style: React.CSSProperties = active
    ? {
        left: pos.x,
        top: pos.y,
        right: 'auto',
        bottom: 'auto',
        // 面板上移后底边会超出窗口，用 max-height 跟着收，保证输入框始终可见
        maxHeight: `calc(100vh - ${pos.y + BOTTOM_GAP}px)`,
      }
    : {};

  return {style, onPointerDown, onPointerMove, onPointerUp, reset};
}
