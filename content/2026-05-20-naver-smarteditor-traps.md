---
title: "네이버 SmartEditor 자동화, '취소' 버튼 클릭했는데 '취소선'이 적용됐어요"
date: 2026-05-20
tags:
  - SmartEditor
  - 네이버블로그
  - Playwright
  - 자동화
  - 디버깅
  - Selenium
  - 에러수정
  - 웹크롤링
  - 개발자
  - 팁
description: "네이버 SmartEditor 자동화에서 '취소' 버튼 클릭했는데 '취소선'이 적용된 황당한 버그부터 8가지 함정을 경험담처럼 풀어봅니다."
---

![코드 에러가 표시된 화면](/static/grok-images/post-05-image-1.png)

## 도입부 — 가장 황당했던 버그

네이버 SmartEditor 자동화를 시작했는데... '취소' 버튼을 클릭했는데 '취소선'이 글이에요.

이게 가장 황당했던 버그였어요. 원인 찾느라 2시간 헤맸거든요.

문제를 파악해보니... 어떤 버튼을 클릭했는지, SmartEditor 내부의 어떤 구조 때문에 문제가 생겼는지 하나씩 알아가면서 디버깅을 했어요. 그런데 그게 끝이 아니었어요. 총 8가지 함정이 있었거든요.

이 글에서 그 8가지를 하나씩 풀어보려고 해요. 각각 증상과 해결 방법을 정리했으니, 똑같은 문제로 헤매는 분들한테 도움이 됐으면 해요.

솔직히 말하면... 저도 이 모든 걸 한 번에 해결한 게 아니라, 하나씩 부딪히면서 배웠어요. 어떤 건 30분이면 해결됐고, 어떤 건 2시간이 걸렸고요. 특히 "취소선" 버그는 진짜 어이없었어요. 원인을 모르겠어서 그냥 한 글씨씩 지워가며 테스트했거든요.

그런데 이렇게 하나씩 해결하고 나니까, patterns이 보이기 시작했어요. SmartEditor의 DOM 구조가 특수한 경우가 많고, 버튼 선택자에스코프가 필요하다는 것, 쿠키와 DOM 상태가 다르다는 것... 이런 것들이에요.

여기서 다룰 내용은 이 세 가지예요:

- 가장 황당했던 "취소선" 버그의 원인
- 8가지 함정 각각의 증상과 해결책
- SmartEditor DOM을 분석하는 디버깅 팁

---

## H2 #1 — "취소" 버튼 vs "취소선" 버튼, 가장 황당한 버그

### 취소 버튼을 클릭했는데 취소선이 적용됐어요

이건 진짜 황당했어요.

자동화을 만들면서, 글 작성 중에 "취소" 버튼을 클릭하면 작성이 취소되게 하고 싶었어요. 그래서 코드를 이렇게 썼어요.

```javascript
const cancelBtn = page.locator('button:has-text("취소")');
await cancelBtn.click();
```

문법적으로는 이상 없어요. "취소"라는 텍스트가 있는 버튼을 클릭하는 거니까요.

그런데 실제 실행해보니까... 글이 취소되는 게 아니라 **취소선이 그어졌어요**.

네이버 SmartEditor에는 "취소" 버튼이 두 개 있어요. 하나는 글 작성 화면의 팝업에 있는 실제 "취소" 버튼이고, 다른 하나는 툴바에 있는 "취소선"(strike-through) 버튼이에요.

우연히도 "취소"라는 텍스트가 "취소선" 버튼에도 포함되어 있어서, 셀렉터가 툴바의 "취소선" 버튼을 클릭한 거예요.

### 어떻게 발견했나

솔직히 처음엔 이유를 몰랐어요. "버튼을 클릭했는데 왜 취소선이 적용되지?" 하고 솔직히 30분 동안 원인을 찾았어요. 코드 자체는 틀린 게 없어 보였으니까요.

문제를 파악하려면 실제 DOM 구조를 봐야 했어요. Playwright의 `page.pause()`로 개발자 도구를 열고, SmartEditor의 버튼 구조를 직접 확인했어요.

