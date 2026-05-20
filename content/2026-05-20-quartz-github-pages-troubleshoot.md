---
title: "Quartz 블로그 GitHub Pages에 배포했는데 CSS가 완전히 깨집니다"
date: 2026-05-20
tags:
  - Quartz
  - GitHubPages
  - StaticSite
  - CSS깨짐
  - baseUrl
  - SPA
  - GitHubActions
  - sed
  - 트러블슈팅
  - 블로그만들기
description: "Quartz로 만든 블로그를 GitHub Pages에 배포했더니 메인 페이지는 좋은데 글을 클릭하면 CSS가 깨집니다. baseUrl 설정, SPA 모드, pretty-link, workflow 경로 문제 4가지를 중심으로 해결합니다."
---

![CSS가 깨진 웹사이트 화면](/static/grok-images/post-06-image-1.png)

## 도입부

로컬에서 `npx quartz build --serve`로 확인하면 완벽합니다. 그런데 GitHub Pages에 배포하자 — **메인 페이지는 좋은데 글을 클릭하면 CSS가 완전히 깨집니다.**

3시간을 헤맸습니다. 이 3시간 동안 사실 원인을 전혀 몰랐어요. 로컬에서는 되는데 배포하면 안 되니까, 빌드문제가 생김? GitHub Pages 설정이 잘못된 건가? Quartz 설정이 이상한 건가? 사실 뭐가 문제인지 조차 감이 안 왔거든요.

솔직히 이 문제가 생겼을 때 제 심경은 이랬어요:
- "로컬에서는 되는데 왜 안 되지?"
- "GitHub Pages 설정이 잘못된 건가?"
- "Quartz 설정이 이상한 건가?"
- "빌드가 문제인 건가?"

이 모든 생각을 전부 해봤거든요. 그런데 원인은 네 가지였어요. baseUrl, SPA 모드, pretty-link, workflow의 asset 복사 경로 — 하나씩 살펴보겠습니다. 이 글은 제가 실제로 헤맨 내용을 정리한 거라... 저랑 같은 상황에 놓인 분이라면 딱 맞을 거예요.

---

## 원인 1: baseUrl 미설정 — 가장 많은 경우 🔧

### 증상

메인 페이지(`/`)에서 글(`/post/글제목`)로 이동하면 CSS가 깨집니다. 정확히 말하면:
- 첫 페이지는 CSS 정상
- 어떤 글 하나 클릭하면 CSS가 안 불러와짐
- 콘솔에 `index.css` 404 에러가 가득

### 원인

Quartz는 기본적으로 root(`/`) 기준 절대경로를 사용합니다. 그런데 GitHub Pages는 `{username}.github.io/{repo}/` 같은 서브경로에 배포되기 때문에, 경로가 일치하지 않아요.

로컬에서는 `http://localhost:3000/`이 root라서 문제가 없어요. 근데 GitHub Pages에 배포하면 root가 `https://username.github.io/repo/`가 되거든요.

예를 들어볼게요. 로컬에서는:
```
http://localhost:3000/index.css  ✅
http://localhost:3000/post/글제목/index.css  ✅
```

근데 GitHub Pages에 배포하면:
```
https://username.github.io/repo/index.css  ✅
https://username.github.io/repo/post/글제목/index.css  ❌ (실제 파일은 /repo/index.css)
```

이게 왜그러냐면, quartz가 baseUrl을 모르면 `/index.css`로 요청하는데, 브라우저는 `/post/글제목/index.css`를 요청한 셈이 되는 거예요.

### 해결

```typescript
// quartz.config.ts
export const config = {
  baseUrl: "bluebrosna.github.io",  // ⚠️ 끝에 slash 없음
  enableSPA: true,
  // ...
};
```

**주의:** `bluebrosna.github.io/` 처럼 끝에 slash를 넣으면 안 됩니다. `"bluebrosna.github.io"`가 올바른 형식이에요.

사실 이거 때문에 한참을 헤맸어요. trailing slash를 넣었다가 무한 리다이렉트가 뜨는 거예요. 도대체 왜 안 되는 거야... 하신 분 계실 거예요.

### 왜 trailing slash가 문제인가

baseUrl에 trailing slash가 있으면:
- CSS 요청이 `/baseUrl//index.css`가 됨 (이중 슬래시)
- 이건 404 에러

baseUrl에 trailing slash가 없으면:
- CSS 요청이 `/baseUrl/index.css`가 됨
- 이게 정상 경로

이 차이를 모르고 있다가 한참을 헤맸어요. "baseUrl 설정했는데 왜 안 되지?" 하시고 있다면, 끝에 slash가 있는지 확인해보세요.

