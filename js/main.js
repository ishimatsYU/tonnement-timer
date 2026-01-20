
// js/main.js
class MainDisplay {
  constructor() {
    this.timer = new TournamentTimer(); // 表示専用
    this._bindElements();
    this._wireEvents();
    this._renderAll();

    setInterval(() => this._renderTimerOnly(), 1000);
    setInterval(() => { this.timer.loadData(); this._renderAll(); }, 5000);
  }

  _bindElements() {
    this.tournamentNameEl = document.getElementById('tournament-name');
    this.timerTextEl = document.getElementById('current-time');
    this.currentLevelEl = document.getElementById('current-level');
    this.currentSbEl = document.getElementById('current-sb');
    this.currentBbEl = document.getElementById('current-bb');
    this.currentAnteEl = document.getElementById('current-ante');

    this.nextSbEl = document.getElementById('next-sb');
    this.nextBbEl = document.getElementById('next-bb');
    this.nextAnteEl = document.getElementById('next-ante');
    this.nextBreakEl = document.getElementById('next-break');

    this.rewardListEl = document.getElementById('reward-list');
    this.averageStackEl = document.getElementById('average-stack-value');
    this.currentPlayersEl = document.getElementById('current-players');
    this.totalEntriesEl = document.getElementById('total-entries');

    this.breakBannerEl = document.getElementById('break-indicator'); // ★ 固定バナー
  }

  _wireEvents() {
    window.addEventListener('storage', (e) => {
      if (e.key === 'tournamentTimer' || e.key === 'tournamentData') {
        this.timer.loadData();
        this._renderAll();
      }
    });
    this.timer.onLevelChange = () => {
      this._renderLevelInfo();
      this._renderTimerOnly();
      this._renderTheme();
      this._toggleBreakBanner();
    };
    this.timer.onTimeUpdate = () => this._renderTimerOnly();
  }

  _renderAll() {
    this._renderTournamentInfo();
    this._renderTimerOnly();
    this._renderLevelInfo();
    this._renderRightPanel();
    this._renderTheme();
    this._toggleBreakBanner();
  }

  _renderTournamentInfo() {
    const data = this._loadTournamentData();
    this.tournamentNameEl.textContent = data.name || 'トーナメント名';
  }

  _renderTimerOnly() {
    this.timer.loadData();
    this.timerTextEl.textContent = this.timer.getFormattedTime();

    if (this.timer.isBreak) {
      this.timerTextEl.style.color = '#FF3B30'; // 赤
    } else if (this.timer.isUnderOneMinute()) {
      this.timerTextEl.style.color = '#FFD700'; // 黄
    } else {
      this.timerTextEl.style.color = '#FFFFFF'; // 白
    }
  }

  _renderLevelInfo() {
    const cur = this.timer.getCurrentLevel();
    const next = this.timer.getNextLevel();

    if (cur) {
      this.currentLevelEl.textContent = `Level ${this.timer.currentLevelIndex + 1}`;
      this.currentSbEl.textContent = cur.sb;
      this.currentBbEl.textContent = cur.bb;
      this.currentAnteEl.textContent = cur.ante;
    } else {
      this.currentLevelEl.textContent = '—';
      this.currentSbEl.textContent = '-';
      this.currentBbEl.textContent = '-';
      this.currentAnteEl.textContent = '-';
    }

    if (next) {
      this.nextSbEl.textContent = next.sb;
      this.nextBbEl.textContent = next.bb;
      this.nextAnteEl.textContent = next.ante;
    } else {
      this.nextSbEl.textContent = '-';
      this.nextBbEl.textContent = '-';
      this.nextAnteEl.textContent = '-';
    }

    const nb = this.timer.getNextBreakTime();
    this.nextBreakEl.textContent = (nb !== null) ? `次のブレイク: ${nb}分後` : '次のブレイク: なし';
  }

  _renderRightPanel() {
    const data = this._loadTournamentData();
    this.rewardListEl.innerHTML = '';
    const rewards = Array.isArray(data.rewards) ? data.rewards : [];
    rewards.forEach((reward, idx) => {
      const div = document.createElement('div');
      div.className = 'reward-item';
      div.innerHTML = `
        <span class="reward-rank">${idx + 1}位:</span>
        <span class="reward-value">${reward}</span>
      `;
      this.rewardListEl.appendChild(div);
    });

    // 平均スタック = 初期スタック × 受付人数 ÷ 現在参加人数
    const currentPlayers = Number.isFinite(+data.currentPlayers) ? +data.currentPlayers : 0;
    const totalEntries  = Number.isFinite(+data.totalEntries)  ? +data.totalEntries  : 0;
    const initialStack  = Number.isFinite(+data.initialStack)  ? +data.initialStack  : 10000;
    const totalChips = initialStack * totalEntries;
    const avg = currentPlayers > 0 ? Math.floor(totalChips / currentPlayers) : 0;
    this.averageStackEl.textContent = avg.toLocaleString();

    this.currentPlayersEl.textContent = currentPlayers || 0;
    this.totalEntriesEl.textContent   = totalEntries  || 0;
  }

  _renderTheme() {
    document.body.style.backgroundColor = this.timer.isBreak
      ? this.timer.settings.breakColor
      : this.timer.settings.normalColor;
  }

  _toggleBreakBanner() {
    if (!this.breakBannerEl) return;
    this.breakBannerEl.style.display = this.timer.isBreak ? 'block' : 'none';
  }

  _loadTournamentData() {
    const saved = localStorage.getItem('tournamentData');
    if (!saved) return {};
    try { return JSON.parse(saved) || {}; } catch { return {}; }
  }
}

document.addEventListener('DOMContentLoaded', () => new MainDisplay());
