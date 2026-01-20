
// js/admin.js
class AdminPanel {
  constructor() {
    this.timer = new TournamentTimer();
    this.tournamentData = {
      name: 'デモトーナメント',
      currentPlayers: 0,
      totalEntries: 0,
      initialStack: 10000,
      entryFee: 0,
      rewards: ['100,000円', '60,000円', '40,000円'],
    };

    this._bindElements();
    this._loadAll();
    this._wireEvents();
    this._renderAll();

    setInterval(() => this._renderTimerControls(), 1000);
  }

  _bindElements() {
    // 基本
    this.tournamentNameInput = document.getElementById('tournament-name-input');
    this.currentPlayersInput = document.getElementById('current-players-input');
    this.totalEntriesInput   = document.getElementById('total-entries-input');
    this.initialStackInput   = document.getElementById('initial-stack-input');

    // プライズ
    this.entryFeeInput = document.getElementById('entry-fee-input');
    this.prizePoolDisplay = document.getElementById('prize-pool-display');

    // タイマー管理
    this.timerSelect   = document.getElementById('timer-select');
    this.timerNameInput = document.getElementById('timer-name-input');
    this.levelsList    = document.getElementById('levels-list');

    // ブレイク管理
    this.breaksList    = document.getElementById('breaks-list');
  

    // プライズ設定
    this.prizeListAdmin = document.getElementById('prize-list-admin');

    // ボタン
    this.newTimerBtn   = document.getElementById('new-timer-btn');
    this.addLevelBtn   = document.getElementById('add-level-btn');
    this.addBreakBtn   = document.getElementById('add-break-btn');
    this.addPrizeBtn   = document.getElementById('add-prize-btn');

    // コントロール
    this.prevLevelBtn  = document.getElementById('prev-level-btn');
    this.startStopBtn  = document.getElementById('start-stop-btn');
    this.nextLevelBtn  = document.getElementById('next-level-btn');
    this.breakCutBtn   = document.getElementById('break-cut-btn');
    this.updateBtn     = document.getElementById('update-btn');

    // 管理操作
    this.saveBtn       = document.getElementById('save-btn');
    this.resetTimerBtn = document.getElementById('reset-timer-btn');
    this.wipeDataBtn   = document.getElementById('wipe-data-btn');
  }

