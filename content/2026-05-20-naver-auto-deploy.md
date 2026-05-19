---
title: "GitHub Pages에 글 올리면 자동으로 네이버에도 올라올 줄 알았는데... 안 되더라구요"
date: 2026-05-20
tags:
  - 네이버블로그
  - GitHubActions
  - 자동발행
  - Playwright
  - 데이터센터IP
  - 파이프라인
  - 브라우저자동화
  - 블로그
  - 개발자동화
  - 팁
description: "GitHub Pages로 네이버 블로그 자동 발행을 시도했다가 데이터센터 IP 차단을 겪었습니다. 3시간 헤맸던 경험과 실제 작동하는 2단계 파이프라인을 공유합니다."
---

![GitHub Actions 로고와 네이버 블로그가 연결된 이미지](/static/grok-images/post-01-image-1.png)

## 도입부 — 실제로 실패했던 이야기

GitHub Pages에 글 올리면 자동으로 네이버 블로그에도 올라올 줄 알았는데... 안 되더라구요.

정확히 말하면 "발행 준비 완료" 알림은 텔레그램으로 바로 오는데, 실제 블로그엔 한 번도 안 올라갔어요. 처음엔 workflow가 잘못된 줄 알았어요. 설정이 복잡해서 그런가 싶어서 이것저것 바꿔보고... 그런데 원인은 다른 데 있었죠.

**데이터센터 IP.**

이거 몰라서 3시간은 헤맨 것 같아요. 정확히 말하면 workflow 자체는 멀쩡한데, GitHub Actions가 사용하는 IP가 데이터센터 주소라서 네이버 봇 탐지에 바로 걸리는 거였어요.

이 글에서 그 이유부터 풀어드릴게요. 그리고 실제로 작동하는 2단계 파이프라인, 그러니까 클라우드는 변환만 하고 실제 발행은 내 Mac에서 Chrome으로 하는 방식, 이거 만들어서 지금은 매일 자동으로 블로그에 글이 올라가고 있어요.

솔직히 처음엔 여러 방법으로 시도했어요... 진짜 다양하게요. workflow를 이것저것 바꿔보고, 다양한 서비스로 해보고... 그런데 다 데이터센터 IP 문제였어요. 이걸 알아가는 과정이 좀 길었어요. 그래서 이 글을 쓰게 됐어요.

여기서 다룰 내용은 이 세 가지예요:

- 왜 GitHub Actions로는 절대 안 되는지 (그리고 Vercel, Netlify도 마찬가지)
- 2단계 파이프라인이 왜 필요한지
- 내 Mac에서 Chrome 프로필 만드는 방법 (처음 한 번만 하면 됩니다)

---

## H2 #1 — 데이터센터 IP라는 함정

### 클라우드 서비스는 왜 안 되는가

GitHub Pages에 글 올리면 자동으로 네이버 블로그에도 올라올 줄 알았죠. 저도 그랬고요.

그런데 안 됩니다. 그리고 이건 설정 문제가 아니에요. 좀 더 근본적인 문제가 있거든요.

GitHub Actions, Vercel, Netlify, Cloudflare Pages... 전부 데이터센터 IP를 사용합니다. 내 Mac이 아니라 클라우드 서버에서 실행되거든요. 서버의 IP 주소를 보면 알 수 있어요.

```bash
# 내 IP가 데이터센터인지 확인하는 방법
curl -s https://ipinfo.io/json | jq '{ip, org, city, country}'
```

이 명령어를 내 Mac에서 실행하면 아마 통신사 이름이 나올 거예요. KT, SKT, LGT 같은 거요. 그런데 이걸 GitHub Actions에서 실행하면 어떻게 나올까요?

```json
{
  "ip": "140.82.112.4",
  "org": "AS36459 GitHub, Inc.",
  "city": "San Francisco",
  "country": "US"
}
```

"GitHub, Inc."라고 나오죠. 데이터센터 주소예요.

### 네이버 봇 탐지는 어떻게 작동하는가

네이버 블로그에 사람이 직접 접속하면 아무 문제 없어요. 그런데 GitHub Actions에서 blog.naver.com에 요청을 보내면...

```
HTTP/2 403
cf-ray: Something-something-SIN
{"error":"Access Denied"}
```

Cloudflare가 "이 요청 데이터센터에서 온 거잖아? 봇 아냐?" 하고 차단하는 거예요. 정확히 말하면 Cloudflare Bot Management가 작동하는 건데, 우리가 할 수 있는 건 없어요.

그냥 이건 설정으로 우회할 수 있는 문제가 아니니까요. IP 자체가 데이터센터라는 사실은 못 바꾸거든요.

### 근데 사실

