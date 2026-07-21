/* ============================================================
   app.js
   Teacher Apps 앱 셸 (App Shell)
   ------------------------------------------------------------
   역할:
     1) Home <-> 각 기능 화면 전환 라우팅
     2) 상단 헤더(제목/뒤로가기/설정버튼) 상태 관리
     3) Service Worker 등록

   ⚠️ 앱 전체 테마(색상) 적용은 js/theme.js가 <head>에서 이 파일보다
      먼저, 그리고 즉시 실행 방식으로 처리합니다. (첫 페인트 전에
      적용해야 깜빡임이 없기 때문 - theme.js 상단 주석 참고)

   ⭐ 새 기능 화면을 추가하는 방법
     1. index.html 에 <section class="view" data-view="기능id"> 추가
     2. js/기능이름.js 파일 생성 후 index.html에 <script>로 연결
     3. home.js의 FEATURES 배열에서 ready:true, view:"기능id" 설정
     4. 아래 VIEW_TITLES 에 제목 한 줄 추가
     그러면 라우팅/헤더/뒤로가기는 자동으로 동작합니다.
   ============================================================ */

const App = (() => {
  const VIEW_TITLES = {
    home: "Teacher Apps",
    timer: "타이머",
    luckydraw: "랜덤 추첨",
    team: "팀 나누기",
    oxquiz: "OX 퀴즈",
  };

  let currentView = "home";
  let els = {};

  function init() {
    els.header = document.querySelector(".app-header");
    els.title = document.getElementById("header-title");
    els.backBtn = document.getElementById("header-back");
    els.actionSlot = document.getElementById("header-action-slot");
    els.views = document.querySelectorAll(".view");

    els.backBtn.addEventListener("click", () => navigate("home"));

    Home.init({
      container: document.getElementById("home-grid"),
      onSelect: (feature) => {
        if (!feature.ready) return; // 안전장치 (버튼도 disabled 처리되어 있음)
        navigate(feature.view);
      },
    });

    Timer.init(document.getElementById("view-timer"));

    navigate("home");
    registerServiceWorker();
  }

  function navigate(viewId) {
    if (!document.querySelector(`[data-view="${viewId}"]`)) return;

    currentView = viewId;

    els.views.forEach((v) => {
      v.classList.toggle("is-active", v.dataset.view === viewId);
    });

    els.title.textContent = VIEW_TITLES[viewId] || "Teacher Apps";
    els.backBtn.style.visibility = viewId === "home" ? "hidden" : "visible";

    renderHeaderAction(viewId);
  }

  function renderHeaderAction(viewId) {
    els.actionSlot.innerHTML = "";
    if (viewId === "timer") {
      const btn = document.createElement("button");
      btn.className = "app-header__icon-btn";
      btn.dataset.action = "open-timer-settings";
      btn.setAttribute("aria-label", "타이머 설정");
      btn.innerHTML = Icons.gear;
      els.actionSlot.appendChild(btn);
      btn.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("open-timer-settings"));
      });
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .catch((err) => console.warn("[SW] 등록 실패:", err));
    });
  }

  return { init, navigate };
})();

document.addEventListener("DOMContentLoaded", App.init);
