/* ============================================================
   theme.js
   앱 전체 테마(색상 시스템) 관리
   ------------------------------------------------------------
   왜 CSS 클래스가 아니라 JS로 색을 주입하나요?
   - 테마가 7개나 되고 앞으로 계속 늘어날 수 있어서, 테마마다
     CSS 파일/클래스를 새로 만드는 대신 "데이터(THEMES 배열)"만
     추가하면 되도록 설계했습니다.
   - documentElement.style.setProperty로 CSS 변수를 직접 주입하면
     variables.css 및 모든 컴포넌트 CSS가 자동으로 반응합니다.
     (버튼, 카드, 타이머 다이얼, 설정 화면 전부 동시에 바뀌는 이유)

   ⚠️ 이 스크립트는 index.html <head>에서 다른 스크립트보다 먼저,
      그리고 defer 없이 로드됩니다. 그래야 첫 화면이 그려지기 전에
      저장된 테마를 적용해서 "깜빡임(FOUC)"이 없습니다.
      (Storage 모듈이 아직 로드되지 않았을 수 있어 자체 localStorage
      읽기 로직을 따로 갖고 있습니다.)
   ============================================================ */

const Theme = (() => {
  const STORAGE_KEY = "teacherApps.app.theme";
  const DEFAULT_THEME = "forest";

  // ⭐ 새 테마 추가 지점 ⭐
  // id / label / emoji만 있으면 설정 화면에 자동으로 스와치가 추가됩니다.
  const THEMES = [
    {
      id: "forest",
      label: "Forest Green",
      emoji: "🌿",
      colors: {
        accent: "#2FE0B0", accentStrong: "#22B591",
        bgPrimary: "#0B1F1A", bgElevated: "#122C24", bgSecondary: "#1B3F34",
        textPrimary: "#F2FBF8", textSecondary: "#8FBFAE", textTertiary: "#5C8677",
        textOnAccent: "#06231C", separator: "rgba(255,255,255,0.08)",
        timerSurface: "#0F241E", timerTrack: "#163A30", timerTick: "#6FA891",
      },
    },
    {
      id: "ocean",
      label: "Ocean Blue",
      emoji: "🌊",
      colors: {
        accent: "#38BDF8", accentStrong: "#0EA5E9",
        bgPrimary: "#081826", bgElevated: "#0F2438", bgSecondary: "#163449",
        textPrimary: "#EAF6FF", textSecondary: "#86B7D1", textTertiary: "#547C93",
        textOnAccent: "#04202F", separator: "rgba(255,255,255,0.08)",
        timerSurface: "#0B2032", timerTrack: "#123049", timerTick: "#5FA0C4",
      },
    },
    {
      id: "purple",
      label: "Purple",
      emoji: "🟣",
      colors: {
        accent: "#A78BFA", accentStrong: "#8B6EF0",
        bgPrimary: "#170F26", bgElevated: "#241732", bgSecondary: "#32204A",
        textPrimary: "#F5F0FF", textSecondary: "#B8A6DE", textTertiary: "#7D6A9E",
        textOnAccent: "#1D1330", separator: "rgba(255,255,255,0.08)",
        timerSurface: "#1D1330", timerTrack: "#2C1B42", timerTick: "#9782C4",
      },
    },
    {
      id: "orange",
      label: "Orange",
      emoji: "🟠",
      colors: {
        accent: "#FB923C", accentStrong: "#F2751A",
        bgPrimary: "#221207", bgElevated: "#2E1A0C", bgSecondary: "#402710",
        textPrimary: "#FFF3E9", textSecondary: "#D9A97D", textTertiary: "#97724F",
        textOnAccent: "#291708", separator: "rgba(255,255,255,0.08)",
        timerSurface: "#291708", timerTrack: "#3A2110", timerTick: "#C4915E",
      },
    },
    {
      id: "graphite",
      label: "Graphite",
      emoji: "⚫",
      colors: {
        accent: "#C7C7CC", accentStrong: "#AEAEB3",
        bgPrimary: "#141414", bgElevated: "#1E1E1E", bgSecondary: "#2A2A2A",
        textPrimary: "#F5F5F7", textSecondary: "#A0A0A5", textTertiary: "#6E6E73",
        textOnAccent: "#1A1A1A", separator: "rgba(255,255,255,0.08)",
        timerSurface: "#1A1A1A", timerTrack: "#2A2A2A", timerTick: "#8A8A8E",
      },
    },
    {
      id: "light",
      label: "Light",
      emoji: "⚪",
      colors: {
        accent: "#5E5CE6", accentStrong: "#4A48C4",
        bgPrimary: "#F2F2F7", bgElevated: "#FFFFFF", bgSecondary: "#E5E5EA",
        textPrimary: "#1C1C1E", textSecondary: "#6E6E73", textTertiary: "#AEAEB2",
        textOnAccent: "#FFFFFF", separator: "rgba(60,60,67,0.12)",
        timerSurface: "#FFFFFF", timerTrack: "#E5E5EA", timerTick: "#8E8E93",
      },
    },
    {
      id: "dark",
      label: "Dark",
      emoji: "🌙",
      colors: {
        accent: "#5E5CE6", accentStrong: "#7A78EE",
        bgPrimary: "#000000", bgElevated: "#1C1C1E", bgSecondary: "#2C2C2E",
        textPrimary: "#F2F2F7", textSecondary: "#98989D", textTertiary: "#636366",
        textOnAccent: "#FFFFFF", separator: "rgba(84,84,88,0.6)",
        timerSurface: "#17171A", timerTrack: "#232325", timerTick: "#7C7C80",
      },
    },
  ];

  function readSavedId() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_THEME;
    } catch (err) {
      return DEFAULT_THEME;
    }
  }

  function writeSavedId(id) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(id));
    } catch (err) {
      /* 저장 실패 시 조용히 무시 (다음 방문 시 기본 테마로) */
    }
  }

  let currentId = readSavedId();

  function findTheme(id) {
    return THEMES.find((t) => t.id === id) || THEMES[0];
  }

  function apply(id) {
    const theme = findTheme(id);
    currentId = theme.id;
    const c = theme.colors;
    const root = document.documentElement.style;

    root.setProperty("--color-accent", c.accent);
    root.setProperty("--color-accent-strong", c.accentStrong);
    root.setProperty("--color-timer", c.accent);
    root.setProperty("--bg-primary", c.bgPrimary);
    root.setProperty("--bg-elevated", c.bgElevated);
    root.setProperty("--bg-secondary", c.bgSecondary);
    root.setProperty("--text-primary", c.textPrimary);
    root.setProperty("--text-secondary", c.textSecondary);
    root.setProperty("--text-tertiary", c.textTertiary);
    root.setProperty("--text-on-accent", c.textOnAccent);
    root.setProperty("--separator", c.separator);
    root.setProperty("--timer-surface", c.timerSurface);
    root.setProperty("--timer-track", c.timerTrack);
    root.setProperty("--timer-tick", c.timerTick);

    document.documentElement.dataset.theme = theme.id;
    writeSavedId(theme.id);
  }

  function list() {
    return THEMES;
  }

  function currentTheme() {
    return findTheme(currentId);
  }

  // 스크립트가 파싱되는 즉시 실행 -> 첫 페인트 전에 테마 적용 (깜빡임 방지)
  apply(currentId);

  return { apply, list, currentTheme };
})();