그랬더니알게 됐어요이에요. "취소" 텍스트가 들어간 버튼이 툴바에도 있고, 팝업에도 있다는 걸 알았어요.

### 해결 방법

해결은 간단해요. **팝업 컨테이너로 스코프를 한정**하고, "선"이라는 텍스트가 들어간 버튼은 제외하면 돼요.

```javascript
// 잘못된 방법: "취소"가 들어간 모든 버튼 매칭
const cancelBtn = page.locator('button:has-text("취소")');

// 올바른 방법: popup 스코프 한정 + "선" 제외
const popup = page.locator('.se-popup-container, .se-popup, [class*="popup"]').first();
const cancelBtn = popup.locator(
  '.se-popup-button-cancel, button:has-text("취소"):not(:has-text("선"))'
).first();
```

> 💡 여기서 핵심: 버튼 텍스트만으로 셀렉터를 만들지 말고, 반드시 부모 컨테이너로 스코프를 한정하세요.

---

## H2 #2 — 로그인 했는데 세션 만료라고요?

### 쿠키는 있는데 "세션 만료" 에러가 떴어요

이건또 다른 황당한 버그였어요.

자동화 코드를 실행했더니, "세션 만료 — 재로그인이 필요합니다"라는 에러가 나왔어요. 그런데 잘 생각해보면, 방금 전에 Chrome에서 네이버에 로그인해서 쿠키가 남아있었거든요.

도대체 왜 그런 거예요?

### 원인

문제를 파악해보니, 로그인 여부를 **DOM 셀렉터**로 판단하고 있었어요. 특정 요소가 화면에 보이면 "로그인됨"으로 판단한 거예요.

그런데 이게 문제예요. 쿠키가 남아있어도, 서버 측 세션이 만료된 경우, DOM은 "로그아웃 상태"로 렌더링돼요. 쿠키는 있는데 실제 세션은 만료된 거예요.

비유로 설명하자면 이러해요. **주민등록증(쿠키)은 가지고 있는데, 얼굴 인식(DOM)에서 인정을 안 해주는 상황**이에요.

### 해결 방법

DOM이 아니라 **쿠키를 직접 검사**해야 해요.

```javascript
// 잘못된 방법: DOM 셀렉터로 판단 → 부정확
const isLoggedIn = await page.locator('#publishBtn').isVisible();
if (!isLoggedIn) throw new Error('로그인 필요');

// 올바른 방법: 쿠키 직접 검사
const cookies = await context.cookies();
const nidAut = cookies.find(c => c.name === 'NID_AUT');
const nidSes = cookies.find(c => c.name === 'NID_SES');
if (!nidAut || !nidSes) {
  throw new Error('세션 만료 — 재로그인 필요');
}
```

이렇게 하면 쿠키가 실제로 존재하는지 바로 확인할 수 있어요. DOM 렌더링 상태에 영향받지 않아요.

---

## H2 #3 — SmartEditor One은 일반 HTML이 아니었어

### 제목 영역 요소를 찾을 수 없어요

솔직히 이건 진짜 멘붕이었어요.

글 제목을 자동으로 입력하려고 했어요. 보통 input 요소에 `.fill()`이나 `.type()`하면 되니까요. 그런데 어떤 선택자를 쓰든, 아무 일도 일어나지 않았어요.

```javascript
// 평소처럼 했는데...
await page.locator('#title').fill('블로그 제목');
// 아무 일도 안 일어남
```

솔직히 30분 동안 뭐가 문제인지 몰랐어요. 셀렉터도 맞고, 코드도 틀린 게 없고... 그런데 사실 이게 문제였어요. **SmartEditor One은 일반 HTML이 아니었거든요.**

### 원인

SmartEditor One은 `.contenteditable`이 없는 **가상 렌더링** 구조예요.

일반 웹 에디터는 `<div contenteditable="true">` 같은 구조로 텍스트 입력을 받어요. 그런데 SmartEditor One은 다르게 작동해요. 내부적으로는 Canvas나 iframe 같은 가상 요소를 사용해서 렌더링해요.

그래서 일반적인 input 선택자로는 요소를 찾을 수도, 클릭할 수도 없어요.

