---
title: "클라우드 자동화가 실패하는 진짜 이유 — IP 차단의 3가지 축"
date: 2026-05-22
tags:
  - IP차단
  - 봇탐지
  - 클라우드자동화
  - 데이터센터IP
  - Playwright
  - 프록시
  - VPN
  - 자동화실패
  - 웹스크래핑
  - AntiBot
description: "GitHub Actions나 AWS로 자동화를 세팅하면 즉시 차단당합니다. 봇 탐지의 3가지 축(IP 평판, User-Agent, 헤더 패턴)과 각 플랫폼별 우회/정공법을 정리합니다."
---

![차단된 화면과 데이터 흐름](/static/grok-images/post-07-image-1.png)

## 도입부

로컬에서는 완벽하게 동작하는 자동화가, 클라우드에 올리자마자 즉시 차단당했습니다. GitHub Pages에 배포한 자동 발행 파이프라인도, AWS로 세팅한 인스타 스크래핑도 — 전부 403 에러로 돌아왔습니다.

솔직히 이 문제로 한 몇 주를 헤매본 적 있어요. 코드는 완벽한데 왜 안 되지? 로컬에서는 되는데? Cloudflare가 문제야? 아니면 내 코드야? 사실 이게 뭘 감점을 인식하는지도 모르겠더라구요.

"GitHub Actions에서 잘 되는데 왜 AWS에서 안 되지?" — 이 생각 해보신 적 없으세요? 저는 한참을 그랬어요.

이유를 알아봤습니다. **IP 차단의 3가지 축과 각 플랫폼별 해결법**을 정리합니다. 이 글을 읽으시면 왜 자동화가 안 되는지, 그리고 어떻게 해야 진짜 작동하는지 알게 될 거예요.

---

## 봇 탐지의 3가지 축 🔍

웹사이트가 bot을 탐지하는 방법은 크게 세 가지입니다.

### 1. IP 평판 데이터베이스

데이터센터/호스팅 IP는 이미 **"Known Bot IP" 데이터베이스**에 등록되어 있습니다. Spamhaus, Project Honeypot 같은 공개 블랙리스트와, Cloudflare Bot Management 같은 상용 솔루션이 이 데이터베이스를 활용합니다.

```bash
# GitHub Actions IP 정보 확인
curl -s https://ipinfo.io/json | jq '{ip, org, city, country}'
# 출력 예시:
# {
#   "ip": "140.82.112.4",
#   "org": "AS36459 GitHub, Inc."
# }
```

`org` 필드에 "GitHub", "AWS", "Vercel" 등이 들어가면 **즉시 bot으로 분류**됩니다.

사실 이게 가장 큰 문제예요. AWS나 GitHub의 IP 대역은 이미 다 데이터베이스에 등록되어 있거든요. 그래서 우회하기가 까다로운 편이에요.

솔직히 이걸 알기 전에는 "IP가 뭔 문제가 있어요?" 하는 반응이었거든요. 근데 실제로 ipinfo.io에 GitHub Actions IP를조회해봤더니... Org 필드에 "GitHub, Inc."라고 떠요. 이건 말 그대로 GitHub 데이터센터 IP예요.

### IP 평판이 어떻게 작동하나

Spamhaus 같은 조직이 데이터베이스를 관리해요. 이 데이터베이스에는:

-알려진 불량 IPs (스팸, 봇, 악성코드)

- 데이터센터/호스팅 IPs ( AWS, GCP, Azure, Vercel, GitHub Actions)
- 투명 Proxies (VPN, 프록시 서버)

그리고 Cloudflare, Akamai 같은 CDN/보안 서비스들이 이 데이터베이스를 활용해서bot 여부를 판단해요.

쉽게 말하면: **IP를 보고 "이건 데이터센터에서 왔다" 하면 이미 봇의심가 되는 거예요.**

### 2. User-Agent 분석

클라이언트가 보내는 User-Agent 문자열로 bot과 일반 트래픽을 구분합니다.

```bash
# Bot User-Agent로 테스트
curl -s -I https://blog.naver.com \
  -H "User-Agent: GitHub-Actions" \
  -H "Accept-Language: en-US,en;q=0.9" \
  -w "\nHTTP_CODE: %{http_code}\n"
# 403이면 User-Agent 탐지 적용 중
```

`python-requests/2.28`, `curl/7.68.0` 등 명확한 bot 시그니처는 당연히 걸립니다.

그런데 사실 User-Agent는 쉽게 바꿀 수 있어서, 이거 alone로는 100% 탐지할 수 없어요. 근데 문제는 데이터센터 IP가 아니라 User-Agent를 바꿔봤자 IP 평판으로 걸린다는 거예요.

