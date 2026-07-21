/* ============================================================
   timer.js
   Timer 기능 전체 로직
   ------------------------------------------------------------
   Teacher Apps의 핵심 기능. 아래 영역으로 구성됩니다.
     1) 상태 머신 (idle → running ⇄ paused → finished → idle)
     2) 다이얼 렌더링 (트랙 + 진행 arc + 5분 단위 눈금 + 손잡이)
     3) 드래그로 시간 설정 (Pointer Events, idle 상태에서만 동작)
     4) 세밀 조정 버튼 (-1분 / -10초 / +10초 / +1분)
     5) 즐겨찾기 (이름+시간, Chip 목록, 설정 패널에서 추가/삭제/순서변경)
     6) 종료 임박 3단계 연출 + 종료 화면
     7) 설정 패널 (테마 / 효과음 / 즐겨찾기 관리 / 옵션)

   ⭐ 다이얼은 0~60분을 하나의 시계 문장(clock face)으로 표현합니다.
      (Apple Timer의 다이얼 방식을 참고). 그래서 드래그로 설정 가능한
      최대값도 60분입니다.
   ============================================================ */

const Timer = (() => {
  // ---------- 다이얼 SVG 좌표 상수 ----------
  const CX = 150;
  const CY = 150;
  const TRACK_R = 128; // 값을 키울수록 진행 밴드가 바깥 원 테두리에 더 가까워짐
  const DIAL_MAX_SECONDS = 3600; // 60분 = 다이얼 한 바퀴
  const DRAG_SNAP_SECONDS = 15; // 드래그 시 스냅 단위 (부드러움과 정밀함의 균형)

  // ---------- 상태 ----------
  let els = {};
  let state = {
    phase: "idle", // idle | running | paused | finished
    totalSeconds: 0,
    remainingSeconds: 0,
    intervalId: null,
    warnStage: 0, // 0=평상시, 1=1분전, 2=30초전, 3=10초전
    isDragging: false,
    activeFavId: null, // 현재 설정된 시간이 어떤 즐겨찾기에서 왔는지 (Chip 강조 표시용)
  };
  let settings = {};
  let favorites = [];
  let dragCtx = null; // 즐겨찾기 순서 변경(드래그) 중 임시 정보

  // ---------- 초기화 ----------
  function init(root) {
    cacheEls(root);
    loadSettings();
    favorites = normalizeFavorites(Storage.get("timer", "favorites", []));

    renderTicks();
    bindEvents();
    Sounds.setVolume(settings.volume);
    renderFavorites();
    renderRing();
    updateTimeDisplay();
    updateControlsVisibility();
    updateHint();
  }

  // 예전 버전(숫자 배열)으로 저장된 즐겨찾기를 새 형식으로 자동 변환
  function normalizeFavorites(raw) {
    return raw.map((item) =>
      typeof item === "number"
        ? { id: genId(), name: "", minutes: Math.floor(item / 60), seconds: item % 60 }
        : item
    );
  }

  function genId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function cacheEls(root) {
    els.root = root;
    els.dial = document.getElementById("timer-dial");
    els.progressPath = document.getElementById("timer-progress-path");
    els.knob = document.getElementById("timer-knob");
    els.ticksGroup = document.getElementById("timer-ticks");
    els.timeText = document.getElementById("timer-time");
    els.stateText = document.getElementById("timer-state");
    els.hint = document.getElementById("timer-hint");

    els.resetBtn = document.getElementById("timer-reset-btn");
    els.primaryBtn = document.getElementById("timer-primary-btn");
    els.confirmBtn = document.getElementById("timer-confirm-btn");
    els.fineAdjustBtns = Array.from(root.querySelectorAll(".timer-fine-adjust__btn"));

    els.favList = document.getElementById("favorites-list");

    els.settingsOverlay = document.getElementById("settings-overlay");
    els.settingsPanel = document.getElementById("settings-panel");
  }

  function bindEvents() {
    els.resetBtn.addEventListener("click", resetTimer);
    els.primaryBtn.addEventListener("click", handlePrimaryClick);
    els.confirmBtn.addEventListener("click", dismissFinished);
    els.dial.addEventListener("click", () => {
      if (state.phase === "finished") dismissFinished();
    });
    els.favList.addEventListener("click", handleFavoriteClick);

    els.fineAdjustBtns.forEach((btn) => {
      btn.addEventListener("click", () => adjustDraft(Number(btn.dataset.adjust)));
    });

    bindDialDrag();

    // 설정 버튼은 헤더에 동적으로 생성되므로 CustomEvent로 연결 (app.js 참고)
    document.addEventListener("open-timer-settings", openSettingsPanel);
    els.favList.addEventListener("dblclick", openSettingsPanel); // 여분의 진입 경로(선택)

    document.getElementById("settings-panel-close").addEventListener("click", closeSettingsPanel);
    els.settingsOverlay.addEventListener("click", closeSettingsPanel);

    buildThemeGrid();
    buildSoundSelect();
    buildVolumeControl();
    document.getElementById("sound-preview").addEventListener("click", () => {
      Sounds.unlock();
      Sounds.play(settings.sound);
    });
    document.getElementById("fav-add-btn").addEventListener("click", handleAddFavorite);
    document.getElementById("toggle-tap-to-start").addEventListener("change", (e) => {
      settings.tapToStart = e.target.checked;
      saveSettings();
    });
  }

  /* ============================================================
     1) 상태 머신
     ============================================================ */

  function setPhase(phase) {
    state.phase = phase;
    updateControlsVisibility();
  }

  function handlePrimaryClick() {
    if (state.phase === "idle") {
      if (state.totalSeconds <= 0) return;
      startTimer();
    } else if (state.phase === "running") {
      pauseTimer();
    } else if (state.phase === "paused") {
      startTimer();
    }
  }

  function startTimer() {
    if (state.remainingSeconds <= 0) return;
    Sounds.unlock();
    setPhase("running");
    els.stateText.textContent = "진행 중";
    stopInterval();
    state.intervalId = window.setInterval(tick, 1000);
  }

  function pauseTimer() {
    setPhase("paused");
    els.stateText.textContent = "일시정지됨";
    stopInterval();
  }

  function resetTimer() {
    stopInterval();
    state.remainingSeconds = state.totalSeconds;
    clearWarnStage();
    els.dial.classList.remove("is-finished");
    setPhase("idle");
    els.stateText.textContent = "준비";
    renderRing();
    updateTimeDisplay();
    updateHint();
  }

  function tick() {
    state.remainingSeconds -= 1;
    updateWarnStage();

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
    clearWarnStage();
    els.dial.classList.add("is-finished");
    setPhase("finished");
    renderRing();
    updateTimeDisplay();
    Sounds.play(settings.sound);
    if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 200]);
  }

  function dismissFinished() {
    els.dial.classList.remove("is-finished");
    state.totalSeconds = 0;
    state.remainingSeconds = 0;
    if (state.activeFavId !== null) {
      state.activeFavId = null;
      renderFavorites();
    }
    setPhase("idle");
    els.stateText.textContent = "준비";
    renderRing();
    updateTimeDisplay();
    updateHint();
  }

  function stopInterval() {
    if (state.intervalId) {
      window.clearInterval(state.intervalId);
      state.intervalId = null;
    }
  }

  function updateTimeDisplay() {
    els.timeText.textContent = formatTime(state.remainingSeconds);
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function updateControlsVisibility() {
    const p = state.phase;
    els.resetBtn.hidden = p === "finished";
    els.primaryBtn.hidden = p === "finished";
    els.confirmBtn.hidden = p !== "finished";

    els.resetBtn.disabled = p === "idle" && state.totalSeconds === 0;
    els.primaryBtn.disabled = p === "idle" && state.totalSeconds === 0;
    els.primaryBtn.textContent = p === "running" ? "일시정지" : p === "paused" ? "재개" : "시작";

    const fineDisabled = p === "running" || p === "finished";
    els.fineAdjustBtns.forEach((b) => (b.disabled = fineDisabled));

    els.dial.classList.toggle("is-draggable", p === "idle");
  }

  /* ============================================================
     2) 다이얼 렌더링
     ------------------------------------------------------------
     남은 시간을 0~60분 다이얼 위의 각도로 표시합니다.
     (12시 방향이 0/60분, 시계 방향으로 진행)
     ============================================================ */

  function polarToCartesian(r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  }

  function describeArc(r, startDeg, endDeg) {
    if (endDeg <= startDeg) return "";
    const safeEnd = Math.min(endDeg, startDeg + 359.99);
    const start = polarToCartesian(r, startDeg);
    const end = polarToCartesian(r, safeEnd);
    const largeArc = safeEnd - startDeg > 180 ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  function renderTicks() {
    const marks = [];
    for (let m = 5; m <= 60; m += 5) {
      const angle = (m / 60) * 360;
      const pos = polarToCartesian(TRACK_R, angle);
      marks.push(`<text class="timer-dial__tick" x="${pos.x.toFixed(2)}" y="${pos.y.toFixed(2)}">${m}</text>`);
    }
    els.ticksGroup.innerHTML = marks.join("");
  }

  function renderRing() {
    const clamped = Math.min(state.remainingSeconds, DIAL_MAX_SECONDS);
    const sweepDeg = (clamped / DIAL_MAX_SECONDS) * 360;

    if (sweepDeg <= 0) {
      els.progressPath.setAttribute("d", "");
    } else if (sweepDeg >= 359.99) {
      const half1 = describeArc(TRACK_R, 0, 180);
      const half2 = describeArc(TRACK_R, 180, 359.99);
      els.progressPath.setAttribute("d", `${half1} ${half2}`);
    } else {
      els.progressPath.setAttribute("d", describeArc(TRACK_R, 0, sweepDeg));
    }

    const knobPos = polarToCartesian(TRACK_R, sweepDeg <= 0 ? 0.01 : Math.min(sweepDeg, 359.98));
    els.knob.setAttribute("cx", knobPos.x.toFixed(2));
    els.knob.setAttribute("cy", knobPos.y.toFixed(2));
  }

  /* ============================================================
     3) 드래그로 시간 설정 (Pointer Events)
     ============================================================ */

  function bindDialDrag() {
    els.dial.addEventListener("pointerdown", onDialPointerDown);
  }

  function onDialPointerDown(e) {
    if (state.phase !== "idle") return;
    e.preventDefault();
    state.isDragging = true;
    els.dial.classList.add("is-dragging");
    try {
      els.dial.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 일부 브라우저에서 미지원이어도 계속 동작 */
    }
    updateFromPointer(e);
    els.dial.addEventListener("pointermove", onDialPointerMove);
    els.dial.addEventListener("pointerup", onDialPointerUp);
    els.dial.addEventListener("pointercancel", onDialPointerUp);
  }

  function onDialPointerMove(e) {
    if (!state.isDragging) return;
    updateFromPointer(e);
  }

  function onDialPointerUp() {
    state.isDragging = false;
    els.dial.classList.remove("is-dragging");
    els.dial.removeEventListener("pointermove", onDialPointerMove);
    els.dial.removeEventListener("pointerup", onDialPointerUp);
    els.dial.removeEventListener("pointercancel", onDialPointerUp);
  }

  function updateFromPointer(e) {
    const rect = els.dial.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (angle < 0) angle += 360;

    const raw = (angle / 360) * DIAL_MAX_SECONDS;
    const snapped = Math.min(DIAL_MAX_SECONDS, Math.round(raw / DRAG_SNAP_SECONDS) * DRAG_SNAP_SECONDS);
    applyDraftSeconds(snapped);
  }

  function applyDraftSeconds(seconds) {
    state.totalSeconds = seconds;
    state.remainingSeconds = seconds;
    if (state.activeFavId !== null) {
      state.activeFavId = null;
      renderFavorites();
    }
    renderRing();
    updateTimeDisplay();
    updateControlsVisibility();
    updateHint();
  }

  /* ============================================================
     4) 세밀 조정 버튼
     ============================================================ */

  function adjustDraft(deltaSeconds) {
    if (state.phase === "running" || state.phase === "finished") return;
    const next = Math.max(0, Math.min(DIAL_MAX_SECONDS, state.totalSeconds + deltaSeconds));
    state.totalSeconds = next;
    state.remainingSeconds = next;
    if (state.activeFavId !== null) {
      state.activeFavId = null;
      renderFavorites();
    }
    renderRing();
    updateTimeDisplay();
    updateControlsVisibility();
    updateHint();
  }

  function updateHint() {
    if (state.phase === "idle") {
      els.hint.textContent = state.totalSeconds === 0 ? "다이얼을 돌려 시간을 설정하세요" : "";
    } else {
      els.hint.textContent = "";
    }
  }

  /* ============================================================
     5) 즐겨찾기
     ============================================================ */

  function favSeconds(fav) {
    return fav.minutes * 60 + fav.seconds;
  }

  function renderFavorites() {
    if (favorites.length === 0) {
      els.favList.innerHTML = `<p class="favorites__empty">설정에서 즐겨찾기를 추가해보세요.</p>`;
      return;
    }
    els.favList.innerHTML = favorites
      .map(
        (fav) => `
        <button class="chip favorite-chip${fav.id === state.activeFavId ? " is-active" : ""}" data-id="${fav.id}">
          ${fav.name ? `<span class="favorite-chip__name">${escapeHtml(fav.name)}</span>` : ""}
          <span class="favorite-chip__time">${formatTime(favSeconds(fav))}</span>
        </button>`
      )
      .join("");
  }

  function handleFavoriteClick(event) {
    const chip = event.target.closest(".favorite-chip[data-id]");
    if (!chip) return;
    const fav = favorites.find((f) => f.id === chip.dataset.id);
    if (!fav) return;

    if (state.phase === "running") return; // 진행 중에는 즐겨찾기로 덮어쓰지 않음

    stopInterval();
    clearWarnStage();
    els.dial.classList.remove("is-finished");
    state.totalSeconds = favSeconds(fav);
    state.remainingSeconds = state.totalSeconds;
    state.activeFavId = fav.id;
    setPhase("idle");
    els.stateText.textContent = "준비";
    renderRing();
    updateTimeDisplay();
    updateHint();
    renderFavorites();

    if (settings.tapToStart) startTimer();
  }

  function saveFavorites() {
    Storage.set("timer", "favorites", favorites);
    renderFavorites();
    renderFavManageList();
  }

  function handleAddFavorite() {
    const nameInput = document.getElementById("fav-name-input");
    const minInput = document.getElementById("fav-min-input");
    const secInput = document.getElementById("fav-sec-input");

    const name = nameInput.value.trim().slice(0, 12);
    const minutes = Math.max(0, Math.min(60, Math.floor(Number(minInput.value)) || 0));
    const seconds = Math.max(0, Math.min(59, Math.floor(Number(secInput.value)) || 0));
    if (minutes === 0 && seconds === 0) return;

    favorites.push({ id: genId(), name, minutes, seconds });
    saveFavorites();
    nameInput.value = "";
  }

  function renderFavManageList(highlightId) {
    const list = document.getElementById("fav-manage-list");
    if (favorites.length === 0) {
      list.innerHTML = `<p class="empty-state">아직 즐겨찾기가 없습니다.</p>`;
      return;
    }
    list.innerHTML = favorites
      .map(
        (fav) => `
        <div class="fav-manage-row${fav.id === highlightId ? " is-dragging" : ""}" data-id="${fav.id}">
          <span class="fav-manage-row__handle" aria-label="순서 변경">⠿</span>
          <span class="fav-manage-row__label">${fav.name ? escapeHtml(fav.name) : "(이름 없음)"}</span>
          <span class="fav-manage-row__time">${formatTime(favSeconds(fav))}</span>
          <button class="fav-manage-row__remove" data-id="${fav.id}">삭제</button>
        </div>`
      )
      .join("");

    list.querySelectorAll(".fav-manage-row__remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        favorites = favorites.filter((f) => f.id !== btn.dataset.id);
        saveFavorites();
      });
    });
    list.querySelectorAll(".fav-manage-row").forEach((row) => {
      const handle = row.querySelector(".fav-manage-row__handle");
      handle.addEventListener("pointerdown", (e) => onRowDragStart(e, row.dataset.id));
    });
  }

  // ---------- 즐겨찾기 순서 변경 (Pointer Events 기반 드래그) ----------
  function onRowDragStart(e, favId) {
    e.preventDefault();
    dragCtx = { id: favId, startY: e.clientY };
    const list = document.getElementById("fav-manage-list");
    const row = list.querySelector(`[data-id="${favId}"]`);
    if (row) row.classList.add("is-dragging");
    document.addEventListener("pointermove", onRowDragMove);
    document.addEventListener("pointerup", onRowDragEnd, { once: true });
  }

  function onRowDragMove(e) {
    if (!dragCtx) return;
    const list = document.getElementById("fav-manage-list");
    const row = list.querySelector(`[data-id="${dragCtx.id}"]`);
    if (!row) return;

    row.style.transform = `translateY(${e.clientY - dragCtx.startY}px)`;

    const draggingIndex = favorites.findIndex((f) => f.id === dragCtx.id);
    const rows = Array.from(list.querySelectorAll(".fav-manage-row"));
    for (const other of rows) {
      if (other === row) continue;
      const rect = other.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      const otherIndex = favorites.findIndex((f) => f.id === other.dataset.id);
      const crossedDown = draggingIndex < otherIndex && e.clientY > middle;
      const crossedUp = draggingIndex > otherIndex && e.clientY < middle;
      if (crossedDown || crossedUp) {
        const [item] = favorites.splice(draggingIndex, 1);
        favorites.splice(otherIndex, 0, item);
        renderFavManageList(dragCtx.id);
        dragCtx.startY = e.clientY;
        break;
      }
    }
  }

  function onRowDragEnd() {
    document.removeEventListener("pointermove", onRowDragMove);
    dragCtx = null;
    saveFavorites();
  }

  /* ============================================================
     6) 종료 임박 3단계 연출
     ------------------------------------------------------------
     1분 전: 다이얼 전체가 천천히 깜빡임 (is-warn-1)
     30초 전: 진행 arc가 경고색으로 전환 (is-warning)
     10초 전: 매 초마다 중앙 숫자가 박동 - 남은 시간이 적을수록 더 강하게
     ============================================================ */

  function updateWarnStage() {
    const r = state.remainingSeconds;
    let stage = 0;
    if (r <= 10) stage = 3;
    else if (r <= 30) stage = 2;
    else if (r <= 60) stage = 1;

    state.warnStage = stage;
    els.dial.classList.toggle("is-warn-1", stage >= 1);
    els.progressPath.classList.toggle("is-warning", stage >= 2);

    if (stage >= 3) {
      const intensity = Math.max(0.15, (11 - r) / 10); // 10→0.1 ... 1→1.0
      els.timeText.style.setProperty("--warn-intensity", intensity.toFixed(2));
      els.timeText.classList.remove("is-beat");
      void els.timeText.offsetWidth; // reflow로 애니메이션 재시작
      els.timeText.classList.add("is-beat");
    } else {
      els.timeText.classList.remove("is-beat");
    }
  }

  function clearWarnStage() {
    state.warnStage = 0;
    els.dial.classList.remove("is-warn-1");
    els.progressPath.classList.remove("is-warning");
    els.timeText.classList.remove("is-beat");
  }

  /* ============================================================
     7) 설정 패널
     ============================================================ */

  function loadSettings() {
    settings = Storage.get("timer", "settings", {
      sound: "bell",
      volume: 0.7,
      tapToStart: false,
    });
    if (settings.volume === undefined) settings.volume = 0.7;
    if (settings.tapToStart === undefined) settings.tapToStart = false;
  }

  function saveSettings() {
    Storage.set("timer", "settings", settings);
  }

  function openSettingsPanel() {
    refreshSettingsUI();
    renderFavManageList();
    els.settingsOverlay.classList.add("is-open");
    els.settingsPanel.classList.add("is-open");
  }

  function closeSettingsPanel() {
    els.settingsOverlay.classList.remove("is-open");
    els.settingsPanel.classList.remove("is-open");
  }

  function buildThemeGrid() {
    const grid = document.getElementById("theme-grid");
    grid.innerHTML = Theme.list()
      .map(
        (t) => `
        <button class="theme-swatch" data-theme-id="${t.id}">
          <span class="theme-swatch__dot" style="background:${t.colors.accent}">${t.emoji}</span>
          <span class="theme-swatch__label">${t.label}</span>
        </button>`
      )
      .join("");
    grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-theme-id]");
      if (!btn) return;
      Theme.apply(btn.dataset.themeId);
      refreshThemeGrid();
    });
    refreshThemeGrid();
  }

  function refreshThemeGrid() {
    const currentId = Theme.currentTheme().id;
    document.querySelectorAll(".theme-swatch").forEach((el) => {
      el.classList.toggle("is-selected", el.dataset.themeId === currentId);
    });
  }

  function buildSoundSelect() {
    const select = document.getElementById("sound-select");
    select.innerHTML = Sounds.list()
      .map((s) => `<option value="${s.id}">${s.label}</option>`)
      .join("");
    select.addEventListener("change", () => {
      settings.sound = select.value;
      saveSettings();
      Sounds.unlock();
      Sounds.play(settings.sound);
    });
  }

  function buildVolumeControl() {
    const range = document.getElementById("volume-range");
    range.addEventListener("input", () => {
      const v = Number(range.value) / 100;
      settings.volume = v;
      Sounds.setVolume(v);
      saveSettings();
    });
  }

  function refreshSettingsUI() {
    document.getElementById("sound-select").value = settings.sound;
    document.getElementById("volume-range").value = Math.round(settings.volume * 100);
    document.getElementById("toggle-tap-to-start").checked = settings.tapToStart;
    refreshThemeGrid();
  }

  return { init };
})();
