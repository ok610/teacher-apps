# Teacher Apps — Version 1.0

초등학교 방과후 강사를 위한 교사용 도구 모음 (PWA)
iPad 최우선 · Apple Human Interface Guidelines 스타일 · 완전 오프라인 지원

---

## 1. 폴더 구조

```
teacher-apps/
├── index.html              # 앱 전체 HTML (App Shell + Home + Timer 화면)
├── manifest.json            # PWA 매니페스트 (홈 화면 추가, 스플래시, 아이콘)
├── sw.js                    # Service Worker (오프라인 캐싱, 버전 관리)
├── README.md                 # 이 문서
│
├── css/
│   ├── variables.css        # 디자인 토큰 (색상·폰트·간격·다크모드) — 가장 먼저 읽어야 할 파일
│   ├── reset.css             # 브라우저 기본 스타일 초기화
│   ├── layout.css            # 앱 셸(헤더/화면전환/버튼/시트) 공통 레이아웃
│   ├── home.css               # Home 화면 카드 그리드
│   ├── timer.css              # Timer 화면 (원형 링, 즐겨찾기 등)
│   └── settings.css           # 설정 시트 전용 스타일
│
├── js/
│   ├── storage.js             # LocalStorage 공용 래퍼 (네임스페이스 관리)
│   ├── icons.js                # 공용 SVG 아이콘 모음
│   ├── sounds.js               # 타이머 종료 사운드 (Web Audio로 합성, 외부 파일 없음)
│   ├── home.js                  # Home 화면 카드 목록 및 렌더링
│   ├── timer.js                  # Timer 기능 전체 로직 (핵심 기능)
│   └── app.js                     # 앱 셸 / 라우터 / Service Worker 등록 (가장 나중에 실행)
│
└── icons/
    ├── icon-192.png             # 홈 화면 아이콘 (192×192)
    ├── icon-512.png              # 스플래시/고해상도 아이콘 (512×512)
    └── icon-maskable-512.png      # Android 적응형 아이콘 (안전 여백 포함)
```

## 2. 각 파일의 역할과 설계 이유

### `index.html`
앱의 뼈대입니다. Home 화면과 Timer 화면이 모두 이 한 파일 안에 `<section class="view" data-view="...">`
형태로 들어있고, `app.js`가 필요한 화면만 보이도록 전환합니다. 페이지 이동(새로고침) 없이
화면이 바뀌기 때문에 타이머가 돌아가는 도중에 다른 화면으로 실수로 넘어가도 타이머 상태가
사라지지 않습니다. 앞으로 Lucky Draw, Team Generator 등을 추가할 때도 이 파일에
`<section class="view" data-view="luckydraw">`를 하나 더 추가하기만 하면 됩니다.

### `manifest.json` / `sw.js`
`manifest.json`은 "홈 화면에 추가"했을 때 아이콘·이름·스플래시 배경색을 iOS/Android에 알려줍니다.
`sw.js`는 최초 접속 시 필요한 모든 파일을 캐시에 저장해두고, 이후에는 네트워크 없이도
캐시에서 즉시 불러옵니다. 파일을 수정해 새 버전을 배포할 때는 `sw.js` 맨 위의
`CACHE_VERSION` 문자열만 올려주면 이전 캐시가 자동으로 삭제되고 최신 파일로 교체됩니다
(요구하신 "업데이트 시 기존 Cache 자동 삭제"가 이 부분입니다).

### `css/variables.css` — 왜 따로 뺐나요?
색상, 폰트 크기, 여백, 다크모드 값이 전부 이 파일 하나에 "변수"로 정의되어 있습니다.
예를 들어 나중에 "포인트 색을 초록색으로 바꾸고 싶다"면 이 파일의 `--color-accent` 값
하나만 고치면 앱 전체 버튼·아이콘 색이 한 번에 바뀝니다. 이런 구조를 **디자인 토큰**이라고
부르며, 프로젝트가 커질수록 유지보수 시간을 크게 줄여줍니다.

