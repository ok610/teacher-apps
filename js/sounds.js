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
  let volume = 0.7; // 0.0 ~ 1.0, 설정 화면의 볼륨 슬라이더와 동기화됨

  function getContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
  }

  function getVolume() {
    return volume;
  }

  // 단일 톤(tone) 재생 헬퍼 - gain 값에 전역 볼륨이 곱해짐
  function tone(context, { freq, start, duration, type = "sine", gain = 0.3 }) {
    const finalGain = gain * volume;
    if (finalGain <= 0) return;

    const osc = context.createOscillator();
    const g = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, context.currentTime + start);

    g.gain.setValueAtTime(0, context.currentTime + start);
    g.gain.linearRampToValueAtTime(finalGain, context.currentTime + start + 0.02);
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
    digitalbeep: {
      label: "디지털 비프",
      play(context) {
        for (let i = 0; i < 3; i++) {
          tone(context, { freq: 1500, start: i * 0.16, duration: 0.1, type: "square", gain: 0.2 });
        }
      },
    },
    chime: {
      label: "부드러운 차임",
      play(context) {
        [523, 659, 784, 1046].forEach((freq, i) => {
          tone(context, { freq, start: i * 0.12, duration: 1.0, type: "sine", gain: 0.16 });
        });
      },
    },
    piano: {
      label: "피아노",
      play(context) {
        tone(context, { freq: 392, start: 0, duration: 0.5, type: "triangle", gain: 0.22 });
        tone(context, { freq: 494, start: 0.18, duration: 0.5, type: "triangle", gain: 0.22 });
        tone(context, { freq: 587, start: 0.36, duration: 0.7, type: "triangle", gain: 0.22 });
      },
    },
    success: {
      label: "성공 효과음",
      play(context) {
        [523, 659, 784, 1046, 1318].forEach((freq, i) => {
          tone(context, { freq, start: i * 0.08, duration: 0.4, type: "sine", gain: 0.2 });
        });
      },
    },
    focus: {
      label: "집중 종료음",
      play(context) {
        tone(context, { freq: 220, start: 0, duration: 1.2, type: "sine", gain: 0.28 });
        tone(context, { freq: 330, start: 0.05, duration: 1.1, type: "sine", gain: 0.14 });
      },
    },
    appleish: {
      label: "Apple 느낌 알림음",
      play(context) {
        tone(context, { freq: 1108, start: 0, duration: 0.16, type: "sine", gain: 0.22 });
        tone(context, { freq: 1478, start: 0.14, duration: 0.28, type: "sine", gain: 0.22 });
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

  return { list, play, unlock, setVolume, getVolume };
})();