  _wireEvents() {
    const onBasicChange = () => this._updateTournamentData();
    this.tournamentNameInput.addEventListener('input', onBasicChange);
    this.currentPlayersInput.addEventListener('input', onBasicChange);
    this.totalEntriesInput.addEventListener('input', onBasicChange);
    this.initialStackInput.addEventListener('input', onBasicChange);
    this.entryFeeInput.addEventListener('input', onBasicChange);

    this.timerSelect.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10);
      if (Number.isInteger(idx)) {
        this.timer.selectTimer(idx);
        this._renderTimerDetails();
        this._renderBreakLevelOptions();
      }
    });

    this.newTimerBtn.addEventListener('click', () => this._createNewTimer());
    this.addLevelBtn.addEventListener('click', () => { this._addLevel(); this._renderBreakLevelOptions(); });
    this.addBreakBtn.addEventListener('click', () => this._addBreak());
    this.addPrizeBtn.addEventListener('click', () => this._addPrize());

    this._on(this.addBreakBtn, "click", () => this._promptAddBreak());
    this.prevLevelBtn.addEventListener('click', () => { this.timer.prevLevel(); this._renderTimerControls(); });
    this.startStopBtn.addEventListener('click', () => this._toggleTimer());
    this.nextLevelBtn.addEventListener('click', () => { this.timer.nextLevel(); this._renderTimerControls(); });
    this.breakCutBtn.addEventListener('click', () => this._breakCut());
    this.updateBtn.addEventListener('click', () => this._doUpdate());

    this.saveBtn.addEventListener('click', () => this._saveAll());
    this.resetTimerBtn.addEventListener('click', () => this._resetTimer());
    this.wipeDataBtn.addEventListener('click', () => this._wipeAllData());

    window.addEventListener('storage', (e) => {
      if (e.key === 'tournamentTimer' || e.key === 'tournamentData' || e.key === 'tournamentPrizes') {
        this._loadAll();
        this._renderAll();
      }
    });

    this.timer.onLevelChange = () => this._renderTimerControls();
    this.timer.onTimeUpdate = () => this._renderTimerControls();
  }

  _loadAll() {
    this.timer.loadData();
    const td = localStorage.getItem('tournamentData');
    if (td) { try { this.tournamentData = { ...this.tournamentData, ...(JSON.parse(td) || {}) }; } catch {} }
    const p = localStorage.getItem('tournamentPrizes');
    if (p) { try { this.tournamentData.rewards = Array.isArray(JSON.parse(p)) ? JSON.parse(p) : this.tournamentData.rewards; } catch {} }
  }

  _saveTournamentData() {
    localStorage.setItem('tournamentData', JSON.stringify(this.tournamentData));
    localStorage.setItem('tournamentPrizes', JSON.stringify(this.tournamentData.rewards || []));
  }

  _saveAll() { this._saveTournamentData(); alert('保存しました'); }

  _renderAll() {
    this._renderBasicInputs();
    this._renderPrizePool();
    this._renderTimerSelect();
    this._renderTimerDetails();
    this._renderBreakLevelOptions();
    this._renderPrizes();
    this._renderTimerControls();
  }

  _renderBasicInputs() {
    this.tournamentNameInput.value = this.tournamentData.name || '';
    this.currentPlayersInput.value = this.tournamentData.currentPlayers ?? 0;
    this.totalEntriesInput.value   = this.tournamentData.totalEntries ?? 0;
    this.initialStackInput.value   = this.tournamentData.initialStack ?? 10000;
    this.entryFeeInput.value       = this.tournamentData.entryFee ?? 0;
  }

  _renderPrizePool() {
    const totalPool = (this.tournamentData.entryFee || 0) * (this.tournamentData.totalEntries || 0);
    this.prizePoolDisplay.textContent = `${totalPool.toLocaleString()}円`;
  }

  _renderTimerSelect() {
    this.timerSelect.innerHTML = '';
    this.timer.timers.forEach((t, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = t.name || `タイマー ${idx + 1}`;
      if (idx === this.timer.currentTimerIndex) opt.selected = true;
      this.timerSelect.appendChild(opt);
    });
  }

  _renderTimerDetails() {
    const t = this.timer.getCurrentTimer();
    if (!t) return;

    this.timerNameInput.value = t.name || '';
    this.timerNameInput.oninput = () => { t.name = this.timerNameInput.value; this._renderTimerSelect(); this.timer._persist(); };

    // レベル一覧
    this.levelsList.innerHTML = '';
    t.levels.forEach((level, i) => {
      const item = document.createElement('div');
      item.className = 'level-item';
      item.innerHTML = `
        <div class="level-header">
          <span>Level ${i + 1}</span>
          <button class="btn btn-small btn-danger">削除</button>
        </div>
      `;
      const inputs = document.createElement('div');
      inputs.className = 'level-inputs';

      const mk = (label, key, val) => {
        const wrap = document.createElement('label');
        wrap.textContent = label + ' ';
        const input = document.createElement('input');
        input.type = 'number';
        input.value = val;
        input.addEventListener('change', () => {
          const v = parseInt(input.value, 10);
          level[key] = Number.isFinite(v) ? v : 0;
          this.timer._persist();
          this._renderBreakLevelOptions();
        });
        wrap.appendChild(input);
        return wrap;
      };
      inputs.appendChild(mk('分数:', 'duration', level.duration));
      inputs.appendChild(mk('SB:', 'sb', level.sb));
      inputs.appendChild(mk('BB:', 'bb', level.bb));
      inputs.appendChild(mk('ANTE:', 'ante', level.ante));

      item.appendChild(inputs);

      // 削除
      item.querySelector('.btn-danger').addEventListener('click', () => {
        if (t.levels.length <= 1) return;

        // レベル削除に伴うブレイク整合
        const delIndex = i;
        t.levels.splice(delIndex, 1);
        if (Array.isArray(t.breaks)) {
          t.breaks = t.breaks
            .filter(b => b.level !== delIndex)           // そのレベル直後のブレイクは削除
            .map(b => ({ ...b, level: b.level > delIndex ? b.level - 1 : b.level })); // インデックス詰め
        }

        if (this.timer.currentLevelIndex >= t.levels.length) {
          this.timer.currentLevelIndex = t.levels.length - 1;
        }
        const lv = this.timer.getCurrentLevel();
        this.timer.timeRemaining = lv ? lv.duration * 60 : 0;
        this.timer._persist();
        this._renderTimerDetails();
        this._renderBreakLevelOptions();
      });

      this.levelsList.appendChild(item);
    });

    // 既存ブレイク一覧
    this._renderBreaksList();
  }

  _renderBreaksList() {
    const t = this.timer.getCurrentTimer();
    this.breaksList.innerHTML = '';
    (t.breaks || []).forEach((br, i) => {
      const item = document.createElement('div');
      item.className = 'break-item';
      item.innerHTML = `
        <div class="break-header">
          <span>ブレイク (Level ${br.level + 1} の後)</span>
          <button class="btn btn-small btn-danger">削除</button>
        </div>
      `;
      const inputs = document.createElement('div');
      inputs.className = 'break-inputs';

      const wrap = document.createElement('label');
      wrap.textContent = '休憩時間: ';
      const input = document.createElement('input');
      input.type = 'number';
      input.value = br.duration;
      input.addEventListener('change', () => {
        const v = parseInt(input.value, 10);
        br.duration = Number.isFinite(v) ? v : 0;
        this.timer._persist();
      });
      const suffix = document.createTextNode(' 分');
      wrap.appendChild(input);
      inputs.appendChild(wrap);
      inputs.appendChild(suffix);
      item.appendChild(inputs);

      item.querySelector('.btn-danger').addEventListener('click', () => {
        t.breaks.splice(i, 1);
        this.timer._persist();
        this._renderBreaksList();
      });

      this.breaksList.appendChild(item);
    });
  }

  _renderBreakLevelOptions() {
    const t = this.timer.getCurrentTimer();
    this.breakLevelSelect.innerHTML = '';
    if (!t) return;
    t.levels.forEach((lv, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `Level ${idx + 1} の後`;
      this.breakLevelSelect.appendChild(opt);
    });
  }

  _renderPrizes() {
    this.prizeListAdmin.innerHTML = '';
    const rewards = Array.isArray(this.tournamentData.rewards) ? this.tournamentData.rewards : [];
    rewards.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'prize-item-admin';
      row.innerHTML = `
        <span>${i + 1}位: ${p}</span>
        <button class="btn btn-small btn-danger">削除</button>
      `;
      row.querySelector('.btn-danger').addEventListener('click', () => {
        rewards.splice(i, 1);
        this._saveTournamentData();
        this._renderPrizes();
      });
      this.prizeListAdmin.appendChild(row);
    });
  }

  _renderTimerControls() {
    const running = this.timer.isRunning;
    this.startStopBtn.textContent = running ? 'ストップ' : 'スタート';
    this.breakCutBtn.disabled = !this.timer.isBreak;
  }

  _updateTournamentData() {
    this.tournamentData = {
      name: this.tournamentNameInput.value,
      currentPlayers: parseInt(this.currentPlayersInput.value, 10) || 0,
      totalEntries:  parseInt(this.totalEntriesInput.value, 10)  || 0,
      initialStack:  parseInt(this.initialStackInput.value, 10)  || 10000,
      entryFee:      parseInt(this.entryFeeInput.value, 10)      || 0,
      rewards: Array.isArray(this.tournamentData.rewards) ? this.tournamentData.rewards : [],
    };
    this._renderPrizePool();
    this._saveTournamentData();
  }

  _createNewTimer() {
    const levels = [];
    let sb = 1, bb = 2, ante = 2;
    for (let i = 0; i < 6; i += 1) {
      levels.push({ duration: 20, sb, bb, ante }); // 実用向け：各20分
      sb *= 2; bb *= 2; ante *= 2;
    }
    const t = { id: `timer_${Date.now()}`, name: '新規タイマー', levels, breaks: [] };
    this.timer.addTimer(t);
    this.timer.selectTimer(this.timer.timers.length - 1);
    this._renderTimerSelect();
    this._renderTimerDetails();
    this._renderBreakLevelOptions();
  }

  _addLevel() {
    const cur = this.timer.getCurrentTimer();
    if (!cur) return;
    const last = cur.levels[cur.levels.length - 1];
    const nl = {
      duration: last ? last.duration : 20,
      sb: last ? last.sb * 2 : 1,
      bb: last ? last.bb * 2 : 2,
      ante: last ? last.ante * 2 : 2,
    };
    cur.levels.push(nl);
    this.timer._persist();
    this._renderTimerDetails();
    this._renderBreakLevelOptions();
  }

 