### `js/storage.js`
모든 기능의 LocalStorage 값을 `teacherApps.<기능이름>.<key>` 형태로 저장합니다.
예: 타이머 즐겨찾기는 `teacherApps.timer.favorites`. 이렇게 이름공간을 나눠두면
나중에 Lucky Draw가 자기만의 저장값을 가져도 Timer 데이터와 절대 섞이지 않습니다.

### `js/sounds.js`
종료음을 mp3 파일이 아니라 Web Audio API로 실시간 "합성"합니다. 파일이 없으므로
① 오프라인 최초 캐싱 용량이 작고 ② 저작권 걱정이 없고 ③ 다운로드 대기 없이 100%
즉시 재생됩니다. 새 소리를 추가하고 싶으면 `SOUND_LIBRARY` 객체에 항목 하나만
추가하면 설정 화면 목록에 자동으로 나타납니다.

### `js/home.js`
Home 화면 카드 4개(타이머/랜덤 추첨/팀 나누기/OX 퀴즈)는 `FEATURES`라는 배열 하나로
관리됩니다. 실제로 랜덤 추첨 기능을 완성하면 이 배열에서 `ready: true`로 바꾸는 것만으로
카드가 활성화됩니다. 카드 UI 코드를 다시 만질 필요가 없습니다.

### `js/timer.js`
이번 버전에서 가장 큰 파일이며, 5개 영역(카운트다운 엔진 / 원형 링 렌더링 / 즐겨찾기 /
시간 설정 시트 / 설정 시트)으로 나눠 주석을 달아두었습니다. 각 영역은 서로 다른
함수 그룹으로 분리되어 있어, 예를 들어 "즐겨찾기 로직만 수정"하고 싶을 때 다른 부분을
건드릴 위험이 적습니다.

### `js/app.js`
Home ↔ Timer 화면 전환, 상단 헤더의 제목/뒤로가기/설정 버튼 표시, Service Worker 등록을
담당하는 "지휘자" 역할입니다. 새 기능 화면을 추가할 때 이 파일에서 고칠 부분은
`VIEW_TITLES` 객체에 제목 한 줄을 추가하는 것뿐입니다.

---

## 3. GitHub Pages 배포 방법

1. GitHub에 새 저장소를 만듭니다 (예: `teacher-apps`).
2. 이 폴더(`teacher-apps/`) 안의 모든 파일을 저장소 루트에 그대로 업로드합니다.
   (폴더 구조를 그대로 유지해야 합니다 — `css/`, `js/`, `icons/` 그대로)
3. GitHub 저장소의 **Settings → Pages** 로 이동합니다.
4. **Branch**를 `main` (또는 사용 중인 브랜치), 폴더를 `/ (root)`로 선택 후 저장합니다.
5. 몇 분 후 `https://<사용자이름>.github.io/teacher-apps/` 주소로 접속하면 바로 사용할 수 있습니다.
6. iPad의 Safari에서 해당 주소로 접속 → 공유 버튼 → **홈 화면에 추가**를 누르면
   실제 앱처럼 아이콘이 생성됩니다.

> ⚠️ 참고: Service Worker는 `https://` 또는 `localhost` 환경에서만 정상 동작합니다.
> 로컬 컴퓨터에서 미리 확인하고 싶다면 `index.html`을 더블클릭하지 말고,
> 터미널에서 `python3 -m http.server 8000` 실행 후 `http://localhost:8000` 으로 접속하세요.

---

## 4. Version 1.0에서 구현한 것

- ✅ Home 화면 (기능 카드 4개, 미구현 기능은 "준비 중" 배지로 표시)
- ✅ Timer 기능
  - 큰 원형 Progress Ring (Apple Watch Activity Ring 스타일)
  - 시작 / 일시정지 / 리셋 / 시간 설정(1분·5분 단위 스테퍼)
  - 즐겨찾기 시간 추가 · 삭제 (LocalStorage 저장, 초기값 없음)
  - 종료 1분 전 화면 전체가 서서히 깜빡임
  - 종료 시 사운드 재생 (벨 / 학교 종 / 딩동댕 / 전자음 / 무음 중 선택)
  - 설정: 타이머 색상 / 배경색 / 사운드 / 애니메이션 On-Off / 다크 모드
