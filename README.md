# Teacher Apps — Version 1.0 (Design System 전면 개편)

초등학교 방과후 강사를 위한 교사용 도구 모음 (PWA)
iPad 최우선 · Apple Human Interface Guidelines 스타일 · 다크모드 중심 · 완전 오프라인 지원

---

## 1. 폴더 구조

```
teacher-apps/
├── index.html              # 앱 전체 HTML (App Shell + Home + Timer + 설정 패널)
├── manifest.json            # PWA 매니페스트
├── sw.js                    # Service Worker (오프라인 캐싱, 버전 관리)
├── README.md
│
├── css/
│   ├── variables.css        # 디자인 토큰 (테마색 기본값 + 여백/폰트/애니메이션 등 구조 토큰)
│   ├── reset.css             # 브라우저 기본 스타일 초기화
│   ├── components.css         # ⭐ 공통 디자인 시스템 (Button/Card/Chip/Toggle/Field/Sheet/SidePanel)
│   ├── layout.css              # 앱 셸 전용 (헤더, 화면 전환)
│   ├── home.css                 # Home 화면 카드 그리드
│   ├── timer.css                 # Timer 화면 (다이얼, 드래그, 세밀조정, 종료연출)
│   └── settings-panel.css         # 설정 패널 내부 콘텐츠 (테마 스와치, 즐겨찾기 관리)
│
├── js/
│   ├── storage.js             # LocalStorage 공용 래퍼
│   ├── theme.js                # ⭐ 앱 테마(색상 시스템) - <head>에서 가장 먼저 실행
│   ├── icons.js                 # 공용 SVG 아이콘
│   ├── sounds.js                 # 종료 사운드 8종 (Web Audio 합성) + 볼륨
│   ├── home.js                    # Home 화면 카드 목록
│   ├── timer.js                    # Timer 기능 전체 로직 (핵심 기능)
│   └── app.js                       # 라우터 / 헤더 관리 / Service Worker 등록
│
└── icons/
    ├── icon-192.png / icon-512.png / icon-maskable-512.png
```

## 2. 이번 개편에서 무엇이 바뀌었나

### 🎨 앱 전체 테마 시스템 (`js/theme.js`)
설정 패널의 "앱 테마" 섹션에서 7가지 테마(🌿 Forest Green(기본) · 🌊 Ocean Blue ·
🟣 Purple · 🟠 Orange · ⚫ Graphite · ⚪ Light · 🌙 Dark) 중 하나를 고르면
**배경 · 카드 · 버튼 · 원형 타이머 · 강조색 · 설정 화면**이 전부 동시에 바뀝니다.
CSS 변수(`--color-accent`, `--bg-primary` 등)를 `js/theme.js`가 런타임에 주입하는
방식이라, 새 테마를 추가할 때 CSS를 건드릴 필요 없이 `THEMES` 배열에 팔레트
하나만 추가하면 됩니다. 선택한 테마는 LocalStorage에 저장되고, 앱이 시작될 때
`<head>`에서 가장 먼저 로드되어 화면이 그려지기 전에 적용되므로 "색이 바뀌는
깜빡임(FOUC)"이 없습니다.

### 🧩 공통 디자인 시스템 (`css/components.css`)
Button, Card, Chip, Toggle Switch, Input/Number Field, Setting Item, Bottom Sheet,
Side Panel을 재사용 가능한 클래스로 만들었습니다. Lucky Draw, Team Generator 등
다음 기능을 만들 때도 이 클래스들(`.btn`, `.card`, `.chip`, `.field`, `.side-panel`
등)을 그대로 쓰면 Timer와 동일한 디자인 언어를 자동으로 갖게 됩니다.
Dialog / Modal / Toast는 아직 어떤 기능도 필요로 하지 않아 지금 만들지 않았습니다.
(안 쓰는 컴포넌트를 미리 만들면 오히려 유지보수 부담이 커진다고 판단했습니다.
Lucky Draw 등에서 실제로 필요해지면 이 파일에 추가하는 것을 권장합니다.)

### ⏱️ Timer 전면 재설계
- **큰 원형 다이얼**: 트랙 위에 5·10·15···60 눈금 숫자가 표시되고, 중앙에
  남은 시간이 아주 크게 표시됩니다. 뒷줄 학생 자리에서도 보이도록 다이얼과
  숫자 크기를 최대화했습니다.
- **드래그로 시간 설정**: 시작 전에는 다이얼을 손가락(또는 마우스)으로 돌려
  시간을 실시간으로 설정할 수 있습니다 (`Pointer Events` 사용, 마우스/터치
  동일 코드로 동작). 15초 단위로 스냅되어 부드럽지만 과도하게 흔들리지 않습니다.
- **세밀 조정 버튼**: −1분 / −10초 / +10초 / +1분 버튼이 드래그와 항상 같은
  값을 공유합니다 (둘 다 `state.totalSeconds` 하나만 갱신).
- **버튼 최소화**: 시작 → 일시정지 ⇄ 재개가 같은 위치에서 토글되는 버튼
  하나 + 리셋 버튼, 이렇게 두 개만 사용합니다.
- **즐겨찾기(이름+시간)**: 자동 "최근 사용" 없이, 사용자가 설정 패널에서
  이름과 분/초를 입력해 직접 추가합니다. 타이머 화면 하단에는 Apple 스타일의
  둥근 Chip으로 표시되고, 누르면 즉시 해당 시간으로 설정됩니다. 설정에서
  "즐겨찾기 터치 시 바로 시작" 옵션을 켜면 누르자마자 카운트다운이 시작됩니다.
  설정 패널에서 손잡이(⠿)를 눌러 위아래로 끌면 순서도 바꿀 수 있습니다.