// ★ プロンプトでブレイク追加する完全版（HTMLの要素に依存しない）
_promptAddBreak() {
  const t = this.timer.getCurrentTimer();
  if (!t) return;

  const max = t.levels.length;

  // 1) どのレベルの後か？
  const levelStr = prompt(`どのレベルの「後」にブレイクを入れますか？（1〜${max}）`, "1");
  if (!levelStr) return;
  const levelIndex = parseInt(levelStr, 10) - 1;
  if (isNaN(levelIndex) || levelIndex < 0 || levelIndex >= max) {
    alert("正しいレベル番号を入力してください");
    return;
  }

  // 2) 休憩時間（分）
  const durationStr = prompt("ブレイク時間（分）を入力してください", "10");
  if (!durationStr) return;
  const minutes = parseInt(durationStr, 10);
  if (isNaN(minutes) || minutes <= 0) {
    alert("休憩時間は正の整数で入力してください");
    return;
  }

  // 3) 保存
  t.breaks = Array.isArray(t.breaks) ? t.breaks : [];
  const existedIndex = t.breaks.findIndex(b => b.level === levelIndex);
  if (existedIndex >= 0) {
    t.breaks[existedIndex].duration = minutes; // 上書き
  } else {
    t.breaks.push({ level: levelIndex, duration: minutes });
  }

  t.breaks.sort((a, b) => a.level - b.level);
  this.timer._persist();

  alert(`Level ${levelIndex + 1} の後に ${minutes}分 のブレイクを設定しました！`);

  // UI反映（breaks-list がある場合）
  if (this.breaksList) this._renderBreaksList();
}


  _addPrize() {
    const p = prompt('プライズを入力してください（例: 10000円、景品など）:', '');
    if (!p) return;
    this.tournamentData.rewards = Array.isArray(this.tournamentData.rewards) ? this.tournamentData.rewards : [];
    this.tournamentData.rewards.push(p);
    this._saveTournamentData();
    this._renderPrizes();
  }

  _toggleTimer() {
    if (this.timer.isRunning) this.timer.stop();
    else this.timer.start();
    this._renderTimerControls();
  }

  _breakCut() {
    if (!this.timer.isBreak) return;
    this.timer.timeRemaining = 30;
    this.timer._persist();
    this._renderTimerControls();
  }

  _doUpdate() {
    this.timer._persist();
    this._saveTournamentData();
    alert('更新しました！');
  }

  _resetTimer() {
    if (!confirm('タイマーをリセットしますか？')) return;
    this.timer.reset();
    alert('タイマーをリセットしました');
  }

  _wipeAllData() {
    if (!confirm('全データを初期化してもよろしいですか？（保存されたタイマー/大会情報は消去されます）')) return;
    localStorage.removeItem('tournamentTimer');
    localStorage.removeItem('tournamentData');
    localStorage.removeItem('tournamentPrizes');
    location.reload();
  }
}

document.addEventListener('DOMContentLoaded', () => new AdminPanel());