---

## 원인 2: SPA 모드 + pretty-link 조합 💥

### 증상

`/content/post/글제목/` 같은 pretty-link(`.html` 없이 URL)로 직접 진입하면 CSS 404 에러가 발생합니다.

그런데 여기서 신기한 게 있어요. 메인 페이지에서 글 링크를 클릭하면( 내부 라우팅) CSS가 정상인 경우가 있어요. 근데 새로운 탭에서pretty-link URL을 직접 열면 CSS가 깨져요.

이게 왜 그러냐면... SPA 모드에서는 내부 이동이랑 직접 URL 진입의 경로 해석이 다르거든요.

### 원인

SPA 모드에서 `./index.css` 같은 상대경로가 페이지 기준 `/content/post/index.css`로 해석되기 때문입니다. 그런데 실제로 CSS 파일은 `/index.css`에 있어요.

```bash
# public/ 어떤글/index.html 파일 확인
cat public/어떤글/index.html | grep index.css
# → href="./index.css" (상대경로)
# → 실제 파일은 /index.css (절대경로)
```

이걸 이해하려면, pretty-link가 어떻게 만들어지는지 알아야 해요.

Quartz는 SPA 모드에서 `enableSPA: true`로 설정하면, 각 글에 대해 `/글제목/index.html` 파일을 생성해요. 이게 pretty-link예요.

그런데 문제는, 이 HTML 파일 안의 CSS href가 상대경로(`./index.css`)로 되어 있다는 거예요. `/글제목/` 디렉토리 안에서 `./index.css`를 요청하면 `/글제목/index.css`를 찾거든요. 그런데 실제 파일은 `/index.css`에 있어요.

### 해결

workflow에서 sed로 경로를 치환해줘야 합니다.

```yaml
# .github/workflows/deploy.yml
- name: Fix asset paths
  run: |
    find public -name "*.html" -exec sed -i '' \
      's|href="./index.css"|href="/bluebrosna.github.io/index.css"|g' {} \;
    find public -name "*.html" -exec sed -i '' \
      's|src="./|src="/bluebrosna.github.io/|g' {} \;
```

> ⚠️ **macOS의 sed는 `-i ''` (빈 문자열 인자 필수).** Linux에서는 `sed -i`만 쓰면 됩니다.

사실 이 부분에서 가장 많이 헤맸어요. Linux용 sed 명령어를 그대로 macOS에서 실행하면 에러가 뜨거든요. `-i ''` 안 하면 `extra operands at ''` 같은 에러가 나요.

### sed -i ''이 왜 필요한가

macOS의 sed는 `-i` 옵션에 반드시 인자를 요구해요. Linux의 sed는 `-i`만으로도 되는데, macOS는 그렇지 않아요.

그래서 스크립트를 Linux랑 macOS 둘 다에서 쓸 거라면:
```bash
# macOS/Linux 호환
sed -i '' 's/old/new/g' file.txt  # macOS
sed -i 's/old/new/g' file.txt       # Linux
```

이렇게 분기 처리를 해야 해요. 아니면 아예 bash 스크립트 맨 위에 `set -euo pipefail`을 넣고, `-i` 대신 `-i.bak`로 백업 파일을 만드는 방법도 있어요.

---

## 원인 3: workflow에서 static asset 복사 미흡 📦

### 증상

`static/videos/`나 `static/images/`가 GitHub Pages에 반영되지 않았습니다. 이미지는 다 보인데, mp4 영상만 404인 경우가 있어요.

### 원인

`cp static/* public/static/` 명령으로 asset을 복사할 때, 경로가 깨져서 복사되지 않는 경우입니다. 특히 `cp` 명령에서 `*` 와일드카드를 쓰면, 해당 디렉토리가 비어있을 때 복사가 안 돼요.

### 해결

```yaml
# 올바른 복사 방법
- run: |
    cp -r static/* public/static/
```

디렉토리가 없으면 먼저 생성 후 복사:

```yaml
- run: |
    mkdir -p public/static
    cp -r static/* public/static/
```

mp4 파일이 복사 안 되는 문제는 사실 더 근본적인 게 있어요. GitHub Pages가 기본으로 배포하는 파일 확장자에 mp4가 없거든요. 그래서 workflow에서 artifact를 업로드하기 전에, 반드시 `public/static/videos/`에 파일이 존재하는지 확인해야 해요.

```bash
# 실제로 복사됐는지 확인
ls -lh public/static/videos/
```

### 왜 mp4가 GitHub Pages에 안 올라가지?

