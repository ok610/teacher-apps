/* ============================================================
   sw.js
   Service Worker - 오프라인 지원 & 캐시 버전 관리
   ------------------------------------------------------------
   ⭐ 새 버전을 배포할 때 (파일을 추가/수정했을 때) 반드시
      아래 CACHE_VERSION 값을 올려주세요.
      예: "teacher-apps-v1.1" -> "teacher-apps-v1.2"

      버전이 바뀌면:
        1. 새 캐시를 만들고 최신 파일을 저장
        2. activate 단계에서 이전 버전 캐시를 자동으로 모두 삭제
      이 과정을 통해 사용자가 접속할 때마다 최신 버전을 받습니다.
   ============================================================ */

const CACHE_VERSION = "teacher-apps-v1.3";

// 앱 셸(App Shell) - 최초 접속 시 미리 캐싱해서 오프라인에서도 실행되게 함
const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./notion-calendar-test.html",
  "./manifest.json",

  "./css/variables.css",
  "./css/reset.css",
  "./css/components.css",
  "./css/layout.css",
  "./css/home.css",
  "./css/timer.css",
  "./css/settings-panel.css",

  "./js/storage.js",
  "./js/theme.js",
  "./js/icons.js",
  "./js/sounds.js",
  "./js/home.js",
  "./js/timer.js",
  "./js/app.js",

  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

// ---------- 설치: 앱 셸 캐싱 ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// ---------- 활성화: 이전 버전 캐시 자동 삭제 ----------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------- 요청 처리: Cache First, 실패 시 네트워크 ----------
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
