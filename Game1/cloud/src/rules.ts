// Count, outs, bases, score and innings — pure logic, no engine imports.
import { INNINGS, TEAMS, PLAYERS, type Player, type Team } from './data.js';

export type PitchOutcome =
  | 'ball' | 'strike' | 'foul'
  | 'groundout' | 'flyout' | 'lineout'
  | 'single' | 'double' | 'triple' | 'homerun';

export const OUTCOME_TEXT: Record<PitchOutcome, string> = {
  ball: '壞球', strike: '好球', foul: '界外球',
  groundout: '滾地球出局', flyout: '高飛球出局', lineout: '平飛球出局',
  single: '一壘安打！', double: '二壘安打！', triple: '三壘安打！', homerun: '全壘打！！',
};

export const HIT_BASES: Partial<Record<PitchOutcome, number>> = { single: 1, double: 2, triple: 3, homerun: 4 };

export class GameState {
  inning = 1;
  top = true;
  outs = 0;
  balls = 0;
  strikes = 0;
  bases: [boolean, boolean, boolean] = [false, false, false];
  runs = { away: 0, home: 0 };
  hits = { away: 0, home: 0 };
  line: { away: number[]; home: number[] } = { away: [0], home: [] };
  order = { away: 0, home: 0 };
  over = false;
  /** A short announcement produced by the last event (e.g. "三振！", "得分 +2"). */
  lastNote = '';

  constructor(public readonly away: Team, public readonly home: Team, public readonly innings = INNINGS) {}

  static forUser(userTeam: 'whale' | 'cat'): GameState {
    const cpu = userTeam === 'whale' ? 'cat' : 'whale';
    // The user always bats second (home), giving them the last word.
    return new GameState(TEAMS[cpu], TEAMS[userTeam]);
  }

  get battingSide(): 'away' | 'home' { return this.top ? 'away' : 'home'; }
  get fieldingSide(): 'away' | 'home' { return this.top ? 'home' : 'away'; }
  get battingTeam(): Team { return this.top ? this.away : this.home; }
  get fieldingTeam(): Team { return this.top ? this.home : this.away; }
  get batter(): Player {
    const t = this.battingTeam;
    return PLAYERS[t.lineup[this.order[this.battingSide] % t.lineup.length]];
  }
  get pitcher(): Player { return PLAYERS[this.fieldingTeam.pitcher]; }

  private score(n: number): void {
    if (n <= 0) return;
    const side = this.battingSide;
    this.runs[side] += n;
    const arr = this.line[side];
    arr[arr.length - 1] += n;
  }

  private nextBatter(): void {
    this.balls = 0;
    this.strikes = 0;
    this.order[this.battingSide]++;
  }

  private out(note: string): void {
    this.outs++;
    this.lastNote = note;
    this.nextBatter();
    if (this.outs >= 3) this.endHalf();
  }

  private endHalf(): void {
    this.outs = 0;
    this.bases = [false, false, false];
    if (this.top) {
      // Home already leads after the top of the last inning → game over.
      if (this.inning >= this.innings && this.runs.home > this.runs.away) { this.over = true; return; }
      this.top = false;
      this.line.home.push(0);
    } else {
      if (this.inning >= this.innings && this.runs.home !== this.runs.away) { this.over = true; return; }
      if (this.inning >= this.innings + 3) { this.over = true; return; } // tie after 3 extra innings
      this.inning++;
      this.top = true;
      this.line.away.push(0);
    }
  }

  /** Advance runners by `n` bases (batter included); returns runs scored. */
  private advance(n: number): number {
    let runs = 0;
    const b = this.bases;
    const next: [boolean, boolean, boolean] = [false, false, false];
    for (let i = 2; i >= 0; i--) {
      if (!b[i]) continue;
      const to = i + n;
      if (to >= 3) runs++; else next[to] = true;
    }
    if (n >= 4) runs++; else next[n - 1] = true;
    this.bases = next;
    return runs;
  }

  private walk(): number {
    const b = this.bases;
    let runs = 0;
    if (b[0]) {
      if (b[1]) {
        if (b[2]) runs = 1;
        b[2] = true;
      }
      b[1] = true;
    }
    b[0] = true;
    return runs;
  }

  private walkOffCheck(): void {
    if (!this.top && this.inning >= this.innings && this.runs.home > this.runs.away) this.over = true;
  }

  /** Apply one pitch's outcome. */
  apply(o: PitchOutcome): void {
    if (this.over) return;
    this.lastNote = '';
    const side = this.battingSide;
    switch (o) {
      case 'ball':
        this.balls++;
        if (this.balls >= 4) {
          const r = this.walk();
          this.score(r);
          this.lastNote = r ? `四壞保送 押回 ${r} 分` : '四壞保送';
          this.nextBatter();
        }
        break;
      case 'strike':
        this.strikes++;
        if (this.strikes >= 3) this.out('三振！');
        break;
      case 'foul':
        if (this.strikes < 2) this.strikes++;
        break;
      case 'groundout': case 'flyout': case 'lineout': {
        // Sacrifice fly: a fly out with a runner on third and < 2 outs scores him.
        if (o === 'flyout' && this.bases[2] && this.outs < 2) {
          this.bases[2] = false;
          this.score(1);
          this.out('高飛犧牲打 得 1 分');
        } else {
          this.out(OUTCOME_TEXT[o]);
        }
        break;
      }
      default: {
        const n = HIT_BASES[o] ?? 1;
        this.hits[side]++;
        const r = this.advance(n);
        this.score(r);
        this.lastNote = r ? `${OUTCOME_TEXT[o]} 得 ${r} 分` : OUTCOME_TEXT[o];
        this.nextBatter();
      }
    }
    this.walkOffCheck();
  }

  winner(): 'away' | 'home' | 'tie' {
    return this.runs.home > this.runs.away ? 'home' : this.runs.away > this.runs.home ? 'away' : 'tie';
  }
}