- ✅ PWA (manifest.json, 홈 화면 추가, Splash Screen 배경색)
- ✅ Service Worker (오프라인 지원, 캐시 버전 관리 및 자동 정리)
- ✅ Apple HIG 기반 UI (큰 글씨·큰 버튼, 프로젝터/전자칠판 원거리 시인성 고려)

## 5. 다음 버전 미리 보기 (Home 메뉴에 이미 자리 예약됨)

| Version | 기능 | 상태 |
|---|---|---|
| 1.1 | Lucky Draw (랜덤 추첨) | Home에 "준비 중" 카드로 표시됨 |
| 1.2 | Team Generator (팀 나누기) | Home에 "준비 중" 카드로 표시됨 |
| 1.3 | OX Quiz | Home에 "준비 중" 카드로 표시됨 |
| 이후 | QR, Attendance, VR, Lego 등 | 순차 추가 예정 |

새 기능을 추가할 때마다 아래 3곳만 건드리면 됩니다.
1. `index.html`에 새 `<section class="view" data-view="...">` 추가
2. `js/새기능.js` 작성 후 `index.html`에 `<script>` 한 줄 추가
3. `js/home.js`의 `FEATURES` 배열에서 `ready: true`로 변경
4. `js/app.js`의 `VIEW_TITLES`에 제목 한 줄 추가
5. `sw.js`의 `APP_SHELL_FILES` 목록에 새 파일 경로 추가 + `CACHE_VERSION` 올리기

---

## 6. 왜 이렇게 설계했나요? (초보 개발자를 위한 설명)

**"파일을 왜 이렇게 잘게 나눴나요?"**
하나의 거대한 HTML/CSS/JS 파일로 만들 수도 있었지만, 프로젝트가 몇 년간 계속
커진다고 하셨기 때문에 "기능별로 파일을 나누는 것"이 훨씬 유리합니다. 예를 들어
Lucky Draw 기능에 버그가 생겼을 때, 파일이 나눠져 있으면 `luckydraw.js`만 보면 되지만,
파일이 하나로 합쳐져 있으면 수천 줄 중에서 원인을 찾아야 합니다.

**"왜 하나의 index.html 안에서 화면을 전환하나요? (페이지 이동 대신)"**
`timer.html`, `home.html`처럼 파일을 따로 만들어 페이지 이동하는 방식도 가능하지만,
그렇게 하면 타이머가 돌아가는 도중 다른 화면으로 이동할 때 타이머 상태(JS 변수)가
초기화되어 버립니다. 하나의 페이지 안에서 화면만 바꾸면(SPA 방식) 이런 문제가 없고,
Service Worker 오프라인 캐싱도 더 단순해집니다.

**"CSS 변수를 꼭 써야 하나요?"**
지금 당장은 색상을 하드코딩해도 동작은 똑같습니다. 하지만 Version 1.1, 1.2로 갈수록
"버튼 색을 통일해서 바꿔야 하는" 순간이 반드시 옵니다. 그때 CSS 변수가 없으면 수십 개
파일을 하나하나 찾아 고쳐야 하지만, 변수를 쓰면 `variables.css` 한 줄만 고치면 됩니다.

---

## 7. 향후 제안 사항 (적극 제안)

- **Wake Lock API**: 타이머가 돌아가는 동안 iPad 화면이 자동으로 꺼지지 않도록
  `navigator.wakeLock`을 적용하면 수업 중 화면이 꺼져 당황하는 상황을 막을 수 있습니다.
  (다음 버전에서 추가를 제안드립니다.)
- **여러 개의 타이머 동시 실행**: 모둠 활동처럼 여러 타이머가 동시에 필요할 수 있어
  향후 "멀티 타이머" 모드를 고려해볼 수 있습니다.
- **아이콘 디자인**: 지금 아이콘은 임시로 생성한 심플한 아이콘입니다. 앱이 어느 정도
  자리 잡으면 전문 디자인 아이콘으로 교체하시길 추천드립니다.
