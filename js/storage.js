/* ============================================================
   storage.js
   LocalStorage 공용 래퍼
   ------------------------------------------------------------
   모든 기능(Timer, 향후 Lucky Draw, Team Generator...)이
   "teacherApps.<기능명>.<key>" 형태의 네임스페이스로 저장하여
   기능이 늘어나도 값이 서로 충돌하지 않도록 합니다.

   사용 예)
     Storage.get('timer', 'favorites', [])
     Storage.set('timer', 'favorites', [600, 300])
   ============================================================ */

const Storage = (() => {
  const NAMESPACE = "teacherApps";

  function buildKey(feature, key) {
    return `${NAMESPACE}.${feature}.${key}`;
  }

  function get(feature, key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(buildKey(feature, key));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn("[Storage] get 실패:", feature, key, err);
      return fallback;
    }
  }

  function set(feature, key, value) {
    try {
      window.localStorage.setItem(buildKey(feature, key), JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn("[Storage] set 실패:", feature, key, err);
      return false;
    }
  }

  function remove(feature, key) {
    window.localStorage.removeItem(buildKey(feature, key));
  }

  return { get, set, remove };
})();
