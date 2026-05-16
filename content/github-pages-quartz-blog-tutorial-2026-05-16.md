---
title: "GitHub Pages로 블로그 만들기: Quartz + GitHub Actions 자동 배포 Complete Guide"
date: 2026-05-16
tags:
  - github
  - github-pages
  - quartz
  - blog
  - tutorial
  - automation
description: "GitHub 계정 생성부터 Quartz 블로그 설치, GitHub Pages 배포, 자동화까지. 개발자 아니어도 할 수 있는 완전한 가이드."
aliases:
  - github-pages-quartz-blog-tutorial-2026-05-16/index
---

## 🎯 이 글에서 다루는 내용

1. **GitHub 계정 만들기** (5분)
2. **Quartz 블로그 설치하기** (10분)
3. **글 작성하고 로컬에서 확인하기** (5분)
4. **GitHub Pages로 무료 배포하기** (5분)
5. **GitHub Actions 자동화 설정** (3분)

---

## 1️⃣ GitHub 계정 만들기

### Step 1: GitHub 접속

[github.com](https://github.com)에 접속하세요.

### Step 2: Sign Up

**Sign up** 버튼을 클릭하고:

| 항목 | 입력 예시 |
|------|----------|
| **Email** | your-email@gmail.com |
| **Password** | 안전한 비밀번호 (12자 이상) |
| **Username** | `yourname` (블로그 주소에 사용됨!) |

> 💡 **중요**: Username이 블로그 주소가 됩니다!
> 예: Username이 `bluebrosna`면 → `bluebrosna.github.io`

### Step 3: Email 인증

입력한 이메일로 **Verification code**가 발송됩니다. 코드 입력하세요.

### Step 4: Plan 선택

**Free** 플랜을 선택하세요. 블로그에는 충분합니다!

### ✅ 완료!

축하합니다! 이제 `https://github.com/yourname`에서 프로필을 확인할 수 있어요.

---

## 2️⃣ Quartz 블로그 설치하기

### Quartz란?

**Quartz**는 GitHub Pages에 무료로 호스팅할 수 있는 Markdown 기반 블로그입니다.
마크다운으로 글쓰면 자동으로 예쁜 블로그로 변환해줍니다.

### 준비물

| 도구 | 설명 |
|------|------|
| **Git** | 버전 관리 (Mac은 기본 설치됨) |
| **Node.js** | Quartz 실행에 필요 [nodejs.org](https://nodejs.org) |

### Step 1: Node.js 설치

Mac 사용자라면 터미널에서:

```bash
# Homebrew 설치 (없으면)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 설치
brew install node
```

### Step 2: Quartz 다운로드

터미널에서 아래 명령어를 실행하세요:

```bash
# Quartz 클론
git clone https://github.com/jackyzha0/quartz.git
cd quartz

# 의존성 설치
npm install
```

### Step 3: Quartz 설정

```bash
# quartz.config.ts 파일을 열어서 수정
# 또는 기본 설정 그대로 사용 가능
```

### Step 4: 로컬 서버 실행

```bash
npx quartz build --serve
```

이제 브라우저에서 **http://localhost:8080** 접속하면博客 미리볼 수 있어요!

---

## 3️⃣ 글 작성하기

### 글 작성 방법

`content/` 폴더에 `.md` 파일을 만들기만 하면 됩니다!

**파일명 규칙**: `제목-YYYY-MM-DD.md`

**예시**:

```markdown
---
title: "내 첫 번째 블로그 글"
date: 2026-05-16
tags:
  - hello
  - first-post
---

## 안녕하세요!

这是我的第一篇博客文章。

마크다운 문법으로 자유롭게 작성하세요.
```

### 마크다운 기본 문법

| 문법 | 예시 |
|------|------|
| **제목** | `# 제목`, `## 소제목` |
| **굵게** | `**굵게**` |
| *기울임* | `*기울임*` |
| 링크 | `[텍스트](URL)` |
| 코드 | `` `코드` `` |

### 이미지 추가

```markdown
![이미지 설명](/assets/image.png)
```

---

## 4️⃣ GitHub Pages로 배포하기

### Step 1: GitHub에 저장소 만들기

1. [github.com](https://github.com)에 접속
2. **New repository** 클릭
3. Repository name: **`yourname.github.io`** (여기서 yourname은 GitHub Username)

> ⚠️ **중요**: 반드시 `yourname.github.io`로 만들어야 합니다!

### Step 2: 로컬 저장소를 GitHub에 연결

터미널에서:

```bash
cd quartz

# Git 초기화
git init
git add .
git commit -m "Initial commit"

# GitHub 저장소 연결
git remote add origin https://github.com/yourname/yourname.github.io.git
git branch -M main
git push -u origin main
```

### Step 3: GitHub Pages 활성화

1. GitHub 저장소에서 **Settings** 클릭
2. **Pages** 메뉴 선택
3. **Source**: **Deploy from a branch**
4. **Branch**: **main** / **(root)** 선택
5. **Save** 클릭

### ✅ 완료!

**5-10분 후** 아래 주소에서 블로그를 확인할 수 있어요:

```
https://yourname.github.io
```

---

## 5️⃣ GitHub Actions 자동화 설정

### 왜 자동화가 필요할까?

매번 터미널에서 빌드 명령어를 입력하는 대신, **GitHub에 코드를 푸시하면 자동으로 블로그가 업데이트**됩니다!

### GitHub Actions 설정

Quartz 저장소의 `.github/workflows/` 폴더에 이미 설정 파일이 포함되어 있습니다:

```yaml
# .github/workflows/deploy.yml
name: Deploy Quartz site to GitHub Pages

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npx quartz build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: public

  deploy:
    needs: build
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

### 동작 원리

```
1. 코드 푸시 (push)
2. GitHub Actions 자동 실행
3. npm install + quartz build
4. public 폴더를 GitHub Pages에 배포
5. 블로그 자동 업데이트!
```

---

## 🎉 완성!

축하합니다! 이제:

| 주소 | 설명 |
|------|------|
| **https://yourname.github.io** | 공개 블로그 |
| **https://github.com/yourname** | GitHub 프로필 |

매번 글을 쓸 때마다:
1. `content/` 폴더에 Markdown 파일 추가
2. Git에 커밋 + 푸시
3. **자동으로 블로그에 반영!**

---

## 💡 참고 자료

- [Quartz 공식 문서](https://quartz.jzhao.xyz/)
- [GitHub Pages 가이드](https://docs.github.com/ko/pages)
- [마크다운 문법](https://www.markdownguide.org/)

---

## ❓ 자주 묻는 질문

### Q: 비용이 드나요?
**A:** 없습니다! GitHub Pages + Quartz 모두 무료입니다.

### Q: 내가 작성한 글은 어디에 저장되나요?
**A:** GitHub 저장소에 Markdown 파일로 저장됩니다. 데이터는 항상 내手中!

### Q: 기술적인 거 어려워요...
**A:** 이 가이드를 따라하면 개발자 아니어도 가능해요!

---

*Written with OpenClaw ✨*