### 해결 방법

일반 클릭이 안 먹히니까, **컴포넌트를 클릭한 다음 키보드로 입력**해야 해요.

```javascript
// 잘못된 방법: 일반 fill은 작동 안 함
await page.locator('#title').fill('제목');

// 올바른 방법: 컴포넌트 클릭 후 키보드 입력
const titleComponent = page.locator('.se-component.se-documentTitle');
await titleComponent.click();

// 기존 내용 있으면 지우고 입력
await page.keyboard.press('Meta+a');
await page.keyboard.type('새 블로그 제목', { delay: 50 });
```

### 경험담 — contenteditable이 없길래 click() 했는데 아무 일도 안 일어나서 솔직히 30분 동안 뭐가 문젠지 몰랐어요...

솔직히 말하면... 이거 발견하고 나서 한 동안은 SmartEditor 자체가 싫었어요. 왜 일반 HTML이 아닌 거예요? 라고 생각했거든요. 그런데 이렇게 되면 다른 분들도 같은 경험을 했을 거예요. 저처럼 30분을 헤맨 분이라면, 이 글이 도움이 됐으면 좋겠어요 해요.

---

## H2 #4 — publish 클릭했는데 안 돼요, 2단계였어

### 발행 버튼을 클릭했는데 반영이 안 되더라구요

"취소선" 버그를 고치고 나서,다음에는 발행 버튼 문제를 만나게 됐어요.

코드를 실행해서 발행 버튼을 클릭했어요. 그런데 아무 일도 안 일어났어요. 에러도 없고, 성공 메시지도 없고요. 그냥 ничего.

솔직히 30분 동안 고생을 했어요. 셀렉터 문제인가 싶어서 이것저것 바꿔보고, 대기 시간을 늘려보고... 그런데도 아무 반응이 없었어요.

### 원인

이건 SmartEditor의 **2단계 버튼 구조**를 몰랐기 때문이에요.

"발행" 버튼을 클릭하면, 실제로는 옵션 패널이 열려요. 그리고 그 안에 **별도의 "확인" 버튼**이 있어요. 이 확인 버튼을 또 클릭해야 실제 발행이 돼요.

"발행" 버튼을 클릭하면 뭔가 진행되는 줄 알았는데, 그건 그냥 옵션 패널을 여는 거였어요.

### 해결 방법

```javascript
// 1단계: 발행 버튼 클릭
await page.locator('.publish_btn, [class*="publish"]').click();

// 2단계: 옵션 패널의 확인 버튼 클릭
await page.waitForSelector('.se-popup-container', { timeout: 5000 });

const confirmBtn = page.locator('[class^="confirm_btn__"]').first();
await confirmBtn.click();
```

팝업이 나타날 때까지 기다렸다가, 확인 버튼을 클릭해야 해요. 이걸 모르면 무한히 "발행" 버튼만 클릭하게 돼요.

---

## H2 #5 — waitForTimeout is not a function

### FrameLocator에서 page 메서드 호출했더니 에러...

이건 앞서등장 버그와는 성격이 조금 달랐어요.

Playwright에서 iframe 안의 요소를 조작할 때, `FrameLocator`를 사용해야 해요. 그런데 `FrameLocator` 안에서 page 메서드를 호출했더니 에러가 나왔어요.

```javascript
// 이 코드가 에러를 발생시킴
await frameLocator.locator('button').waitForTimeout(2000);
// 에러: TypeError: frameLocator.locator(...).waitForTimeout is not a function
```

### 원인

`FrameLocator`는 page 객체가 아니에요. 그래서 `page.waitForTimeout()` 같은 메서드가 없어요.

### 해결 방법

```javascript
// Page 메서드 대신 일반 sleep 함수 사용
await new Promise(resolve => setTimeout(resolve, 2000));

// 또는 playwright의 sleep 함수
const { sleep } = require('playwright');
await sleep(2000);
```

대기 시간은 `waitForSelector`와 적절히 섞어서 사용하면 돼요.

---

## H2 #6 — 잠금 파일이 사라지지 않아요

### "다른 게시 작업이 진행 중이라고만 나와요"