### 3. 헤더 패턴 감지

정상 브라우저는 Accept-Language, Accept-Encoding, Referer 등 **수십 개의 헤더**를 보냅니다. 이 헤더가 없거나 불완전하면 감점이 쌓여 bot으로 분류됩니다.

```bash
# 헤더가 다르게 오는지 비교
# 정상 브라우저
curl -s -I https://blog.naver.com \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36..."

# GitHub Actions (헤더 부족)
curl -s -I https://blog.naver.com \
  -H "User-Agent: Actions-Example"
```

둘 사이에 헤더 수가 확연히 달라요. 이 헤더 수 차이를 이용해서 봇인지 판단하는 거예요.

실제로 테스트해보면 알 수 있어요. `-v` 옵션으로 요청 헤더를 보면:

```
# 정상 브라우저 요청 헤더
GET / HTTP/1.1
Host: blog.naver.com
User-Agent: Mozilla/5.0 ...
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Cookie: ... (쿠키)
Referer: https://www.google.com/
Sec-CH-UA: "Not_A Brand";v="8", "Chromium";v="120"
Sec-CH-UA-Mobile: ?0
Sec-CH-UA-Platform: "macOS"
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: none
Sec-Fetch-User: ?1
Upgrade-Insecure-Requests: 1

# curl/gitHub Actions 요청 헤더
GET / HTTP/1.1
Host: blog.naver.com
User-Agent: GitHub-Actions
Accept: */*
```

이 차이를 보면 알 수 있어요. 정상 브라우저는 20개 이상의 헤더를 보내는데, curl이나 GitHub Actions는 몇 개 안 돼요.

---

## 사례 1: 네이버 블로그 — Cloudflare Bot Management 💥

네이버는 Cloudflare를 사용합니다. GitHub Actions IP에서 blog.naver.com에 접속하면:

1. Cloudflare가 IP를 검사 → "GitHub 데이터센터 IP"로 분류
2. CAPTCHA 또는 403 반환
3. 로그인 시도 → "캡차" 발생

저도 이거 때문에 한참을 헤매요. GitHub Actions에서 curl로 blog.naver.com에 접속하면 403이 돌아오더라구요. 처음엔 HTTPS 문제인 줄 알았어요. 근데 아니었어요.

심지어 **외부 이미지(Unsplash 등)도 차단**됩니다. 네이버는 `<img src="external-cdn.com/...">`마저 "외부 이미지 차단" 처리합니다.

사실 이거 발견했을 때 좀 충격이었어요. 글 내용 중에 Unsplash 이미지 쓰면 "이미지찾을 수 없음" 표시가 뜨는 거예요. 그게 네이버가 외부 CDN을 차단하고 있어서 그런 거였어요.

### 확인 방법

```bash
curl -s -I https://blog.naver.com \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)..." \
  -w "\nHTTP_CODE: %{http_code}\n"
# 403이면 Cloudflare 차폐 적용 중
```

### 왜 외부 이미지까지 차단하지?

이건 아마 네이버의 봇 탐지 전략이랑 관련이 있어요. 외부 CDN에서 오는 요청은 통제할 수 없거든요. 그래서 그냥 차단해버리는 게 나아요.

사실 이건 꽤 골치예요. 로컬에서 미리 외부 이미지들을 다운로드해서 내 서버에 호스팅하고, 그걸 쓰면 돼요. 근데 그럼 귀찮아지거든요.

---

## 사례 2: 인스타그램 — Rate Limit vs Challenge 📱

Instagram.com 웹 스크래핑을 데이터센터 IP에서 시도하면 **"anomalous activity" challenge(계정 확인 요청)**가 발생합니다.

이건 진짜 골치예요. 자동화를 구축한 뒤 막상 실행했더니 "계정에 이상 활동이 감지되었습니다. 본인 확인을 하세요."라는 창이 뜨는 거죠.

반면 Instagram Graph API는 **토큰 기반**이라 IP보다 토큰 자체의 권한이 중심입니다. 하지만 Graph API도 토큰 만료, 권한 부족 시 403을 반환합니다.

| 방법                      | IP 민감도 | 토큰 필요 | 자동화 난이도 |
| ------------------------- | --------- | --------- | ------------- |
| Instagram.com 웹 스크래핑 | 높음      | ❌        | 높음          |
| Instagram Graph API       | 낮음      | ✅        | 중간          |

사실 이 표를 보면 Graph API가 답처럼 보이는데, 그게 아니라서요. Graph API도 발급 과정이 복잡하고, 권한 심사를 받아야 하는 경우가 있어요. 뭐랄까... 하나 고치면 다른 하나가 문제인 느낌이에요.

