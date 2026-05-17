# 네이버 블로그 자동화 가이드 (v2 - 로컬 러너 기반)

## 1. 왜 새 설계가 필요했나

기존 GitHub Actions 기반 자동화는 **구조적으로 실패**합니다:

| 문제 | 원인 |
|---|---|
| 봇 탐지 즉시 차단 | GitHub Actions IP는 데이터센터 대역 — 네이버 1순위 차단 대상 |
| 쿠키 만료 | `NID_AUT/NID_SES`는 며칠 단위로 만료 → Secrets 수동 갱신 지옥 |
| 셀렉터 깨짐 | SmartEditor One DOM이 자주 변경 + iframe 중첩 구조 |
| 2FA/기기 확인 | 새 IP에서 접속 시 SMS/앱 확인 요구 → 자동화 불가 |
| 공식 API 부재 | 네이버 블로그 글 작성 API는 **공식 지원하지 않음** (검색 API만 존재) |

→ 클라우드 러너로는 어떤 우회 기법을 써도 안정 운영 불가.

---

## 2. 새 아키텍처

```
[ Git Push to main ]
        ↓
[ GitHub Actions ]
  - Quartz 빌드
  - 네이버용 HTML 변환 (convert-quartz.mjs)
  - artifact 업로드 (제목 + HTML)
  - 로컬 OpenClaw에 Telegram 알림
        ↓
[ Mac (사용자 환경) ]
  - OpenClaw가 Telegram 알림 수신
  - GitHub artifact 다운로드 (gh CLI)
  - naver-post-local.mjs 실행
        ↓
[ Playwright + Persistent Context ]
  - ~/.openclaw/playwright/naver-profile 재사용
  - 최초 1회 수동 로그인 → 이후 영구 세션
  - 실제 사용자 IP, 실제 쿠키 → 봇 탐지 회피
        ↓
[ 네이버 블로그 게시 ]
        ↓
[ Telegram 결과 보고 ]
  - 성공: URL 전송
  - 실패: 스크린샷 + 오류 로그 전송 → 수동 처리
```

### 핵심 원리

1. **클라우드는 준비만, 게시는 로컬에서** — IP·쿠키 문제 원천 차단
2. **Persistent Context** — Playwright의 `launchPersistentContext`로 실제 Chrome 프로필 재사용. 최초 1회만 수동 로그인하면 이후 세션·쿠키·기기 신뢰가 유지됨
3. **휴먼-인-더-루프** — 실패 시 즉시 Telegram으로 알려서 수동 대응. 무리한 자동 재시도로 계정 정지 위험 회피

---

## 3. 파일 구성

```
bluebrosna.github.io/
├── .github/workflows/
│   └── naver-prepare.yml          # GitHub Actions (준비 + 알림만)
├── convert-quartz.mjs              # Markdown → 네이버 HTML 변환 (기존)
├── naver-post-local.mjs            # 로컬 Playwright 게시 (신규)
├── naver-notify.mjs                # Telegram 알림 전송 (신규)
└── scripts/
    └── setup-naver-profile.mjs    # 최초 1회 로그인 도우미 (신규)
```

---

## 4. 운영 절차

### 최초 1회 설정

```bash
# 1. Playwright 설치
cd ~/bluebrosna.github.io
npm install playwright
npx playwright install chromium

# 2. 영구 프로필 디렉터리에 수동 로그인 (창이 떠서 본인 직접 로그인)
node scripts/setup-naver-profile.mjs

# 3. GitHub Secrets 등록
#    TELEGRAM_BOT_TOKEN    : Telegram 알림 봇 토큰
#    TELEGRAM_CHAT_ID      : 알림 받을 채팅 ID
#    (네이버 ID/PW/쿠키는 더 이상 필요 없음 ✅)

# 4. GitHub Actions 권한
#    Settings → Actions → Workflow permissions → Read and write
```

### 평상시 운영

1. `content/` 에 새 글 푸시
2. GitHub Actions가 자동으로 빌드 + Telegram 알림 전송
3. Mac이 켜져 있고 OpenClaw가 실행 중이면 자동 처리
4. 결과는 Telegram으로 보고

### Mac이 꺼져 있을 때

알림은 Telegram에 쌓여 있음. Mac을 켜고 수동으로 실행:
```bash
gh run download <run-id> -n naver-blog-payload
node naver-post-local.mjs
```

---

## 5. 위험 관리

| 항목 | 대응 |
|---|---|
| 계정 정지 위험 | 1일 게시 횟수 제한 (스크립트 내 `MAX_POSTS_PER_DAY=3`) |
| 셀렉터 변경 | 실패 시 스크린샷·DOM 덤프를 Telegram으로 즉시 전송 → 사용자가 보고 빠르게 셀렉터 패치 |
| 세션 만료 | Persistent Context도 한 달 이상 안 쓰면 만료 → 다시 `setup-naver-profile.mjs` 실행 |
| 동시 실행 | lockfile (`/tmp/naver-post.lock`)로 중복 실행 방지 |

---

## 6. 코드 위치

- 게시 스크립트: [naver-post-local.mjs](./naver-post-local.mjs)
- 알림 스크립트: [naver-notify.mjs](./naver-notify.mjs)
- 프로필 셋업: [scripts/setup-naver-profile.mjs](./scripts/setup-naver-profile.mjs)
- 워크플로: [.github/workflows/naver-prepare.yml](./.github/workflows/naver-prepare.yml)

---

## 7. 폐기된 접근

이전 `naver-auto-post.mjs` + `naver-auto-post.yml`은 위 이유로 **사용 중단**.
참고용으로 `.disabled` 확장자로만 유지.