이건 에러 메시지를 보면 바로 이해될 것 같은 건데, 사실 원인 찾기가 어려웠어요.

"다른 게시 작업이 진행 중입니다"라는 메시지가 뜨면서, 무한히 대기해야 해요. 처음엔 다른 작업이 실제로 진행 중인 줄 알았어요. 그런데 아무리 기다려도 메시지가 사라지지 않더라고요.

### 원인

**lockfile이 삭제되지 않고 남아있었기 때문이에요.**

원래 코드는 이랬어요.

```javascript
// 잘못된 방법: 빈 파일을 만들 뿐, 파일 자체는 삭제되지 않음
fs.writeFileSync(LOCK_FILE, '');
```

이러면 파일 내용은 비워지지만, **파일 자체는 여전히 존재**해요. 다른 프로세스가 lockfile 존재 여부로 잠금 상태를 판단하기 때문에, 빈 파일이 있어도 "진행 중"으로 인식해요.

### 해결 방법

```javascript
import { unlinkSync, existsSync } from 'fs';

const LOCK_FILE = '/tmp/naver-post.lock';

if (existsSync(LOCK_FILE)) {
  unlinkSync(LOCK_FILE);  // 파일 자체를 삭제
}
```

`writeFileSync('')`가 아니라 **`unlinkSync()`**로 파일 자체를 삭제해야 해요.

---

## H2 #7 — DRY_RUN인데 일일 한도 다 떨어졌어요

### 테스트만 했는데 게시 한도가 다 떨어졌어요

이건 좀 우스운 버그였어요.

자동화 코드를 테스트할 때, 실제 블로그에 게시되지 않게 DRY_RUN 모드를 사용했어요. 그런데 어느 날 갑자기 "일일 게시 한도(3편)를 초과했습니다"라는 에러가 나왔어요.

그런데 오늘 아무것도 게시 안 했는데...?

### 원인

**DRY_RUN 모드에서도 checkDailyLimit 함수가 호출되고 있었기 때문이에요.**

테스트할 때마다 일일 카운트가 올라갔고, 정작 실제 게시를 하려고 하면 한도가 다 떨어진 상태였던 거예요.

### 해결 방법

```javascript
if (process.env.DRY_RUN === 'true') {
  // DRY_RUN이면 카운트 스킵
  console.log('DRY_RUN 모드 — 카운트 스킵');
} else {
  checkDailyLimit();
}
```

DRY_RUN 환경 변수를 체크해서, 테스트 모드일 때는 카운트 로직을 건너뛰면 돼요.

---

## H2 #8 — inline style이 적용이 안 돼요

### 본문에 넣은 스타일이 안 먹혀요

글 본문에 직접 스타일을 입히려 했어요. 예를 들면, 특정 단어를 bold로 만들거나, 색상을 주고 싶었어요.

그런데 아무리 스타일을 넣어도 적용이 안 되더라고요.

### 원인

SmartEditor One은 **서버 측에서 inline style을 필터링**해요. 글의 일관성을 유지하기 위해서，일부 스타일 속성을 제거하는 거예요.

### 해결 방법

inline style 대신 **CSS 클래스**를 사용해야 해요.

```css
/* 대신 CSS 클래스를 정의하고 */
.bold-text {
  font-weight: bold;
}
.red-text {
  color: red;
}
```

```javascript
// SmartEditor에 클래스로
await page.locator('.se-article-content .se-text').evaluate((el, cls) => {
  el.classList.add('bold-text');
}, 'bold-text');
```

클래스 방식으로 하면 SmartEditor가 필터링하지 않아요.

---

## 디버깅 팁 — SmartEditor DOM 이렇게 분석하세요

### 개발자 도구로 직접 셀렉터 확인

가장 기본적인 방법이에요. Playwright의 `page.pause()`를 사용하면 브라우저의 개발자 도구가 열려요.

```javascript
// 일시 정지해서 DOM 검사
await page.pause();
```

그러면 브라우저가 멈추고, Console이나 Elements 패널에서 직접 요소를 확인할 수 있어요.

### 셀렉터 우선순위

요소를 찾을 때는 이 순서를 따르세요:

