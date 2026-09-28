// 比賽狀態：局數、好壞球、出局、壘包、比分、打序（純邏輯）
import { TEAMS, PLAYERS } from './data.js';
import { walkAdvance } from './fielding.js';

export class GameState {
  /**
   * @param userTeamId 玩家球隊
   * @param innings 局數
   * @param userHome 玩家是否後攻
   */
  constructor(userTeamId, innings = 3, userHome = true) {
    const cpuTeamId = userTeamId === 'whale' ? 'cat' : 'whale';
    this.innings = innings;
    this.userTeamId = userTeamId;
    this.away = userHome ? cpuTeamId : userTeamId; // 先攻
    this.home = userHome ? userTeamId : cpuTeamId; // 後攻
    this.inning = 1;
    this.top = true; // 上半局 = 先攻隊進攻
    this.outs = 0;
    this.balls = 0;
    this.strikes = 0;
    this.bases = [null, null, null];
    this.lineScore = { [this.away]: [], [this.home]: [] };
    this.runs = { [this.away]: 0, [this.home]: 0 };
    this.hits = { [this.away]: 0, [this.home]: 0 };
    this.order = { [this.away]: 0, [this.home]: 0 };
    this.pitchCount = { [this.away]: 0, [this.home]: 0 };
    this.stats = {};
    for (const id of Object.keys(PLAYERS)) this.stats[id] = { ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0, pk: 0, pr: 0 };
    this.over = false;
    this.lineScore[this.away][0] = 0;
    this.log = [];
  }

  get battingTeamId() { return this.top ? this.away : this.home; }
  get fieldingTeamId() { return this.top ? this.home : this.away; }
  get userBatting() { return this.battingTeamId === this.userTeamId; }
  get batter() {
    const t = TEAMS[this.battingTeamId];
    return PLAYERS[t.lineup[this.order[this.battingTeamId] % t.lineup.length]];
  }
  get pitcher() { return PLAYERS[TEAMS[this.fieldingTeamId].pitcher]; }
  get fatigue() {
    // 投球數 → 疲勞 0~1
    const p = this.pitcher;
    const cap = 30 + p.pitch.stamina * 0.9;
    return Math.max(0, Math.min(1, (this.pitchCount[this.fieldingTeamId] - cap * 0.55) / (cap * 0.6)));
  }
  get staminaRatio() {
    const p = this.pitcher;
    const cap = 30 + p.pitch.stamina * 0.9;
    return Math.max(0, 1 - this.pitchCount[this.fieldingTeamId] / (cap * 1.15));
  }

  // 壘上跑者以物件表示（同一球員可能同時在壘上又輪到打擊）
  makeRunner() {
    this.runnerUid = (this.runnerUid || 0) + 1;
    return { player: this.batter, uid: this.runnerUid };
  }

  countPitch() { this.pitchCount[this.fieldingTeamId]++; }

  // ---- 單球判定 ----
  // 回傳事件: 'ball' | 'walk' | 'strike' | 'strikeout' | 'foul'
  ball() {
    this.balls++;
    if (this.balls >= 4) {
      const b = this.batter;
      const r = walkAdvance(this.bases, this.makeRunner());
      this.bases = r.bases;
      this.stats[b.id].bb++;
      this.scoreRuns(r.runs, b);
      this.nextBatter();
      return { event: 'walk', runs: r.runs.length };
    }
    return { event: 'ball' };
  }

  strike(swinging = false) {
    this.strikes++;
    if (this.strikes >= 3) {
      const b = this.batter;
      this.stats[b.id].ab++;
      this.stats[b.id].k++;
      this.stats[this.pitcher.id].pk++;
      this.outs++;
      this.nextBatter();
      return { event: 'strikeout', swinging };
    }
    return { event: 'strike', swinging };
  }

  foul(bunt = false) {
    if (bunt && this.strikes === 2) return this.strike(true); // 兩好球短打界外 = 三振
    if (this.strikes < 2) this.strikes++;
    return { event: 'foul' };
  }

  // 套用守備判定結果
  applyPlay(o) {
    const b = this.batter;
    const st = this.stats[b.id];
    if (o.code !== 'SAC' && o.code !== 'SACFLY') st.ab++;
    if (o.hit) { st.h++; this.hits[this.battingTeamId]++; }
    if (o.code === 'HR') st.hr++;
    this.outs += o.outs;
    this.bases = this.outs >= 3 ? [null, null, null] : o.bases;
    this.scoreRuns(o.runs, b, o.code !== 'DP');
    this.nextBatter();
  }

  scoreRuns(runners, batter, rbi = true) {
    const n = runners.length;
    if (!n) return;
    const t = this.battingTeamId;
    this.runs[t] += n;
    const ls = this.lineScore[t];
    ls[this.inning - 1] = (ls[this.inning - 1] || 0) + n;
    if (rbi) this.stats[batter.id].rbi += n;
    this.stats[this.pitcher.id].pr += n;
  }

  nextBatter() {
    this.balls = 0;
    this.strikes = 0;
    this.order[this.battingTeamId]++;
  }

  // 是否再見（後攻隊在最終局以後超前）
  get walkOff() {
    return !this.top && this.inning >= this.innings && this.runs[this.home] > this.runs[this.away];
  }

  /**
   * 檢查半局結束 / 比賽結束。回傳 'continue' | 'switch' | 'end'
   */
  checkState() {
    if (this.walkOff) { this.over = true; return 'end'; }
    if (this.outs < 3) return 'continue';
    // 三出局
    if (this.top) {
      // 最終局上半結束且後攻領先 → 比賽結束
      if (this.inning >= this.innings && this.runs[this.home] > this.runs[this.away]) {
        this.lineScore[this.home][this.inning - 1] = 'X';
        this.over = true; return 'end';
      }
      this.top = false;
      this.lineScore[this.home][this.inning - 1] = this.lineScore[this.home][this.inning - 1] || 0;
    } else {
      if (this.inning >= this.innings) { this.over = true; return 'end'; }
      this.inning++;
      this.top = true;
      this.lineScore[this.away][this.inning - 1] = 0;
    }
    this.outs = 0; this.balls = 0; this.strikes = 0;
    this.bases = [null, null, null];
    return 'switch';
  }

  result() {
    const a = this.runs[this.away], h = this.runs[this.home];
    let winner = null;
    if (a > h) winner = this.away; else if (h > a) winner = this.home;
    return {
      away: this.away, home: this.home, runs: { ...this.runs }, hits: { ...this.hits },
      lineScore: JSON.parse(JSON.stringify(this.lineScore)), innings: this.innings,
      winner, userTeamId: this.userTeamId, stats: this.stats,
    };
  }
}