사실 이건 GitHub Pages의 제한사항이에요. GitHub Pages는 보안상의 이유로 일부 파일 확장자를 배포에서 제외해요.

제거되는 확장자 목록 (보통):
- .exe (실행파일)
- .sh (셸 스크립트)
- 등등...

mp4는 기본으로 허용되는데, workflow에서 artifact를 업로드할 때 파일이 없으면 당연히 404가 나요.

그래서 workflow에서 `cp` 명령으로 확실히 복사하는 게 중요해요.

---

## 원인 4: 로컬 빌드 vs GitHub Pages 차이 🖥️

### 로컬에서 확인할 것

사실 이게 가장 중요한 확인 절차예요. 로컬에서 먼저 완벽하게 동작하는 걸 확인하고 GitHub Pages에 배포해야, 문제가 어디서 발생하는지 구분할 수 있어요.

```bash
cd ~/bluebrosna.github.io
npx quartz build --serve
# http://localhost:3000 에서 글별 CSS 정상 확인
```

로컬에서는 baseUrl 없이도 동작하므로, **로컬에서 확인한 후 GitHub Pages에 배포**해야 문제가 어디서 발생하는지 구분할 수 있습니다.

근데 여기서 중요한 point... 사실 저는 이 확인을 안 하고 바로 배포했거든요. "로컬에서 됐는데 당연히 배포에서도 되겠지" 하고. 그게 문제의 시작이었어요.

### 배포 전 grep으로 경로 확인

로컬 빌드 결과(public/ 폴더)를 확인하면, 배포 전에 문제를 잡을 수 있어요.

```bash
# public/ 폴더 내 HTML 파일 경로 확인
grep -r 'href="./' public/ | head -20
# 상대경로(./)가 있으면 → sed 치환 필요

grep -r 'href="/' public/ | head -20
# 절대경로(/로 시작)가 올바른 형태
```

이 grep 명령어 하나로 pretty-link로 인한 CSS 404 문제를 바로 파악할 수 있어요.

### public/ 폴더 구조 이해

로컬에서 quartz build하면 이런 구조가 만들어져요:

public/
  index.html              ← 첫 페이지
  index.css               ← 메인 CSS
  404.html                ← 404 에러 페이지
  sitemap.xml             ← 검색 engine 등록용
  quartz/
    static/               ← quartz 관련 리소스
  글제목/
    index.html            ← pretty-link HTML
  static/
    videos/
      영상.mp4            ← 미디어 파일
    assets/
      이미지.png          ← 리소스 파일


이 구조를 이해하면 문제가 어디서 나는지 바로 감이 와요. 예를 들어 CSS가 404면, public/index.css가 실제로 존재하는지부터 확인하면 되거든요.

sitemap.xml이 있으면 Google 같은 검색 engine이 내 블로그 글을 더 잘 색인해요. Quartz는 빌드할 때 자동으로 sitemap.xml을 생성해주는데, GitHub Pages에서 문제가 생기면 sitemap도 같이 확인해봐야 해요.


### 로컬에서 안 되는 건 GitHub Pages에서도 안 됨

중요한 원칙 하나만 기억하세요:

**로컬에서 안 되는 건 GitHub Pages에서도 안 됩니다.**

로컬에서 baseUrl 문제로 CSS가 깨지면, 배포에서도 깨져요. 로컬에서 sed 치환이 필요하면, 배포에서도 필요해요.

로컬에서 완벽했는데 배포에서 깨지면, 그건 99% baseUrl 문제예요.

---

## 복합 문제일 때 — 4가지를 순서대로 확인

이 네 가지 원인이 동시에 발생하면 문제가 어디서 난 건지 알기 어려워요. 그래서 순서대로 확인하는 게 중요해요.

| 확인 순서 | 원인 | 증상 | 확인 방법 |
|---|---|---|---|
| 1 | baseUrl 미설정 | 모든 asset 404 | `quartz.config.ts`에서 `baseUrl` 확인 |
| 2 | SPA 모드 경로 | pretty-link 진입 시 CSS 깨짐 | grep으로 `./` 경로 확인 |
| 3 | static 복사 누락 | 이미지/동영상 안 보임 | `public/static/` 디렉토리 확인 |
| 4 | sed 미실행 | CSS 경로 여전히 상대경로 | HTML 파일 내 `href="./` 검색 |

근데 사실 이 표대로 해도 잘 안 되는 경우가 있어요. 왜냐면 quartz.config.ts의 baseUrl을 수정해도, 이미 배포된 파일은 그대로거든요. baseUrl을 고쳤으면 반드시 다시 빌드하고 배포해야 해요.

