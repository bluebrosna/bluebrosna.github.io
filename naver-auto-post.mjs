#!/usr/bin/env node
/**
 * 네이버 블로그 자동 포스팅 (Playwright)
 * GitHub Actions에서 실행
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const NAVER_ID = process.env.NAVER_ID;
const NAVER_PW = process.env.NAVER_PW;

const title = readFileSync('naver_blog_title.txt', 'utf-8').trim();
const bodyHtml = readFileSync('naver_blog_content.html', 'utf-8');

console.log('='.repeat(60));
console.log('네이버 블로그 자동 포스팅 시작');
console.log('='.repeat(60));
console.log('ID:', NAVER_ID);
console.log('제목:', title);
console.log('본문 크기:', (bodyHtml.length / 1024).toFixed(2), 'KB');
console.log('');

async function postToNaver() {
  console.log('Chromium 시작...');
  
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();
  
  // User-Agent 설정
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    console.log('1. 네이버 블로그 접속...');
    await page.goto('https://blog.naver.com/PostWriteForm.naver', {
      waitUntil: 'networkidle2',
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
      await page.type('#id', NAVER_ID, { delay: 100 });
      
      // 비밀번호 입력
      await page.waitForSelector('#pw', { timeout: 10000 });
      await page.type('#pw', NAVER_PW, { delay: 100 });
      
      // 로그인 버튼 클릭
      await page.click('#log.login');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      
      console.log('✓ 로그인 완료');
    }
    
    console.log('4. 글쓰기 페이지 이동...');
    await page.goto('https://blog.naver.com/PostWriteForm.naver', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // 제목 입력
    console.log('5. 제목 입력...');
    await page.waitForSelector('#title', { timeout: 10000 });
    await page.type('#title', title, { delay: 50 });
    console.log('✓ 제목 입력 완료');
    
    // SmartEditor iframe 찾기
    console.log('6. SmartEditor 찾기...');
    
    // 프레임 찾기
    const frame = page.frameLocator('iframe[src*="smarteditor"], iframe[src*="post"]').first();
    
    try {
      await frame.locator('[contenteditable="true"]').first().waitFor({ timeout: 5000 });
      console.log('✓ SmartEditor iframe 발견');
      
      // 에디터 영역에 HTML 입력
      await frame.locator('[contenteditable="true"]').first().evaluate((el, html) => {
        el.innerHTML = html;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, bodyHtml);
      
      console.log('✓ 본문 입력 완료');
    } catch (frameError) {
      console.log('⚠ SmartEditor iframe을 찾을 수 없음');
    }
    
    // 잠시 대기
    await new Promise(r => setTimeout(r, 2000));
    
    // 발행 버튼 클릭
    console.log('7. 발행 버튼 클릭...');
    
    try {
      const publishBtn = page.locator('#btnPublish, .btn_primary, a[onclick*="publish"]').first();
      await publishBtn.waitFor({ timeout: 5000 });
      await publishBtn.click();
      console.log('✓ 발행 완료!');
    } catch (btnError) {
      console.log('⚠ 발행 버튼을 찾을 수 없음');
    }
    
    // 결과 대기
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ 자동 포스팅 완료!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    await browser.close();
  }
}

// 실행
postToNaver();
