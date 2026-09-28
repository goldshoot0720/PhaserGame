export const GAME_W = 1280;
export const GAME_H = 720;

export const FONT = '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Heiti TC", sans-serif';

export const TOTAL_LAPS = 3;
export const RACER_COUNT = 8;

/** 共用文字樣式 */
export function textStyle(size, color = '#ffffff', extra = {}) {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    fontStyle: 'bold',
    ...extra,
  };
}

export function formatTime(ms) {
  if (ms == null || !isFinite(ms)) return '--:--.---';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
}

export function hexStr(n) {
  return '#' + n.toString(16).padStart(6, '0');
}