Vercel도 안 됩니다. Netlify도 안 됩니다. Cloudflare Pages도 안 돼요. AWS EC2도 안 됩니다. 전부 데이터센터 IP를 사용하기 때문이에요.

 единственное 차이점은... AWS EC2는 한 번쯤 성공할 수 있어요. 근데 금방 차단당해요. 데이터센터 IP라는 게 시간이 지나면Known bot IP 데이터베이스에 등록되거든요.

> 💡 여기서 핵심: 데이터센터 IP는 설정으로 우회 불가능. 실제 사용자 IP가 필요해요. 즉, 내 Mac에서Chrome을 실행해야 해요.

### 클라우드 서비스별 네이버 탐지 여부

| 서비스 | IP 유형 | 자동화 범위 | 결과 |
|---|---|---|---|
| GitHub Actions | 데이터센터 | 변환까지만 | ❌ 게시 즉시 차단 |
| Vercel | 데이터센터 | 변환까지만 | ❌ 게시 즉시 차단 |
| Netlify | 데이터센터 | 변환까지만 | ❌ 게시 즉시 차단 |
| Cloudflare Pages | 데이터센터 | 변환까지만 | ❌ 게시 즉시 차단 |
| AWS EC2 | 데이터센터 | 변환+게시 가능 | ⚠️ 단기 성공 후 차단 |
| **내 Mac (Playwright)** | **통신사/가정** | **전체 자동** | **✅ 작동** |
| 모바일 핫스팟 | 모바일 | 전체 자동 | ⚠️ 번거로움 |

결국 유일한 정답은 내 Mac에서Chrome으로 실행하는 거예요.

---

## H2 #2 — 2단계 파이프라인 아키텍처

### 해결 방법은 의외로 단순합니다

문제를 알았으니 해결책은 간단해요.

클라우드에서 모든 걸 하려고 하지 말고, **변환은 클라우드에서, 실제 게시은 내 Mac에서** 하면 돼요.

이렇게요:

```
1단계 (GitHub Actions)
content/에 마크다운 저장
    ↓
convert-quartz.mjs 실행
    ↓
naver_blog_title.txt + naver_blog_content.html 생성
    ↓
actions/upload-artifact로 결과물 업로드
    ↓
텔레그램으로 "발행 준비 완료" 알림

2단계 (내 Mac)
artifact 다운로드
    ↓
Playwright가 Chrome 열어서 blog.naver.com 접속
    ↓
로그인 (쿠키 있으면 생략)
    ↓
제목+본문 입력 → 발행 버튼 클릭
    ↓
성공/실패 텔레그램으로 보고
```

### 왜 분리해야 하는가

이해가 안 될 수 있어요. 그냥 내 Mac에서 전부 하면 되지 않아? 라고 물어보신다면... 그럼 매일 내 Mac을 켜놔야 해요. 그리고 블로그에 올릴 파일을 내 Mac에 복사해서 놓고 실행해야 하고요.

사실 처음엔 저도 Mac에서전부 했어요. 그런데 이러면 매일 아침에 Mac 켜고, 파일 동기화하고, 스크립트 실행하고... 이 과정 자체가 번거로워서 자동화의 의미가 없었어요.

그래서 쓴 게 2단계예요. GitHub에 푸시하면 자동으로 변환까지 해주고, 내 Mac은 그 결과물로 게시만 해주면 되니까 훨씬 편해요.

그래서 쓰는 게 2단계예요.

1단계는 GitHub Actions가 해줘요. 내가 마크다운 파일을 GitHub에 푸시하면, GitHub Actions가 알아서 MD를 HTML로 변환하고 artifact로 묶어줘요. 이건 데이터센터 IP에서 실행돼도 괜찮아요. 변환만 할 뿐이니까요.

2단계는 내 Mac이 해줘요. artifact를 다운로드받은 다음, 실제 Chrome을 열어서 블로그에 게시하는 거예요. 이때 IP는 내 Mac의 통신사 IP니까 네이버 봇 탐지에 안 걸려요.

### GitHub Actions workflow 핵심 부분

```yaml
# .github/workflows/naver-prepare.yml
name: Prepare Naver Blog Post
on:
  push:
    branches: [main]
    paths: ['content/**']
  workflow_dispatch:
    inputs:
      post_file: { required: true, type: string }
      post_title: { required: false, type: string }

jobs:
  prepare:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm install
      - run: node convert-quartz.mjs "${{ inputs.post_file }}"
      - uses: actions/upload-artifact@v4
        with:
          name: naver-blog-payload
          path: |
            naver_blog_title.txt
            naver_blog_content.html
      - name: Notify Telegram
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: node naver-notify.mjs
```

이 workflow가 하는 일은 간단해요. 마크다운 파일을 HTML로 변환하고, 결과를 artifact에 올리는 거예요. 그리고 텔레그램으로 알려주구요.

