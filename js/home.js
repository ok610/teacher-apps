/* ============================================================
   home.js
   Home 화면: 기능 카드 목록 정의 및 렌더링
   ------------------------------------------------------------
   ⭐ 새 기능(예: Lucky Draw)을 실제로 구현하고 나면
      아래 FEATURES 배열에서 해당 항목의
      `ready: true` 로 바꾸고 `view: "luckydraw"` 를 지정하면
      Home 카드가 자동으로 활성화됩니다.
      (아직 카드 UI를 직접 수정할 필요 없음)
   ============================================================ */

const Home = (() => {
  const FEATURES = [
    {
      id: "timer",
      icon: "🕒",
      label: "수업 Timer",
      sub: "수업/활동 시간 관리",
      color: "var(--color-accent)",
      view: "timer",
      ready: true,
    },
    {
      id: "luckydraw",
      icon: "🎲",
      label: "랜덤 추첨",
      sub: "Version 1.1 예정",
      color: "#FF9F43",
      view: "luckydraw",
      ready: false,
    },
    {
      id: "team",
      icon: "👥",
      label: "팀 나누기",
      sub: "Version 1.2 예정",
      color: "#34C759",
      view: "team",
      ready: false,
    },
    {
      id: "oxquiz",
      icon: "⭕❌",
      label: "OX 퀴즈",
      sub: "Version 1.3 예정",
      color: "#FF453A",
      view: "oxquiz",
      ready: false,
    },
    {
      id: "notiontest",
      icon: "🗓️",
      label: "Notion Calendar Web Test",
      sub: "웹으로 열기 테스트",
      color: "#0A84FF",
      href: "./notion-calendar-test.html", // SPA 뷰가 아니라 별도의 정적 페이지로 이동
      ready: true,
    },
  ];

  let containerEl = null;
  let onSelectFeature = null;

  function render() {
    containerEl.innerHTML = FEATURES.map(cardHtml).join("");
  }

  function cardHtml(feature) {
    const disabledClass = feature.ready ? "" : "is-disabled";
    const badge = feature.ready
      ? ""
      : `<span class="feature-card__badge">준비 중</span>`;

    return `
      <button
        class="feature-card ${disabledClass}"
        style="--feature-color:${feature.color}"
        data-feature-id="${feature.id}"
        ${feature.ready ? "" : "disabled aria-disabled=\"true\""}
      >
        ${badge}
        <span class="feature-card__icon">${feature.icon}</span>
        <span>
          <span class="feature-card__label">${feature.label}</span>
          <div class="feature-card__sub">${feature.sub}</div>
        </span>
      </button>
    `;
  }

  function handleClick(event) {
    const card = event.target.closest(".feature-card");
    if (!card || card.disabled) return;
    const feature = FEATURES.find((f) => f.id === card.dataset.featureId);
    if (!feature) return;

    // href가 있는 카드(예: 별도 정적 테스트 페이지)는 SPA 전환 대신 실제 이동
    if (feature.href) {
      window.location.href = feature.href;
      return;
    }

    if (onSelectFeature) onSelectFeature(feature);
  }

  function init({ container, onSelect }) {
    containerEl = container;
    onSelectFeature = onSelect;
    containerEl.addEventListener("click", handleClick);
    render();
  }

  return { init, FEATURES };
})();