---

## 배포 후 확인 — 가장 확실한 방법

workflow를 수정하고 나면, 반드시 배포된 URL에서 확인해야 해요. curl로 HEAD 요청하면 금방 알 수 있어요.

```bash
# 기본 CSS 파일 확인
curl -I "https://bluebrosna.github.io/index.css"
# → HTTP/2 200 ✅
# → HTTP/2 404 ❌ → 경로 문제

# pretty-link된 글의 CSS 확인
curl -I "https://bluebrosna.github.io/어떤글/index.css"
# → HTTP/2 200 ✅
# → HTTP/2 404 ❌ → sed 치환 누락

# static/videos/ mp4 확인
curl -I "https://bluebrosna.github.io/static/videos/영상파일.mp4"
# → HTTP/2 200 ✅
# → HTTP/2 404 ❌ → cp 명령 누락
```

사실 이 확인하는 습관이 없으면 문제를 뒤늦게 발견하게 돼요. 배포하고 나서 이메일로 "블로그 접속이 안 돼요"라는 말을 듣고야 알아채는 거죠.

---

## 실제로 해볼 때 자주 하는 실수 ✋

### 실수 1: baseUrl 설정 안 함

"로컬에서 잘 되는데 배포에서도 되겠지" — 이 생각 안 해보셨어요? 저도 그랬어요.

근데 GitHub Pages의 URL 구조는 로컬하고 달라요. 무조건 baseUrl을 설정해야 해요.

### 실수 2: sed -i '' 안 함 (macOS에서)

Linux에서 검증된 workflow 스크립트를 macOS에서 실행하면 sed에서 에러가 나요.

```bash
# ❌ macOS에서 안 됨
sed -i 's/old/new/g' file.txt

# ✅ macOS에서 동작
sed -i '' 's/old/new/g' file.txt
```

### 실수 3: 빌드 안 하고 배포함

baseUrl을 수정하거나 workflow를 수정하면, 반드시 다시 빌드해야 해요.

```bash
npx quartz build
git add . && git commit -m "fix: baseUrl and workflow"
git push
```

### 실수 4: public/ 폴더를 소거함

quartz build하면 public/ 폴더가 통째로 교체돼요. 그래서 빌드할 때마다 local에서 생성된 public/ 파일도 다시 만들어져요.

근데 gitignore에 public/이 들어가 있으면, push할 때 public/ 폴더가 올라가지 않아요. 그래서 GitHub Actions에서 quartz build를 하는 거예요.

---

## 마무리

Quartz + GitHub Pages CSS 깨짐의 핵심은 **"로컬에서는 baseUrl 없이 동작하는 경로가, GitHub Pages에서는 반드시 baseUrl이 필요하다는 점"**이에요.

해결 순서:
1. `quartz.config.ts`에 `baseUrl` 올바르게 설정
2. workflow에서 sed로 상대경로 → 절대경로 치환
3. `static/` → `public/static/` 복사 확인
4. 로컬에서 먼저 빌드 확인 후 배포

사실 이 문제들은 각각 하나씩은 단순해요. 근데 네 개가 동시에 터지면 어디서부터 손을 대야 할지 모르겠더라구요. 그래서 이 글에서 순서대로 정리한 거예요.

로컬에서 완벽했는데 GitHub Pages에서 깨진다면, baseUrl부터 확인하세요. 대부분의 경우 거기서 끝납니다.

그런데 사실... 이 모든 것보다 더 중요한 게 있어요. **배포 전에 로컬에서 확인하는 습관.** 이거 하나면 80% 문제는 예방돼요.

**핵심 체크리스트:**

- [ ] `quartz.config.ts`에 `baseUrl`이 정확히 설정되어 있는가?
- [ ] `baseUrl` 끝에 slash(/)가 없는가?
- [ ] `enableSPA: true`로 설정되어 있는가?
- [ ] workflow에서 static 파일 복사 명령이 있는가?
- [ ] workflow에서 sed 경로 치환 명령이 있는가?
- [ ] 로컬에서 `npx quartz build --serve`로 CSS가 정상인지 확인했는가?
- [ ] `grep -r 'href="./' public/`으로 상대경로가 없는지 확인했는가?
- [ ] 배포 후 `curl -I`로 모든 asset이 200인지 확인했는가?

한 번에 다 확인하기 어렵다면, 하나씩 해나가면서 에러 메시지를 보면roff 방향이 잡혀요.

> 💡 다음 글: 데이터센터 IP 차단의 모든 것 — 기술적 깊이와 함께.
