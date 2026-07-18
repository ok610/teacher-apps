/* ============================================================
   sounds.js
   타이머 종료 사운드 관리
   ------------------------------------------------------------
   왜 오디오 파일 대신 Web Audio API로 소리를 "합성"하나요?
   - 외부 mp3/wav 파일이 없으므로 Service Worker 캐시 대상이
     줄어들고, GitHub Pages 업로드 용량도 작아집니다.
   - 최초 접속 후 오프라인 상태에서도 100% 즉시 재생됩니다.
   - 저작권 걱정 없이 자유롭게 배포/수정 가능합니다.

   새 사운드를 추가하려면?
   -> 아래 SOUND_LIBRARY 객체에 항목 하나만 추가하면 됩니다.
      (재생 함수는 AudioContext만 인자로 받는 순수 함수)
   ============================================================ */

const Sounds = (() => {
  let ctx = null;

  function getContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // 단일 톤(tone) 재생 헬퍼
  function tone(context, { freq, start, duration, type = "sine", gain = 0.3 }) {
    const osc = context.createOscillator();
    const g = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, context.currentTime + start);

    g.gain.setValueAtTime(0, context.currentTime + start);
    g.gain.linearRampToValueAtTime(gain, context.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);

    osc.connect(g).connect(context.destination);
    osc.start(context.currentTime + start);
    osc.stop(context.currentTime + start + duration + 0.05);
  }

  // ---------- 사운드 라이브러리 (여기에 계속 추가 가능) ----------
  const SOUND_LIBRARY = {
    bell: {
      label: "벨",
      play(context) {
        tone(context, { freq: 1046, start: 0, duration: 0.9, type: "triangle", gain: 0.25 });
        tone(context, { freq: 1568, start: 0, duration: 0.9, type: "sine", gain: 0.12 });
      },
    },
    schoolbell: {
      label: "학교 종",
      play(context) {
        [0, 0.32, 0.64, 1.1].forEach((t, i) => {
          tone(context, {
            freq: i % 2 === 0 ? 880 : 659,
            start: t,
            duration: 0.35,
            type: "square",
            gain: 0.18,
          });
        });
      },
    },
    dingdong: {
      label: "딩동댕",
      play(context) {
        tone(context, { freq: 784, start: 0, duration: 0.6, type: "sine", gain: 0.28 });
        tone(context, { freq: 659, start: 0.45, duration: 0.6, type: "sine", gain: 0.28 });
        tone(context, { freq: 523, start: 0.9, duration: 0.8, type: "sine", gain: 0.28 });
      },
    },
    electronic: {
      label: "전자음",
      play(context) {
        for (let i = 0; i < 3; i++) {
          tone(context, {
            freq: 1200,
            start: i * 0.18,
            duration: 0.12,
            type: "square",
            gain: 0.2,
          });
        }
      },
    },
    silent: {
      label: "무음",
      play() {
        /* 아무 소리도 재생하지 않음 */
      },
    },
  };

  function list() {
    return Object.entries(SOUND_LIBRARY).map(([id, s]) => ({ id, label: s.label }));
  }

  function play(id) {
    const sound = SOUND_LIBRARY[id] || SOUND_LIBRARY.bell;
    if (id === "silent") return;
    try {
      sound.play(getContext());
    } catch (err) {
      console.warn("[Sounds] 재생 실패:", err);
    }
  }

  // iOS Safari는 사용자 제스처 이후에만 AudioContext를 활성화하므로
  // 앱 최초 터치 시 미리 unlock 해둔다.
  function unlock() {
    try {
      getContext();
    } catch (err) {
      /* 무시 */
    }
  }

  return { list, play, unlock };
})();