실제 브라우저 조작은 1단계에서 하고, 2단계는 내 Mac에서 해요.

---

## H2 #3 — 내 Mac에서 Chrome 영구 프로필 만들기

### 처음 한 번만 해두면 그다음엔 놀아요

자, 이제 2단계를 내 Mac에서 실행해야 하는데요.

매번 Chrome 열고 로그인하고 브라우저 조작하는 걸 자동화해야 하니까, Chrome 프로필을 만들어야 해요. 정확히 말하면 Playwright가 사용할Chrome 프로필을 만드는 거예요.

Playwright는 내 Mac에 설치된 Chrome을 그냥 쓰는 게 아니라, 별도의 프로필 디렉토리를 지정해서 그 안에 로그인 정보를 저장해요. 이러면 쿠키가 그대로 유지되거든요.

, 주민등록증을 한 번 발급하면 영원히 같다.

### "이 기기를 신뢰" 옵션

여기서 중요한 게 있어요.Chrome 프로필을 만들고 나면, 처음 한 번은수동으로 로그인해야 해요. 그런데 이때 **"이 기기를 신뢰" 옵션을 꼭 체크**해야 해요.

그냥 이걸 체크해야 네이버가 내 Mac을 "신뢰할 수 있는 기기"로 인식해서, 쿠키(NID_AUT, NID_SES)가 수개월 동안 유지되기 때문이에요. 이거 안 하면 2~3주마다 다시 로그인해야 해요.

### 실제로 해보면어떤지

```bash
# 1) 스크립트 실행
node scripts/setup-naver-profile.mjs
```

이 명령어를 터미널에서 실행하면 Chrome 창이 열려요. 그러면 보통처럼 네이버에 로그인하면 돼요. ID/PW 입력하고, 2FA 있으면 그것도 통과하고요.

그리고 중요한 부분이에요. **"이 기기를 신뢰" 옵션을 꼭 체크**하세요. 이거 안 하면 며칠 후 다시 로그인하라고 해요. 그러면 자동화가 끊어져요.

로그인이 끝나면 blog.naver.com/{내블로그ID}/postwrite에 제대로 접속되는지 확인하세요. 확인했으면 터미널로 돌아가서 Enter를 누르세요.

```bash
# 3) 프로필 생성 확인
ls -la ~/.openclaw/playwright/naver-profile/Default/Cookies
# 파일 크기가 20KB 이상이면 정상
```

### 경험담 — 솔직히 이거 모르고 2주마다 다시 로그인해야 했어요

 솔직히 말하면... 솔직히 저도 처음엔 "이 기기를 신뢰" 옵션을 안 체크했어요.

뭐가 문제인지 모르고 그냥 프로필 만들고 실행했거든요. 그러니까 2주쯤 지나니까 다시 로그인하라고 해요. 그때 가서야 알게 됐어요. "아, 이 옵션이 있구나" 하고 다시 해봤는데... 그 뒤로는 진짜로 2~3개월은 편하게 썼어요.

자동화 만들고 처음엔 잘 몰랐는데... 한 번 헤어나오니까 그 다음부턴 진짜 편해요.

---

## H2 #4 — 텔레그램으로 자동 알림까지

### 발행 준비가 되면 텔레그램으로 알려드려요

2단계 파이프라인의 좋은 점은, 각 단계마다 텔레그램으로 알림이 온다는 거예요.

1단계가 끝나면 "발행 준비 완료" 알림이 와요. artifact에 제목과 본문이묶어됐다는 의미예요.

2단계(내 Mac)가 실행되면, 그 결과를 또 알려줘요. 성공하면 "게시 완료"이고, 실패하면 스크린샷과 함께 어디서 막혔는지 알려줘요.

이러면 내가 직접 채팅방에 앉아서 안 해도 돼요. 알림오면 확인하면 되거든요.

### 로컬에서 게시 실행하는 방법

artifact가 업로드되면, 내 Mac에서 이 명령어를 실행해요.

```bash
# 최신 워크플로 artifact 다운로드 후 게시
bash ~/.openclaw/skills/naver-deploy/scripts/run.sh {run-id}
```

여기서 {run-id}는 GitHub Actions 실행 ID예요. 텔레그램으로 온 알림에 같이 오는번호를 쓰면 돼요.

```bash
# DRY_RUN (임시저장만, 실제 게시 안 함)
bash ~/.openclaw/skills/naver-deploy/scripts/run.sh {run-id} dry
```

dry를 붙이면 임시저장까지만 해요. 실제로 블로그에 올라가지 않거든요. 미리보기로 쓸 수 있어요.

### 일일 3편 한도, 어떻게 관리하는가

솔직히 말하면... 이 부분에서 한 번 헤맨 적 있어요.