### 왜 웹 스크래핑은 IP에 민감한가

Instagram은 웹에서 들어오는 요청을 브라우저 환경에서 평가해요. 브라우저가 보내는 헤더, 쿠키,JavaScript 실행 환경 등을 모두 분석해서bot 여부를 판단해요.

데이터센터 IP에서 이 모든 걸 정상적으로 spoofing하기는 어려워요. 헤더는 어떻게든 바꿀 수 있어도, JavaScript 실행 환경까지 완벽하게재현하기는 힘들거든요.

---

## 우회법 vs 정공법 ⚖️

### 우회법: 프록시 / VPN / 모바일 핫스팟

```bash
# 프록시 목록으로 전환하며 테스트
curl -x https://proxy_ip:port \
  -U "username:password" \
  -L "https://blog.naver.com"
```

- **일시적으로 작동**하지만 프록시 서버가 blocklist에 올라가면 다시 차단
- 상용 프록시는 비용 발생
- 유지보수에 지속적인 노력 필요

솔직히 말하면, 우회법은 근본적인 해결이 아니에요. 프록시 IP가 blocklist에 올라가면 또 우회법을 찾아야 하고... 이게 끝이 없거든요.

### 정공법: 로컬 Playwright + 영구 프로필 ✅

```javascript
import { chromium } from "playwright"

const context = await chromium.launchPersistentContext(
  "/path/to/chrome-profile", // 실제 Chrome 프로필 경로
  {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
  },
)
```

- **쿠키 + 세션 + 지문(디바이스 정보)**이 통째로 유지
- "이 기기를 신뢰" 옵션과 동일한 효과
- 한 번 설정하면 수개월 유지
- 클라우드 변환 + 로컬 게시 분리로 자동화 파이프라인 완성

사실 이 방법이 제일 확실해요. 클라우드에서 변환만 하고, 실제 게시만 로컬에서 하는 거예요. 그러면 IP는 내 집/사무실 IP로고정되니까 차단되지 않아요.

근데 여기서 문제는... 내 컴퓨터가 항상 켜져 있어야 하냐는 거예요. 그건 좀 귀찮을 수 있어요.

그래서 저는 이렇게 해요: GitHub Actions에서 변환은 다 하고, 실제 "게시" 버튼 누르는 것만 로컬에서 해요. 이러면 내 IP로만 게시가 되거든요.

### 자동화 파이프라인의이상형

저는 이렇게 구축했어요:

```
[1] 유튜브 영상 다운로드 (로컬 or 클라우드)
[2] ffmpeg로 세로 변환 + 자막 번인 (클라우드)
[3] GitHub Pages에 영상 호스팅 (클라우드)
[4] ---- 여기까지가 클라우드 ----
[5] ---- 여기가 로컬 Playwright ----
[6] Instagram Graph API로 릴스 업로드 (로컬, 내 IP)
```

이러면 클라우드의 빠른 처리 속도와, 로컬의 정상 IP를 모두 활용할 수 있어요.

사실 이 파이프라인을 구축하면서 가장 고민했던 건 "내 컴퓨터를 항상 켜두어야 하는가"였어요. 정리하면 "아니어도 된다"예요. GitHub Actions가 변환을 다 해놓고, 저는 Telegram으로 알림만 받고, 슬쩍 게시 버튼만 누르면 되거든요. 이 구조를 생각해보면, 내 컴퓨터는 하루에 고작 1~2분만 켜 있으면 돼요.

---

## 각 플랫폼별 해결책 정리

| 플랫폼            | 차단 유형                  | 권장 해결책                   |
| ----------------- | -------------------------- | ----------------------------- |
| **네이버 블로그** | 데이터센터 IP + Cloudflare | 로컬 Playwright + 영구 프로필 |
| **인스타그램 웹** | IP + challenge             | Instagram Graph API (토큰)    |
| **페이스북**      | IP + fingerprint           | Graph API + 영구 페이지 토큰  |
| **유튜브**        | API rate limit             | YouTube Data API v3 (OAuth)   |
| **트위터/X**      | IP + automated behavior    | Twitter API v2 (OAuth)        |
| **Google**        | CAPTCHA + rate limit       | Google Cloud API              |

사실 이 표만 보면 다 "API 쓰세요"라고 되어 있는데, 그게그렇게 쉬운 건 아니에요 거예요. API 발급도 일이고, 권한 심사도 일이고, 토큰 관리도 일이에요.

그래서 저는 결국:

- 변환은 클라우드(GitHub Actions)에서
- 실제 게시만 로컬 Playwright에서

이렇게 분산했습니다. 한 번 구축하면 GitHub Actions가 알아서 변환하고, 저는 게시 알림만 받고 로컬에서 확인하면 되거든요.

