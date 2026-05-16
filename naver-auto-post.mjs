#!/usr/bin/env node
/**
 * 네이버 블로그 자동 포스팅 (Playwright)
 * GitHub Actions에서 실행
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';

const NAVER_ID = process.env.NAVER_ID;
const NAVER_PW = process.env.NAVER_PW;

const title = readFileSync('naver_blog_title.txt', 'utf-8').trim();
const bodyHtml = readFileSync('naver_blog_content.html', 'utf-8');
const bodyText = bodyHtml
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n\n')
  .replace(/<\/h[1-6]>/gi, '\n\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .trim();

console.log('='.repeat(60));
console.log('네이버 블로그 자동 포스팅 시작');
console.log('='.repeat(60));
console.log('ID:', NAVER_ID);
console.log('제목:', title);
console.log('본문 크기:', (bodyHtml.length / 1024).toFixed(2), 'KB');
console.log('');

async function clickFirstVisible(page, selectors, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.count().catch(() => 0)) {
        try {
          await locator.waitFor({ state: 'visible', timeout: 1000 });
          await locator.click({ timeout: 3000 });
          console.log(`✓ ${label}: ${selector}`);
          return locator;
        } catch {
          // Try the next selector.
        }
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`${label} 요소를 찾을 수 없음`);
}

async function setEditableText(locator, value) {
  await locator.evaluate((el, text) => {
    el.focus();
    if ('value' in el) {
      el.value = text;
    } else {
      el.innerText = text;
      el.textContent = text;
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function saveDebug(page, label) {
  mkdirSync('naver-debug', { recursive: true });
  await page.screenshot({ path: `naver-debug/${label}.png`, fullPage: true }).catch(() => {});
  await page.locator('body').evaluate((body) => body.innerText).then((text) => {
    console.log('=== 현재 화면 텍스트 일부 ===');
    console.log(text.slice(0, 1200));
  }).catch(() => {});
}

async function postToNaver() {
  console.log('Chromium 시작...');
  
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    console.log('1. 네이버 블로그 접속...');
    await page.goto('https://blog.naver.com/PostWriteForm.naver', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('2. 로그인 페이지 확인...');
    const currentUrl = page.url();
    console.log('현재 URL:', currentUrl);
    
    // 로그인 필요 시
    if (currentUrl.includes('login') || currentUrl.includes('nidlogin')) {
      console.log('3. 로그인 시도...');
      
      // 아이디 입력
      await page.waitForSelector('#id', { timeout: 10000 });
      await page.fill('#id', NAVER_ID);
      
      // 비밀번호 입력
      await page.waitForSelector('#pw', { timeout: 10000 });
      await page.fill('#pw', NAVER_PW);
      
      // 로그인 버튼 클릭
      await page.click('#log.login');
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
      
      console.log('✓ 로그인 완료');
    }
    
    console.log('4. 글쓰기 페이지 이동...');
    await page.goto('https://blog.naver.com/PostWriteForm.naver', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(3000);
    await saveDebug(page, 'post-write-loaded');
    
    // 제목 입력
    console.log('5. 제목 입력...');
    const titleInput = await clickFirstVisible(page, [
      '#title',
      'textarea[placeholder*="제목"]',
      'input[placeholder*="제목"]',
      '.se-title-text [contenteditable="true"]',
      '[class*="se-title"] [contenteditable="true"]',
      '[contenteditable="true"][data-placeholder*="제목"]',
      '[contenteditable="true"]:near(:text("제목"))'
    ], '제목 입력 영역');
    await setEditableText(titleInput, title);
    console.log('✓ 제목 입력 완료');
    
    console.log('6. 본문 입력...');
    const bodyInput = await clickFirstVisible(page, [
      '.se-section-text [contenteditable="true"]',
      '.se-component-content [contenteditable="true"]',
      '[class*="se-section"] [contenteditable="true"]',
      '[contenteditable="true"][data-placeholder*="내용"]',
      '[contenteditable="true"]'
    ], '본문 입력 영역');
    await setEditableText(bodyInput, bodyText);
    console.log('✓ 본문 입력 완료');
    
    // 잠시 대기
    await new Promise(r => setTimeout(r, 2000));
    
    // 발행 버튼 클릭
    console.log('7. 발행 버튼 클릭...');
    
    await clickFirstVisible(page, [
      '#btnPublish',
      'button:has-text("발행")',
      'a:has-text("발행")',
      '.btn_publish',
      '.btn_primary',
      'a[onclick*="publish"]'
    ], '발행 버튼');

    await page.waitForTimeout(1500);
    const confirmPublish = page.locator('button:has-text("발행"), a:has-text("발행"), button:has-text("확인")').last();
    if (await confirmPublish.count().catch(() => 0)) {
      await confirmPublish.click({ timeout: 5000 }).catch(() => {});
    }
    console.log('✓ 발행 완료!');
    
    // 결과 대기
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ 자동 포스팅 완료!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    await saveDebug(page, 'error');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

// 실행
postToNaver();
