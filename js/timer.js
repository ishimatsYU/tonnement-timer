
// js/timer.js
class TournamentTimer {
  constructor() {
    this.timers = [];
    this.currentTimerIndex = 0;
    this.currentLevelIndex = 0;
    this.timeRemaining = 0; // sec
    this.isRunning = false;
    this.isBreak = false;

    this.onTimeUpdate = null;
    this.onLevelChange = null;

    this.settings = {
      oneMinuteWarning: true,
      levelChangeSound: true,
      breakColor: '#FFD700',
      normalColor: '#87CEEB',
    };

    this._intervalId = null;
    this._audioCtx = null;
    this._lastSavedJson = '';

    this.loadData();
    if (!Array.isArray(this.timers) || this.timers.length === 0) {
      this._createDefaultTimer(); // Level1: SB1/BB2/ANTE2 → 以後2倍
      this.currentTimerIndex = 0;
      this.currentLevelIndex = 0;
      this.timeRemaining = this.timers[0].levels[0].duration * 60;
      this.isBreak = false;
      this.isRunning = false;
      this._persist();
    }
  }

  _persist() {
    const data = {
      timers: this.timers,
      currentTimerIndex: this.currentTimerIndex,
      currentLevelIndex: this.currentLevelIndex,
      timeRemaining: this.timeRemaining,
      isBreak: this.isBreak,
      isRunning: this.isRunning,
      settings: this.settings,
      lastUpdated: Date.now(),
    };
    const json = JSON.stringify(data);
    if (json !== this._lastSavedJson) {
      localStorage.setItem('tournamentTimer', json);
      this._lastSavedJson = json;
    }
  }