---

## 실제로 해볼 때 자주 하는 실수 ✋

### 실수 1: "로컬에서 되면 클라우드에서도 될 거야"

이 생각 안 해보셨어요? 저도 한참을 그랬어요.

근데 이게 가장큰 착각이에요. 로컬 IP는 가정용/회사용이라 평판이 좋은데, 클라우드 IP는 데이터센터라 평판이 나빠요. 같은 코드인데 결과가 달라지는 이유예요.

### 실수 2: "User-Agent만 바꾸면 돼"

User-Agent는 쉽게 바꿀 수 있어요. 근데 IP 평판은 못 바꿔요.

프록시를 쓰면 IP는 바꿀 수 있는데, 그 프록시 IP가 또 blocklist에 있을 수 있어요. 이게 끝없는 싸움이에요.

### 실수 3: 자동화 구축 후 관리 안 함

자동화가 되는 걸 확인하고 나서, 한 달 뒤에 다시 해보면 안 되는 경우가 있어요.

왜냐면:

- 토큰이 만료됐거나
- 플랫폼의 봇 탐지 정책이 업데이트됐거나
- IP가 blocklist에 새로 올라갔거나

그래서 자동화 구축했으면, 주기적으로 작동하는지 확인하는 절차가 필요해요.

---

## 마무리

자동화의 핵심은 **"어디서 실행되느냐"**입니다. 데이터센터 IP에서 실행되면, 코드가 아무리 정교해도 봇 탐지에 걸립니다.

사실 이걸 모르고 자동화를 구축하려고 하니까 매번 실패하는 거예요. "왜 안 되지?" 하고 코드만 고치잖아요. 근데 문제는 코드가 아니라 어디서 실행되느냐였어요.

**우회법(프록시/VPN)은 일시적인 해결책**이고, **정공법(로컬 Playwright + 영구 프로필)은 장기적인 해결책**입니다. 처음부터 정공법으로 구축하면 유지보수 시간이 훨씬 줄어듭니다.

자동화에 관심이 있다면, IP가 데이터센터인지 먼저 확인해보세요. 거기서 대부분의 답이 나옵니다.

사실 이 글의 교훈은 하나예요. **클라우드는 준비만, 실행은 로컬에서.** 이걸 이해하면 자동화의 80%는 해결돼요.

## 각 플랫폼별 Bot 탐지 수준 정리

플랫폼마다 봇 탐지 수준이 다르기 때문에, 전략도 다르게 가져가야 해요.

| 플랫폼        | 탐지 수준         | 가장 좋은 방법                | 피해야 할 것 |
| ------------- | ----------------- | ----------------------------- | ------------ |
| 네이버 블로그 | 높음 (Cloudflare) | 로컬 Playwright + 영구 프로필 | API + 프록시 |
| 인스타 웹     | 높음              | 인스타 Graph API (토큰)       | 웹 스크래핑  |
| 페이스북      | 높음              | Graph API + 영구 페이지 토큰  | 웹 스크래핑  |
| 유튜브        | 낮음~중간         | 유튜브 Data API v3            | 웹 스크래핑  |
| 트위터/X      | 중간              | Twitter API v2                | 웹 스크래핑  |

사실 표를 다시 보니, 대부분의 플랫폼에서 **API 방식**이 답이에요. 웹 스크래핑은 기술적으로 가능한데도, 플랫폼들이 봇 탐지를 계속 강화하고 있어서 장기적으로 쓰기 어렵거든요.

그래서 저는 이렇게 정리해요:

- **API가 있으면 API 쓴다** (가장 안정적)
- **API가 없으면 로컬 Playwright** (IP 문제 해결)
- **프록시/VPN은 최후의 수단** (일시적 해결에 불과)

---

**핵심 체크리스트:**

- [ ] 내 자동화가 어디서 실행되는지 확인 (로컬 vs 클라우드)
- [ ] 클라우드 IP가 데이터센터인지 확인 (ipinfo.io)
- [ ] 봇 탐지 방식 이해 (IP, User-Agent, 헤더 3가지 축)
- [ ] 우회법 vs 정공법 중 선택
- [ ] 정공법 선택 시 로컬 Playwright + 영구 프로필 구축
- [ ] 자동화 파이프라인: 클라우드 변환 + 로컬 게시 분할
- [ ] 주기적으로 자동화 작동하는지 확인

이 글을 읽고 나서 "그럼 내 자동화는 어디서 실행되고 있지?" 하고 확인해보시면 좋아요. 거기서 답이 보일 거예요.

> 💡 다음 글: SuperGrok Heavy 솔직한 리뷰 — 장점 + 단점 균형.