사실 이우선순위는 저도 자주 헷갈려요. class가편하지만, SmartEditor가 업데이트되면 class가 바뀌는 경우가 있어요. 그래서 가능하면 data 속성이나 ID를 쓰려고 해요. 근데 항상 있는 건 아니잖아요. 그럴 때는노력해서라도 유일한 요소를 찾아야 해요.

예를 들어, 같은 class의 버튼이 여러 개 있으면, `page.locator('.btn').first()`처럼 처음 하나만 찍어야 해요. 이걸 모르고 여러 개를 동시에 클릭하면, 원하지 않는 동작이 발생할 수 있어요.

1. **ID** — `#publishBtn`
2. **data 속성** — `[data-testid="submit"]`
3. **class** — `.confirm-btn`
4. **텍스트** — `button:has-text("확인")`

ID가 가장 확실해요. class는 변경될 가능성이 높고, 텍스트는국제화에 따라 다를 수 있어요.

### 팝업/모달은 항상 .first()로

같은 클래스의 요소가 여러 개 있을 때는 **첫 번째만 클릭**하세요.

```javascript
// 여러 개 중 첫 번째만
const firstPopup = page.locator('.se-popup-container').first();
```

### 대기 시간은 적절히 섞어서

`waitForSelector`로 요소가 나타날 때까지 기다리고, 그 다음은 `sleep()`로 추가 대기를 넣는 식으로 섞으면 돼요.

사실 이부분도 한 번 헷갈렸어요. waitForSelector는 요소가 나타나면 바로 다음으로 넘어가니까, 요소가 보여도 아직 클릭이 불가능한 경우가 있어요. 그럴 때는 sleep()으로 дополнительно 대기 시간을 주면 돼요.

---

## 8가지 함정 한눈에 보기

| 함정 | 증상 | 원인 | 해결 |
|---|---|---|---|
| "취소" vs "취소선" | 취소인데 취소선 적용 | 셀렉터 오버매칭 | popup 스코프 + :not |
| 로그인 오판 | "세션 만료"인데 로그인됨 | DOM 셀렉터 부정확 | 쿠키 직접 검사 |
| waitForTimeout 없음 | 메서드 undefined 에러 | FrameLocator는 page 메서드 없음 | sleep() 함수 사용 |
| 가상 캔버스 | 제목 영역 요소 못 찾음 | contenteditable 없음 | 컴포넌트 클릭+키보드 |
| publish 2단계 | 발행 클릭인데 반영 안 됨 | 확인 버튼 숨겨짐 | confirm_btn__ prefix |
| lockfile 미삭제 | "다른 게시 작업 진행 중" | writeFileSync('')? 파일 존재 | unlinkSync()로 삭제 |
| DRY_RUN 카운터 누적 | 테스트인데 한도 소진 | checkDailyLimit 항상 호출 | DRY_RUN이면 skip |
| inline style 무시 | 본문 스타일 적용 안 됨 | SmartEditor가 스타일 필터링 | CSS 클래스 사용 |

---

## 마무리 — 정리하면

여기까지가 8가지 함정이었어요.

솔직히 말하면... 이 모든 걸 한 번에 다 알기는 어려웠어요. 하나씩 부딪히면서 배우는 게 정상이에요.

그런데 사실 이 모든 걸 한 번에 다 알기보다는, **문제가 생겼을 때 어디서부터 찾아봐야 하는지** 아는 게 더 중요해요.

예를 들면, 버튼이 안 눌리면 "스코프를 한정했는가" 확인하고, 로그인이 안 되면 "쿠키를 직접 검사했는가" 확인하고... 이런 식으로 점검목록이 있으면 디버깅 시간이 크게 줄어들어요.

이 글이 도움이 되셨다면, 같이 검증 습관 들여요. 디버깅하다 막히면 댓글이나 텔레그램으로 편하게 물어보세요. 같이 찾아봐요 💪

> 💡 다음 글: Quartz로 만든 블로그를 GitHub Pages에 배포했더니 CSS가 깨져요. baseUrl 설정 하나로 대부분 해결되는 문제 — 같이 보시면 좋습니다.