  loadData() {
    const saved = localStorage.getItem('tournamentTimer');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      this.timers = Array.isArray(data.timers) ? data.timers : [];
      this.currentTimerIndex = Number.isInteger(data.currentTimerIndex) ? data.currentTimerIndex : 0;
      this.currentLevelIndex = Number.isInteger(data.currentLevelIndex) ? data.currentLevelIndex : 0;
      this.timeRemaining = Number.isFinite(data.timeRemaining) ? data.timeRemaining : 0;
      this.isBreak = !!data.isBreak;
      this.isRunning = !!data.isRunning;
      this.settings = { ...this.settings, ...(data.settings || {}) };
      this._lastSavedJson = saved;
    } catch {
      this.timers = [];
    }
  }

  _createDefaultTimer() {
    const levels = [];
    let sb = 1, bb = 2, ante = 2;
    for (let i = 0; i < 8; i += 1) {
      levels.push({ duration: 2, sb, bb, ante }); // デモは各2分
      sb *= 2; bb *= 2; ante *= 2;
    }
    const defaultTimer = {
      id: 'default',
      name: 'デモタイマー',
      levels,
      // level は「このレベルの“後”にブレイク」(0-based)
      breaks: [{ level: 1, duration: 1 }], // Level2 の後に 1 分
    };
    this.timers = [defaultTimer];
  }

  addTimer(timer) { this.timers.push(timer); this._persist(); }

  selectTimer(index) {
    if (index < 0 || index >= this.timers.length) return;
    this.currentTimerIndex = index;
    this.currentLevelIndex = 0;
    const cur = this.getCurrentLevel();
    this.isBreak = false;
    this.timeRemaining = cur ? cur.duration * 60 : 0;
    this.isRunning = false;
    this._persist();
  }

  getCurrentTimer() { return this.timers[this.currentTimerIndex]; }
  getCurrentLevel() {
    const t = this.getCurrentTimer();
    return t ? (t.levels[this.currentLevelIndex] || null) : null;
  }
  getNextLevel() {
    const t = this.getCurrentTimer();
    return t ? (t.levels[this.currentLevelIndex + 1] || null) : null;
  }

  start() {
    if (this.isRunning) return;
    if (!this.getCurrentTimer()) return;
    if (this.timeRemaining <= 0) {
      const lv = this.getCurrentLevel();
      this.timeRemaining = lv ? lv.duration * 60 : 0;
    }
    this.isRunning = true;
    this._persist();
    this._intervalId = setInterval(() => this._tick(), 1000);
  }

  stop() {
    this.isRunning = false;
    if (this._intervalId) { clearInterval(this._intervalId); this._intervalId = null; }
    this._persist();
  }

  reset() {
    const lv = this.getCurrentLevel();
    this.stop();
    this.isBreak = false;
    this.timeRemaining = lv ? lv.duration * 60 : 0;
    this._persist();
  }

  prevLevel() {
    if (this.currentLevelIndex <= 0) return;
    this.currentLevelIndex -= 1;
    this.isBreak = false;
    const lv = this.getCurrentLevel();
    this.timeRemaining = lv ? lv.duration * 60 : 0;
    this._emitLevelChange();
    this._persist();
  }

  nextLevel() {
    const t = this.getCurrentTimer();
    if (!t) { this.stop(); return; }

    // ブレイク中 → ブレイク終了で次レベル開始
    if (this.isBreak) {
      this.isBreak = false;
      this.currentLevelIndex += 1;
      const lv = this.getCurrentLevel();
      this.timeRemaining = lv ? lv.duration * 60 : 0;
      this._emitLevelChange();
      this._persist();
      return;
    }

    // レベル終了：ブレイクがあれば突入、無ければ次レベル／最終なら停止
    if (this.currentLevelIndex >= t.levels.length - 1) {
      // 最終レベル終了 → 停止
      this.stop();
      this.isBreak = false;
      this.timeRemaining = 0;
      this._emitLevelChange();
      this._persist();
      return;
    }

    const curLevelIndex = this.currentLevelIndex;
    const bp = (t.breaks || []).find(b => b.level === curLevelIndex);
    if (bp) {
      // ブレイクに突入（レベルは進めない）
      this.isBreak = true;
      this.timeRemaining = bp.duration * 60;
      this._emitLevelChange();
      this._persist();
    } else {
      // 次のレベルへ
      this.currentLevelIndex += 1;
      const lv = this.getCurrentLevel();
      this.isBreak = false;
      this.timeRemaining = lv ? lv.duration * 60 : 0;
      this._emitLevelChange();
      this._persist();
    }
  }

  _tick() {
    if (!this.isRunning) return;

    if (this.timeRemaining > 0) {
      this.timeRemaining -= 1;

      // 3,2,1 で短いビープ
      if ([3, 2, 1].includes(this.timeRemaining)) {
        this._playSound('beep');
      }
      // 1分前通知
      if (this.settings.oneMinuteWarning && this.timeRemaining === 60) {
        this._playSound('warning');
      }

      if (typeof this.onTimeUpdate === 'function') this.onTimeUpdate(this.timeRemaining);
      this._persist();
      return;
    }

    // 0秒：長すぎない最終ビープ（テンポを上げる）
    if (this.settings.levelChangeSound) this._playSound('final');
    this.nextLevel();
  }

  async _ensureAudio() {
    if (!this._audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this._audioCtx = new AC();
    }
    if (this._audioCtx.state === 'suspended') {
      try { await this._audioCtx.resume(); } catch {}
    }
    return this._audioCtx;
  }

  async _playSound(type) {
    try {
      const audioContext = await this._ensureAudio();
      if (!audioContext) return;

      if (type === 'beep') {
        // ピッ（短くアタック強め）
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain); gain.connect(audioContext.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(1050, audioContext.currentTime);
        gain.gain.setValueAtTime(0.28, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.10);
        osc.start(); osc.stop(audioContext.currentTime + 0.10);
      } else if (type === 'final') {
        // ピー（短め0.45sでテンポ感UP）
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain); gain.connect(audioContext.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920, audioContext.currentTime);
        gain.gain.setValueAtTime(0.30, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.45);
        osc.start(); osc.stop(audioContext.currentTime + 0.45);
      } else if (type === 'warning') {
        // 1分前の軽い通知
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain); gain.connect(audioContext.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, audioContext.currentTime);
        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
        osc.start(); osc.stop(audioContext.currentTime + 0.25);
      }
    } catch { /* no-op */ }
  }

  getNextBreakTime() {
    const t = this.getCurrentTimer();
    if (!t) return null;

    // 現在がブレイク中 → このブレイク終了後から次のブレイクを探す
    let minutes = 0;
    let startIndex = this.currentLevelIndex;
    if (this.isBreak) {
      // ブレイク時間は含めない（「次のブレイクまでのレベル経過時間」）
      startIndex = this.currentLevelIndex + 1;
    } else {
      minutes += Math.ceil(this.timeRemaining / 60);
    }

    for (let i = startIndex; i < t.levels.length; i += 1) {
      const hasBreakAfter = (t.breaks || []).some(b => b.level === i);
      if (i > startIndex || (this.isBreak && i === startIndex)) {
        minutes += t.levels[i].duration;
      }
      if (hasBreakAfter) return minutes;
    }
    return null;
  }

  getFormattedTime() {
    const m = Math.floor(this.timeRemaining / 60);
    const s = this.timeRemaining % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  isUnderOneMinute() { return this.timeRemaining <= 60 && !this.isBreak; }

  _emitLevelChange() {
    if (typeof this.onLevelChange === 'function') {
      this.onLevelChange(this.currentLevelIndex, this.isBreak);
    }
  }
}

window.TournamentTimer = TournamentTimer;
