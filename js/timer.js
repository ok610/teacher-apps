/* ============================================================
   timer.js
   Timer 기능 전체 로직
   ------------------------------------------------------------
   Teacher Apps의 핵심 기능. 아래 5개 영역으로 구성됩니다.
     1) 카운트다운 엔진 (start/pause/reset/tick)
     2) 원형 Progress Ring 렌더링
     3) 즐겨찾기 시간 (추가/수정/삭제, LocalStorage)
     4) 시간 설정 Sheet (Stepper 방식 - 큰 버튼, 조작 단순)
     5) 설정 Sheet (색상/배경/사운드/애니메이션/다크모드)
   ============================================================ */

const Timer = (() => {
  const RING_RADIUS = 120; // SVG viewBox 기준 반지름 (viewBox="0 0 260 260")
  const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  const RING_COLORS = ["#FF9F43", "#5E5CE6", "#FF453A", "#34C759", "#0A84FF", "#FF375F"];
  const BG_TINTS = ["none", "#FFF4E8", "#EEF0FF", "#FFECEC", "#E9FBEF", "#E9F3FF"];

  // ---------- 상태 ----------
  let els = {};
  let state = {
    totalSeconds: 0,
    remainingSeconds: 0,
    isRunning: false,
    isFinished: false,
    intervalId: null,
    pickerMinutes: 5,
  };
  let settings = {};
  let favorites = [];

  // ---------- 초기화 ----------
  function init(root) {
    cacheEls(root);
    loadSettings();
    favorites = Storage.get("timer", "favorites", []);

    bindEvents();
    applySettingsToUI();
    renderFavorites();
    renderRing();
    updateTimeDisplay();
    updatePlayIcon();
  }

  function cacheEls(root) {
    els.root = root;
    els.ringProgress = root.querySelector(".timer-ring__progress");
    els.timeText = root.querySelector(".timer-ring__time");
    els.stateText = root.querySelector(".timer-ring__state");
    els.presetLabel = root.querySelector(".timer-preset-label");
    els.playBtn = root.querySelector('[data-action="toggle"]');
    els.playBtnIcon = els.playBtn.querySelector("[data-icon]");
    els.resetBtn = root.querySelector('[data-action="reset"]');
    els.editBtn = root.querySelector('[data-action="edit-time"]');
    els.favList = root.querySelector(".favorites__list");
    els.favEditBtn = root.querySelector('[data-action="edit-favorites"]');

    // Sheets
    els.overlay = document.getElementById("sheet-overlay");
    els.timeSheet = document.getElementById("time-sheet");
    els.settingsSheet = document.getElementById("settings-sheet");
    els.favEditSheet = document.getElementById("fav-edit-sheet");
  }

  function bindEvents() {
    els.playBtn.addEventListener("click", toggleRun);
    els.resetBtn.addEventListener("click", resetTimer);
    els.editBtn.addEventListener("click", openTimeSheet);
    els.favEditBtn.addEventListener("click", openFavEditSheet);
    els.favList.addEventListener("click", handleFavoriteClick);
    // 설정 버튼은 헤더에 동적으로 생성되므로 CustomEvent로 연결 (app.js 참고)
    document.addEventListener("open-timer-settings", openSettingsSheet);

    // Time Sheet
    document.querySelectorAll("#time-sheet [data-step]").forEach((btn) => {
      btn.addEventListener("click", () => stepPicker(Number(btn.dataset.step)));
    });
    document.getElementById("time-sheet-confirm").addEventListener("click", confirmTimeSheet);
    document.getElementById("time-sheet-close").addEventListener("click", closeAllSheets);

    // Settings Sheet
    document.getElementById("settings-sheet-close").addEventListener("click", closeAllSheets);
    buildColorSwatches();
    buildBgSwatches();
    buildSoundOptions();
    document.getElementById("toggle-animation").addEventListener("click", toggleAnimation);
    document.getElementById("toggle-darkmode").addEventListener("click", toggleDarkMode);

    // Fav edit sheet
    document.getElementById("fav-edit-close").addEventListener("click", closeAllSheets);

    // Overlay click = close all sheets
    els.overlay.addEventListener("click", closeAllSheets);
  }

  /* ============================================================
     1) 카운트다운 엔진
     ============================================================ */

  function setDuration(totalSeconds, presetLabel) {
    stopInterval();
    state.totalSeconds = totalSeconds;
    state.remainingSeconds = totalSeconds;
    state.isRunning = false;
    state.isFinished = false;
    els.root.classList.remove("is-flashing");
    els.stateText.textContent = "준비";
    els.presetLabel.innerHTML = presetLabel
      ? `설정 : <strong>${presetLabel}</strong>`
      : "설정 : <strong>-</strong>";
    updatePlayIcon();
    renderRing();
    updateTimeDisplay();
  }

  function toggleRun() {
    if (state.totalSeconds === 0) {
      openTimeSheet();
      return;
    }
    if (state.isFinished) {
      resetTimer();
      return;
    }
    state.isRunning ? pauseTimer() : startTimer();
  }

  function startTimer() {
    if (state.remainingSeconds <= 0) return;
    Sounds.unlock();
    state.isRunning = true;
    els.stateText.textContent = "진행 중";
    updatePlayIcon();
    stopInterval();
    state.intervalId = window.setInterval(tick, 1000);
  }

  function pauseTimer() {
    state.isRunning = false;
    els.stateText.textContent = "일시정지";
    updatePlayIcon();
    stopInterval();
  }

  function resetTimer() {
    stopInterval();
    state.remainingSeconds = state.totalSeconds;
    state.isRunning = false;
    state.isFinished = false;
    els.root.classList.remove("is-flashing");
    els.stateText.textContent = "준비";
    updatePlayIcon();
    renderRing();
    updateTimeDisplay();
  }

  function tick() {
    state.remainingSeconds -= 1;

    if (state.remainingSeconds <= 60 && state.remainingSeconds > 0) {
      if (settings.animation) els.root.classList.add("is-flashing");
      els.ringProgress.classList.add("is-warning");
    }

    if (state.remainingSeconds <= 0) {
      finishTimer();
      return;
    }

    renderRing();
    updateTimeDisplay();
  }

  function finishTimer() {
    stopInterval();
    state.remainingSeconds = 0;
    state.isRunning = false;
    state.isFinished = true;
    els.root.classList.remove("is-flashing");
    els.stateText.textContent = "완료!";
    updatePlayIcon();
    renderRing();
    updateTimeDisplay();
    Sounds.play(settings.sound);
    if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
  }

  function stopInterval() {
    if (state.intervalId) {
      window.clearInterval(state.intervalId);
      state.intervalId = null;
    }
  }

  function updatePlayIcon() {
    els.playBtnIcon.innerHTML = state.isRunning ? Icons.pause : Icons.play;
  }

  function updateTimeDisplay() {
    els.timeText.textContent = formatTime(state.remainingSeconds);
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  /* ============================================================
     2) 원형 Progress Ring
     ============================================================ */

  function renderRing() {
    const ratio = state.totalSeconds > 0 ? state.remainingSeconds / state.totalSeconds : 0;
    const offset = CIRCUMFERENCE * (1 - ratio);
    els.ringProgress.style.strokeDasharray = `${CIRCUMFERENCE}`;
    els.ringProgress.style.strokeDashoffset = `${offset}`;
    if (state.remainingSeconds > 60 || state.totalSeconds === 0) {
      els.ringProgress.classList.remove("is-warning");
    }
  }

  /* ============================================================
     3) 즐겨찾기
     ============================================================ */

  function renderFavorites() {
    const chips = favorites
      .map(
        (sec) => `
        <button class="favorite-chip" data-seconds="${sec}">
          ${formatFavoriteLabel(sec)}
        </button>`
      )
      .join("");

    els.favList.innerHTML = `
      ${chips}
      <button class="favorite-chip favorite-chip--add" data-action="add-favorite">+ 추가</button>
    `;
  }

  function formatFavoriteLabel(totalSeconds) {
    const m = Math.round(totalSeconds / 60);
    return `${m}분`;
  }

  function handleFavoriteClick(event) {
    const addBtn = event.target.closest('[data-action="add-favorite"]');
    if (addBtn) {
      openTimeSheet({ mode: "add-favorite" });
      return;
    }
    const chip = event.target.closest(".favorite-chip[data-seconds]");
    if (chip) {
      const seconds = Number(chip.dataset.seconds);
      setDuration(seconds, formatFavoriteLabel(seconds));
    }
  }

  function saveFavorites() {
    Storage.set("timer", "favorites", favorites);
    renderFavorites();
  }

  function openFavEditSheet() {
    const list = document.getElementById("fav-edit-list");
    if (favorites.length === 0) {
      list.innerHTML = `<p style="color:var(--text-secondary); padding: 16px 4px;">즐겨찾기가 없습니다. 타이머 화면에서 "+ 추가"를 눌러 등록해보세요.</p>`;
    } else {
      list.innerHTML = favorites
        .map(
          (sec, idx) => `
          <div class="fav-edit-row">
            <span class="fav-edit-row__label">${formatFavoriteLabel(sec)}</span>
            <button class="fav-edit-row__remove" data-idx="${idx}">삭제</button>
          </div>`
        )
        .join("");
      list.querySelectorAll("[data-idx]").forEach((btn) => {
        btn.addEventListener("click", () => {
          favorites.splice(Number(btn.dataset.idx), 1);
          saveFavorites();
          openFavEditSheet();
        });
      });
    }
    openSheet(els.favEditSheet);
  }

  /* ============================================================
     4) 시간 설정 Sheet (Stepper)
     ============================================================ */

  let pickerMode = "set"; // "set" | "add-favorite"

  function openTimeSheet(opts = {}) {
    pickerMode = opts.mode === "add-favorite" ? "add-favorite" : "set";
    state.pickerMinutes = state.totalSeconds > 0 ? Math.round(state.totalSeconds / 60) : 5;
    updatePickerDisplay();
    document.getElementById("time-sheet-title").textContent =
      pickerMode === "add-favorite" ? "즐겨찾기 추가" : "시간 설정";
    openSheet(els.timeSheet);
  }

  function stepPicker(delta) {
    state.pickerMinutes = Math.min(120, Math.max(1, state.pickerMinutes + delta));
    updatePickerDisplay();
  }

  function updatePickerDisplay() {
    document.getElementById("time-picker-value").textContent = `${state.pickerMinutes}분`;
  }

  function confirmTimeSheet() {
    const seconds = state.pickerMinutes * 60;
    if (pickerMode === "add-favorite") {
      if (!favorites.includes(seconds)) {
        favorites.push(seconds);
        favorites.sort((a, b) => a - b);
        saveFavorites();
      }
    } else {
      setDuration(seconds, `${state.pickerMinutes}분`);
    }
    closeAllSheets();
  }

  /* ============================================================
     5) 설정 Sheet
     ============================================================ */

  function loadSettings() {
    settings = Storage.get("timer", "settings", {
      ringColor: RING_COLORS[0],
      bgTint: BG_TINTS[0],
      sound: "bell",
      animation: true,
      darkMode: false,
    });
  }

  function saveSettings() {
    Storage.set("timer", "settings", settings);
  }

  function applySettingsToUI() {
    document.documentElement.style.setProperty("--color-timer", settings.ringColor);
    const wrap = document.querySelector(".timer-ring-wrap");
    if (wrap) {
      wrap.style.background =
        settings.bgTint === "none" ? "transparent" : settings.bgTint;
      wrap.style.borderRadius = "32px";
      wrap.style.transition = "background var(--duration-medium) var(--ease-standard)";
    }
    document.documentElement.setAttribute(
      "data-theme",
      settings.darkMode ? "dark" : "auto"
    );
    Storage.set("app", "darkMode", settings.darkMode);
  }

  function openSettingsSheet() {
    refreshSettingsUI();
    openSheet(els.settingsSheet);
  }

  function buildColorSwatches() {
    const row = document.getElementById("color-swatches");
    row.innerHTML = RING_COLORS.map(
      (c) => `<button class="swatch" style="background:${c}" data-color="${c}"></button>`
    ).join("");
    row.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-color]");
      if (!btn) return;
      settings.ringColor = btn.dataset.color;
      saveSettings();
      applySettingsToUI();
      refreshSettingsUI();
    });
  }

  function buildBgSwatches() {
    const row = document.getElementById("bg-swatches");
    row.innerHTML = BG_TINTS.map(
      (c, i) =>
        `<button class="swatch" style="background:${
          c === "none" ? "var(--bg-secondary)" : c
        }" data-bg="${c}">${i === 0 ? "✕" : ""}</button>`
    ).join("");
    row.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-bg]");
      if (!btn) return;
      settings.bgTint = btn.dataset.bg;
      saveSettings();
      applySettingsToUI();
      refreshSettingsUI();
    });
  }

  function buildSoundOptions() {
    const list = document.getElementById("sound-options");
    list.innerHTML = Sounds.list()
      .map(
        (s) => `
        <button class="sound-option" data-sound="${s.id}">
          <span class="sound-option__preview">${s.label}</span>
          <svg class="sound-option__check" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>`
      )
      .join("");
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sound]");
      if (!btn) return;
      settings.sound = btn.dataset.sound;
      saveSettings();
      Sounds.play(settings.sound);
      refreshSettingsUI();
    });
  }

  function toggleAnimation() {
    settings.animation = !settings.animation;
    saveSettings();
    refreshSettingsUI();
  }

  function toggleDarkMode() {
    settings.darkMode = !settings.darkMode;
    saveSettings();
    applySettingsToUI();
    refreshSettingsUI();
  }

  function refreshSettingsUI() {
    document.querySelectorAll("#color-swatches .swatch").forEach((el) => {
      el.classList.toggle("is-selected", el.dataset.color === settings.ringColor);
    });
    document.querySelectorAll("#bg-swatches .swatch").forEach((el) => {
      el.classList.toggle("is-selected", el.dataset.bg === settings.bgTint);
    });
    document.querySelectorAll("#sound-options .sound-option").forEach((el) => {
      el.classList.toggle("is-selected", el.dataset.sound === settings.sound);
    });
    document
      .getElementById("toggle-animation")
      .classList.toggle("is-on", settings.animation);
    document
      .getElementById("toggle-darkmode")
      .classList.toggle("is-on", settings.darkMode);
  }

  /* ============================================================
     Sheet 공통 열기/닫기
     ============================================================ */

  function openSheet(sheetEl) {
    els.overlay.classList.add("is-open");
    sheetEl.classList.add("is-open");
  }

  function closeAllSheets() {
    els.overlay.classList.remove("is-open");
    [els.timeSheet, els.settingsSheet, els.favEditSheet].forEach((s) =>
      s.classList.remove("is-open")
    );
  }

  return { init, setDuration };
})();
