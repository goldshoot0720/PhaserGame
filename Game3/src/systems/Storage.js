/** localStorage 包裝（無法使用時安靜失敗） */
const PREFIX = 'whaleKart.';

export function load(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch (e) {
    return fallback;
  }
}

export function save(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function getRecords(trackId) {
  return load(`rec.${trackId}`, { bestLap: null, bestRace: null });
}

/** 更新紀錄，回傳 {newLap, newRace} */
export function submitRecords(trackId, bestLap, raceTime) {
  const rec = getRecords(trackId);
  const res = { newLap: false, newRace: false };
  if (bestLap != null && (rec.bestLap == null || bestLap < rec.bestLap)) {
    rec.bestLap = bestLap;
    res.newLap = true;
  }
  if (raceTime != null && (rec.bestRace == null || raceTime < rec.bestRace)) {
    rec.bestRace = raceTime;
    res.newRace = true;
  }
  save(`rec.${trackId}`, rec);
  return res;
}
