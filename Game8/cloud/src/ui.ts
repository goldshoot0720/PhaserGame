// Tiny UI helpers shared by every scene: cached CJK text blocks and clickable buttons.
import type { Draw, Game, UnicodeText, UnicodeTextOptions, Pointer } from '../engine/webgpu.js';

const cache = new Map<string, UnicodeText>();

export interface TextStyle {
  size: number;
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  weight?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
}

export function textBlock(game: Game, str: string, s: TextStyle): UnicodeText {
  const key = `${str}|${s.size}|${s.color}|${s.stroke}|${s.strokeWidth}|${s.weight}|${s.maxWidth}|${s.align}`;
  let t = cache.get(key);
  if (!t) {
    const opts: UnicodeTextOptions = {
      fontSize: s.size,
      fontWeight: s.weight ?? 700,
      color: s.color ?? '#ffffff',
      fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
    };
    if (s.stroke) opts.stroke = { color: s.stroke, width: s.strokeWidth ?? Math.max(2, s.size / 8), join: 'round' };
    if (s.maxWidth) opts.maxWidth = s.maxWidth;
    if (s.align) opts.align = s.align;
    t = game.assets.unicodeText(str, opts);
    cache.set(key, t);
  }
  return t;
}

export function label(d: Draw, game: Game, str: string, x: number, y: number, s: TextStyle, ox = 0.5, oy = 0.5, alpha = 1): void {
  if (!str) return;
  d.unicodeText(textBlock(game, str, s), x, y, { origin: { x: ox, y: oy }, alpha });
}

export interface Rect { x: number; y: number; w: number; h: number; }

export function inside(p: { x: number; y: number } | null, r: Rect): boolean {
  return !!p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function button(d: Draw, game: Game, r: Rect, text: string, pointer: Pointer | null, opts: { color?: string; hover?: string; size?: number; selected?: boolean } = {}): boolean {
  const hov = inside(pointer, r);
  const base = opts.selected ? '#ffcf4a' : (opts.color ?? '#2c3e75');
  d.rect(r.x + 4, r.y + 6, r.w, r.h, '#00000055');
  d.rect(r.x, r.y, r.w, r.h, hov ? (opts.hover ?? '#4a64b8') : base);
  d.rect(r.x, r.y, r.w, 4, '#ffffff44');
  label(d, game, text, r.x + r.w / 2, r.y + r.h / 2, { size: opts.size ?? 26, color: opts.selected ? '#3a2400' : '#ffffff' });
  return hov;
}

export function panel(d: Draw, r: Rect, color = '#0d1433cc', border = '#ffffff55'): void {
  d.rect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, border);
  d.rect(r.x, r.y, r.w, r.h, color);
}

export function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

export class Clicker {
  private was = false;
  poll(p: Pointer | null): boolean {
    const down = !!p?.isDown;
    const c = down && !this.was;
    this.was = down;
    return c;
  }
}

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60), sec = s - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(2)}`;
}
