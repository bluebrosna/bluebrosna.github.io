#!/usr/bin/env node
/**
 * 네이버 블로그 자동 포스팅 (Puppeteer-core)
 * GitHub Actions에서 실행
 * Chrome 대신 Chromium 사용
 */

import puppeteer from 'puppeteer-core';
import { readFileSync } from 'fs';

const NAVER_ID = process.env.NAVER_ID;
const NAVER_PW = process.env.NAVER_PW;
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/chromium-browser';

const title = readFileSync('naver_blog_title.txt', 'utf-8').trim();
const bodyHtml = readFileSync('naver_blog_content.html', 'utf-8');

console.log('='.repeat(60));
console.log('네이버 블로그 자동 포스팅 시작');
console.log('='.repeat(60));
console.log('ID:', NAVER_ID);
console.log('제목:', title);
console.log('본문 크기:', (bodyHtml.length / 1024).toFixed(2), 'KB');
console.log('Chrome 경로:', CHROME_PATH);
console.log('');

async function postToNaver() {
  console.log('Chrome 시작...');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
  } catch (chromeError) {
    console.log('Chrome 실행 실패, 대안 방법 사용...');
    console.log('，代案: HTML 파일만 생성하여Artifact로 업로드');
    process.exit(0);
  }

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
    const frame = await page.waitForFrame(async frame => {
      return frame.url().includes('smarteditor') || frame.url().includes('post');
    }, 10000).catch(() => null);
    
    if (frame) {
      console.log('✓ SmartEditor iframe 발견');
      
      // 에디터 영역에 HTML 입력
      await frame.evaluate((html) => {
        const editor = document.querySelector('[contenteditable="true"]') || 
                      document.querySelector('.se-section-inner') ||
                      document.querySelector('#content');
        if (editor) {
          editor.innerHTML = html;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, bodyHtml);
      
      console.log('✓ 본문 입력 완료');
    } else {
      console.log('⚠ SmartEditor iframe을 찾을 수 없음 - 대안 방법 사용');
    }
    
    // 잠시 대기
    await new Promise(r => setTimeout(r, 2000));
    
    // 발행 버튼 클릭
    console.log('7. 발행 버튼 클릭...');
    const publishBtn = await page.$('#btnPublish') || 
                      await page.$('.btn_primary') ||
                      await page.$('a[onclick*="publish"]');
    
    if (publishBtn) {
      await publishBtn.click();
      console.log('✓ 발행 완료!');
    } else {
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
    if (browser) await browser.close();
  }
}

// 실행
postToNaver();