- **종료 임박 3단계 연출**: 1분 전에는 다이얼 전체가 은은하게 깜빡이고,
  30초 전에는 진행 arc가 경고색으로 바뀌며, 10초 전부터는 매 초 중앙 숫자가
  남은 시간이 적을수록 더 강하게 "박동"합니다. 종료되면 중앙 텍스트가
  "시간이 종료되었습니다"로 바뀌고 선택한 효과음이 재생되며, 다이얼을
  터치하거나 확인 버튼을 누르면 초기 화면으로 돌아갑니다.
- **효과음 8종**: 학교 종 / 디지털 비프 / 부드러운 차임 / 피아노 / 성공 효과음 /
  벨 / 집중 종료음 / Apple 느낌 알림음 (+ 무음). 전부 Web Audio API로 실시간
  합성해 오프라인에서도 100% 동작하고 외부 파일이 없어 저작권 걱정도 없습니다.
  설정에서 미리듣기와 볼륨 조절이 가능합니다.

## 3. GitHub Pages 배포 방법

1. GitHub에 새 저장소를 만듭니다 (예: `teacher-apps`).
2. 이 폴더 안의 모든 파일을 저장소 루트에 폴더 구조 그대로 업로드합니다.
3. **Settings → Pages** → Branch `main`, 폴더 `/ (root)` 선택 후 저장.
4. `https://<사용자이름>.github.io/teacher-apps/` 로 접속하면 바로 사용할 수 있습니다.
5. iPad Safari에서 접속 → 공유 버튼 → **홈 화면에 추가**.

> ⚠️ Service Worker는 `https://` 또는 `localhost` 환경에서만 동작합니다.
> 로컬 확인 시 `python3 -m http.server 8000` 실행 후 `http://localhost:8000` 으로 접속하세요.
> 파일을 수정해 새 버전을 배포할 때는 `sw.js`의 `CACHE_VERSION`을 반드시 올려주세요.

## 4. 알아두면 좋은 설계상의 선택 (의도적인 단순화)

- **다이얼 최대값 60분**: 다이얼이 "60분 = 한 바퀴"인 시계 문장(clock face)이므로,
  드래그·세밀조정·즐겨찾기 모두 0~60분 범위로 통일했습니다. 더 긴 시간이
  자주 필요하시면 다이얼을 여러 바퀴 도는 방식으로 확장할 수 있습니다 (다음
  버전 후보로 남겨두었습니다).
- **즐겨찾기 순서 변경은 Pointer Events 기반 커스텀 드래그**: iPad Safari에서
  네이티브 HTML5 Drag & Drop이 터치 환경에서 잘 동작하지 않는 경우가 많아,
  손잡이(⠿)를 누르고 위아래로 끄는 방식을 직접 구현했습니다. 마우스/터치
  모두 동일하게 동작합니다.
- **Dialog/Modal/Toast 컴포넌트는 아직 없음**: 현재 어떤 화면도 필요로 하지
  않아 만들지 않았습니다. `components.css`의 다른 컴포넌트와 같은 패턴으로
  나중에 추가하면 됩니다.

## 5. 다음 버전 미리 보기

| Version | 기능 | 상태 |
|---|---|---|
| 1.1 | Lucky Draw (랜덤 추첨) | Home에 "준비 중" 카드로 표시됨 |
| 1.2 | Team Generator (팀 나누기) | Home에 "준비 중" 카드로 표시됨 |
| 1.3 | OX Quiz | Home에 "준비 중" 카드로 표시됨 |
| 이후 | QR, Attendance, VR, Lego 등 | 순차 추가 예정 |

새 기능을 추가할 때마다 아래만 건드리면 됩니다.
1. `index.html`에 새 `<section class="view" data-view="...">` 추가
2. `js/새기능.js` 작성 후 `index.html`에 `<script>` 한 줄 추가 (`css/components.css`의
   클래스를 그대로 재사용)
3. `js/home.js`의 `FEATURES` 배열에서 `ready: true`로 변경
4. `js/app.js`의 `VIEW_TITLES`에 제목 한 줄 추가
5. `sw.js`의 `APP_SHELL_FILES`에 새 파일 경로 추가 + `CACHE_VERSION` 올리기

## 6. 스스로 점검한 품질 체크리스트

- [x] 다이얼 테두리가 화면 밖으로 잘리지 않는지 (viewBox 여유 공간 확보)
- [x] 드래그와 세밀조정 버튼이 정확히 같은 상태(state.totalSeconds)를 공유하는지
- [x] 진행 중에는 드래그/세밀조정이 비활성화되는지 (즐겨찾기로 실수로 덮어쓰지 않는지)
- [x] 테마를 바꾸면 Home 카드, 버튼, 타이머 다이얼, 설정 패널이 모두 함께 바뀌는지
- [x] 오프라인(비행기 모드)에서도 사운드가 재생되는지 (Web Audio 합성이므로 파일 다운로드 불필요)
- [x] 종료 화면에서 다이얼 탭 또는 확인 버튼 둘 다로 초기화면으로 돌아가는지
- [x] 즐겨찾기 이름 없이 추가해도(시간만) 정상적으로 Chip에 표시되는지
- [x] 모든 JS 파일 문법 검증 통과 (`node --check`), 모든 HTML id 참조 교차 검증 통과