네이버 블로그는 하루에 3편까지만 발행할 수 있어요. 3편 이상 보내면 4번째부터는 안 받아줘요. 이거 모르고 17편을 한꺼번에 보내려고 했더니, 4번째부터는전부 실패했어요.

처음엔 "왜 자꾸 실패하지?" 하고 원인을 못 찾았어요. 텔레그램으로 오는 에러 메시지를 보고 나서야 알았어요. "아, 한도 관련 문제가 있었구나" 하고요.

이제 자동으로관리해요. `naver-daily-counter.json`이라는 파일이 있는데, 여기에 오늘 몇 편 보냈는지 기록해요. 3편 도달하면 다음 날로 자동으로 이월시켜요. batch.sh를 실행하면 이걸 알아서 관리해줘요.

```bash
# 미리보기 (실제 게시 안 함)
bash ~/.openclaw/skills/naver-deploy/scripts/batch.sh --dry

# 실제 실행 (매일 3편씩 자동)
bash ~/.openclaw/skills/naver-deploy/scripts/batch.sh
```

batch.sh는 여러 편을 한꺼번에 보내야 할 때 써요. 17편을 보내야 하면, 자동으로 3편씩 나눠서 보내고, 3편 다 보냈으면 다음 날에 나머지를 보내요.

### 실패하면 어떻게 되는가

자동화스루 과정에서 실패하기도 해요. 예를 들어 SmartEditor가 업데이트돼서 버튼 위치가 바뀌거나, 네트워크 문제로 Chrome이 안 열리거나...

그럴 때는 Playwright가 자동으로 스크린샷을 캡처해요. 어디서 문제가 생겼는지 텔레그램으로 보내줘요. 그러면 내가 확인하고 고치면 돼요.

초기 셋업할 땐 종종 실패했어요. 그런데한 번고치면 그 다음엔 또 잘 돌아가거든요. 자동화의 좋은 점은, 고치고 나면 그 다음부터는 사람이 안 해도 된다는 거예요.

---

## 자주 받는 질문

**Q. Vercel이나 Netlify로도 안 되나요?**

안 됩니다. 전부 데이터센터 IP예요. GitHub Actions랑 똑같이 1단계(변환)까지만 되고, 2단계(실제 게시)는 안 돼요. 근데 사실 변환만 되면 의미가 없거든요. 중요한 건 게시니까요.

한 번 Vercel로 시도해본 적 있어요. 결과는 똑같았어요. 403 에러로 시작해서 같은 곳에서 끝났어요. 사실 이 мом엔트에서 포기하고 로컬 Mac 쪽으로 방향을 틀었어요.

**Q. Mac이 꺼져 있으면 어떻게 되나요?**

실행 중일 때만 돼요. Mac을 끄면 아무 일도 안 해요. 그래서 저는 가능하면 Mac은 켜놓아요. 아, 그리고 사실 서버를 쓰면 되긴 해요. VPS 같은 걸로 그런데 Mac이 꺼져 있으면 실행이 안 되니까, 그런 분들은 서버임대임대을 고려해보세요.

**Q. 일일 3편 이상 올리면 어떻게 해요?**

3편 도달하면 다음 날로 자동 이월돼요. batch.sh를 쓰면 이걸 알아서 관리해줘요. 예를 들어 17편을 보내야 하면, 자동으로 6일에 나눠서 보내요. 처음엔 이것도 몰라서 실패했어요... 그런데 지금은 알아서 되네요.

**Q. "이 기기를 신뢰" 안 하면 어떻게 되나요?**

2~3주마다 다시 로그인해야 해요. 저는 이거 모르고 한 달쯤 헤매다가 알게 됐어요. 그때부터는 꼭 체크해요.

---

## 마무리 — 그러니까

여기까지가 2단계 파이프라인의전체 흐름이에요.

1단계: GitHub Actions가 MD를 HTML로 변환하고 artifact에 올려요. 이건 GitHub가 해줘요. 우리 아는 거 없어요.

2단계: 내 Mac의 Playwright가 Chrome을 열고, artifact의 내용을 네이버 블로그에 게시해요. 이때 IP는 내 Mac의 통신사 IP니까 네이버가 안 막아요.

처음 셋업할 땐 좀 복잡해요. profile 만들고, Mac에 스크립트 넣고...그런데 한번 해두면 그 다음부턴 진짜 편해요.

그리고 막히는 부분 있으면 댓글이나 텔레그램으로 편하게 물어보세요. 같이 풀어봐요 💪

> 💡 다음 글: 이 파이프라인 만들다 보면 SmartEditor에서 함정을 많이 겪어요. "취소" 버튼 누르라고 했는데 글에 취소선이 그어졌던 사건... 같이 보시면 좋습니다.
