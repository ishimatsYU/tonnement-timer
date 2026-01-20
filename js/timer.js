
// js/timer.js
// テキサスホールデム用トーナメントタイマー（コアロジック）
class TournamentTimer {
  constructor() {
    // 状態
    this.timers = [];
    this.currentTimerIndex = 0;
    this.currentLevelIndex = 0;
    this.timeRemaining = 0; // 秒
    this.isRunning = false;
    this.isBreak = false;

    // コールバック
    this.onTimeUpdate = null;   // (remainingSeconds) => void
    this.onLevelChange = null;  // (levelIndex, isBreak) => void

    // 設定（色は表示側で使用）
    this.settings = {
      oneMinuteWarning: true,
      levelChangeSound: true,
      breakColor: '#FFD700',
      normalColor: '#87CEEB',
    };

    // 内部
    this._intervalId = null;
    this._audioCtx = null;   // ユーザー操作後に生成
    this._lastSavedJson = ''; // 書き込み節約

    // データ読込（無ければ初期データ）
    this.loadData();
    if (!Array.isArray(this.timers) || this.timers.length === 0) {
      this._createDefaultTimer(); // Level1: 1/2/2、以後2倍
      this.currentTimerIndex = 0;
      this.currentLevelIndex = 0;
      this.timeRemaining = this.timers[0].levels[0].duration * 60;
      this.isBreak = false;
      this.isRunning = false;
      this._persist();
    }
  }

  // ===== 永続化 =====
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
      this.isBreak = !!(data.isBreak);
      this.isRunning = !!(data.isRunning);
      this.settings = { ...this.settings, ...(data.settings || {}) };
      this._lastSavedJson = saved;
    } catch {
      this.timers = [];
    }
  }

  // ===== タイマー定義 =====
  _createDefaultTimer() {
    // Level1 を SB=1 / BB=2 / ANTE=2 とし、以後は2倍ずつ（デモ用に 2分 × 8レベル）
    const levels = [];
    let sb = 1, bb = 2, ante = 2;
    for (let i = 0; i < 8; i += 1) {
      levels.push({ duration: 2, sb, bb, ante });
      sb *= 2; bb *= 2; ante *= 2;
    }

    const defaultTimer = {
      id: 'default',
      name: 'デモタイマー',
      levels,
      // breaks: level は「そのレベルが終わった “後” にブレイク」を意味する 0-based index
      breaks: [
        { level: 1, duration: 1 }, // Level2 の後に 1 分休憩
      ],
    };
    this.timers = [defaultTimer];
  }

  addTimer(timer) {
    this.timers.push(timer);
    this._persist();
  }

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

  // ===== 現在参照 =====
  getCurrentTimer() { return this.timers[this.currentTimerIndex]; }
  getCurrentLevel() {
    const t = this.getCurrentTimer(); if (!t) return null;
    return t.levels[this.currentLevelIndex] || null;
  }
  getNextLevel() {
    const t = this.getCurrentTimer(); if (!t) return null;
    return t.levels[this.currentLevelIndex + 1] || null;
  }

  // ===== 操作 =====
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
    // ブレイク中は直前のレベルに戻すのではなく、ブレイク解除＋そのレベルに戻す仕様でもOKだが
    // ここでは単純にひとつ前のレベルへ（ブレイク解除）
    if (this.currentLevelIndex <= 0) { return; }
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

    // もし今がブレイク中なら、ブレイク終了 → 次レベル開始
    if (this.isBreak) {
      this.isBreak = false;
      this.currentLevelIndex += 1; // ここで初めて次レベルへ進む
      const lv = this.getCurrentLevel();
      this.timeRemaining = lv ? lv.duration * 60 : 0;
      this._emitLevelChange();
      this._persist();
      return;
    }

    // レベルの終了。最終レベルなら停止
    if (this.currentLevelIndex >= t.levels.length - 1) {
      this.stop();
      this.isBreak = false;
      this.timeRemaining = 0;
      this._emitLevelChange();
      this._persist();
      return;
    }

    // このレベルの “後” にブレイクがあるか
    const curLevelIndex = this.currentLevelIndex;
    const bp = (t.breaks || []).find(b => b.level === curLevelIndex);

    if (bp) {
      // ブレイク突入（レベルは進めない）
      this.isBreak = true;
      this.timeRemaining = bp.duration * 60;
      this._emitLevelChange();
      this._persist();
    } else {
      // そのまま次レベルへ
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

      // 残り3/2/1秒で「ピッ」
      if ([3, 2, 1].includes(this.timeRemaining)) {
        this._playSound('beep');
      }

      // 残り60秒で警告音（設定有効時）
      if (this.settings.oneMinuteWarning && this.timeRemaining === 60) {
        this._playSound('warning');
      }

      if (typeof this.onTimeUpdate === 'function') this.onTimeUpdate(this.timeRemaining);
      this._persist();
      return;
    }

    // 0秒：最後の「ピー」（長め）
    if (this.settings.levelChangeSound) {
      this._playSound('final');
    }
    // 次へ（ブレイク or 次レベル or 停止）
    this.nextLevel();
  }

  // ===== サウンド =====
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
        // 短いビープ（ピッ）
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain); gain.connect(audioContext.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(1000, audioContext.currentTime);
        gain.gain.setValueAtTime(0.25, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12);
        osc.start(); osc.stop(audioContext.currentTime + 0.12);
      } else if (type === 'final') {
        // 長いビープ（ピー）
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain); gain.connect(audioContext.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, audioContext.currentTime);
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        osc.start(); osc.stop(audioContext.currentTime + 0.8);
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
    } catch {
      // 音は失敗しても致命ではない
    }
  }

  // ===== 表示用ユーティリティ =====
  getNextBreakTime() {
    const t = this.getCurrentTimer();
    if (!t) return null;

    let minutes = 0;
    // 現在がブレイク中なら、このブレイク終了後から次のブレイクを探す
    let startLevelIndex = this.currentLevelIndex;
    let remainingAtStart = Math.ceil(this.timeRemaining / 60);
    if (this.isBreak) {
      // ブレイク後に開始するレベルが currentLevelIndex+1
      startLevelIndex = this.currentLevelIndex + 1;
      remainingAtStart = 0; // ブレイク中は「次のブレイク」までの分数には含めない想定
    }

    minutes += remainingAtStart;
    for (let i = startLevelIndex; i < t.levels.length; i += 1) {
      const hasBreakAfter = (t.breaks || []).some(b => b.level === i);
      if (i > startLevelIndex) minutes += t.levels[i].duration;
      else if (remainingAtStart === 0 && i < t.levels.length) minutes += t.levels[i].duration;
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

// グローバル公開
window.TournamentTimer = TournamentTimer;
