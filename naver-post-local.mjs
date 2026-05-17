#!/usr/bin/env node
/**
 * 네이버 블로그 자동 게시 (로컬 Mac 전용)
 *
 * 전제:
 *   - scripts/setup-naver-profile.mjs 를 최초 1회 실행하여 영구 프로필 생성됨
 *   - 같은 디렉터리에 naver_blog_title.txt, naver_blog_content.html 존재
 *
 * 실행:
 *   node naver-post-local.mjs
 *
 * 환경변수 (선택):
 *   NAVER_PROFILE_DIR      : 영구 프로필 경로 (기본: ~/.openclaw/playwright/naver-profile)
 *   TELEGRAM_BOT_TOKEN     : 결과 보고할 봇 토큰 (없으면 콘솔만)
 *   TELEGRAM_CHAT_ID       : 보고 채팅 ID
 *   MAX_POSTS_PER_DAY      : 일일 최대 게시 (기본 3, 계정 정지 방지)
 *   DRY_RUN=1              : 실제 발행 버튼은 누르지 않음 (테스트용)
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ───── 설정 ─────────────────────────────────────────
const PROFILE_DIR = process.env.NAVER_PROFILE_DIR
  || join(homedir(), '.openclaw', 'playwright', 'naver-profile');
const LOCK_FILE = '/tmp/naver-post.lock';
const COUNTER_FILE = join(homedir(), '.openclaw', 'naver-daily-counter.json');
const DEBUG_DIR = './naver-debug';
const MAX_POSTS_PER_DAY = Number(process.env.MAX_POSTS_PER_DAY || 3);
const DRY_RUN = process.env.DRY_RUN === '1';

// ───── 유틸 ─────────────────────────────────────────
mkdirSync(DEBUG_DIR, { recursive: true });
mkdirSync(join(homedir(), '.openclaw'), { recursive: true });

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    const age = Date.now() - statSync(LOCK_FILE).mtimeMs;
    if (age < 10 * 60 * 1000) {
      throw new Error(`다른 게시 작업이 진행 중 (lock age ${Math.round(age / 1000)}s)`);
    }
    log('⚠️ 오래된 lockfile 제거');
  }
  writeFileSync(LOCK_FILE, String(process.pid));
}

function releaseLock() {
  try { writeFileSync(LOCK_FILE, ''); } catch {}
}

function checkDailyLimit() {
  const today = new Date().toISOString().slice(0, 10);
  let data = { date: today, count: 0 };
  if (existsSync(COUNTER_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(COUNTER_FILE, 'utf-8'));
      if (parsed.date === today) data = parsed;
    } catch {}
  }
  if (data.count >= MAX_POSTS_PER_DAY) {
    throw new Error(`일일 게시 한도 초과 (${data.count}/${MAX_POSTS_PER_DAY})`);
  }
  return () => {
    data.count += 1;
    writeFileSync(COUNTER_FILE, JSON.stringify(data));
  };
}

async function telegramNotify(text, photoPath) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    if (photoPath && existsSync(photoPath)) {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('caption', text.slice(0, 1024));
      form.append('photo', new Blob([readFileSync(photoPath)]), 'screenshot.png');
      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
    } else {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
    }
  } catch (e) {
    log(`Telegram 알림 실패: ${e.message}`);
  }
}

async function findFirst(page, selectors, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      try {
        const loc = page.locator(sel).first();
        if (await loc.count() && await loc.isVisible().catch(() => false)) {
          return loc;
        }
      } catch {}
    }
    await page.waitForTimeout(400);
  }
  throw new Error(`${label} 요소를 찾을 수 없음 (timeout ${timeout}ms)`);
}

// ───── 메인 ─────────────────────────────────────────
async function main() {
  if (!existsSync(PROFILE_DIR) || !existsSync(join(PROFILE_DIR, 'Default'))) {
    throw new Error(
      `프로필이 없습니다: ${PROFILE_DIR}\n` +
      `먼저 'node scripts/setup-naver-profile.mjs' 를 실행하세요.`
    );
  }

  const title = readFileSync('naver_blog_title.txt', 'utf-8').trim();
  const bodyHtml = readFileSync('naver_blog_content.html', 'utf-8');
  log(`📝 제목: ${title}`);
  log(`📦 본문 크기: ${bodyHtml.length} bytes`);

  acquireLock();
  const incrementCounter = checkDailyLimit();

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,            // 헤드리스는 봇 탐지에 더 잘 걸림. 화면 켜진 채로 실행.
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    // 1) 로그인 상태 확인
    await page.goto('https://blog.naver.com/bluebrosna', { waitUntil: 'domcontentloaded' });
    const loggedIn = await page.locator('a:has-text("내 블로그"), .area_user').count();
    if (!loggedIn) {
      throw new Error('로그인 세션 만료 — setup-naver-profile.mjs 를 다시 실행하세요');
    }
    log('✅ 로그인 세션 유효');

    // 2) 글쓰기 페이지로 이동
    await page.goto('https://blog.naver.com/bluebrosna/postwrite', {
      waitUntil: 'networkidle', timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // SmartEditor One은 iframe 안에 있음
    const editorFrame = page.frameLocator('iframe#mainFrame, iframe[name="mainFrame"]').first();

    // 3) "이어서 작성하시겠어요?" 팝업이 뜨면 "취소"
    try {
      const cancelBtn = editorFrame.locator('button:has-text("취소"), .se-popup-button-cancel').first();
      if (await cancelBtn.isVisible({ timeout: 3000 })) {
        await cancelBtn.click();
        log('🧹 이전 임시저장 팝업 취소');
      }
    } catch {}

    // 4) 제목 입력
    const titleEl = await findFirst(editorFrame, [
      '.se-title-text [contenteditable="true"]',
      '.se-section-documentTitle [contenteditable="true"]',
      'textarea[placeholder*="제목"]',
    ], '제목 영역');
    await titleEl.click();
    await page.keyboard.type(title, { delay: 30 });
    log('✍️ 제목 입력 완료');

    // 5) 본문 입력 (HTML을 클립보드로 붙여넣기)
    const bodyEl = await findFirst(editorFrame, [
      '.se-section-text [contenteditable="true"]',
      '.se-component-content [contenteditable="true"]',
      '[contenteditable="true"][data-placeholder]',
    ], '본문 영역');
    await bodyEl.click();
    await page.waitForTimeout(500);

    // 클립보드에 HTML 넣고 paste
    await page.evaluate((html) => {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([html.replace(/<[^>]+>/g, '')], { type: 'text/plain' }),
      });
      return navigator.clipboard.write([item]);
    }, bodyHtml).catch(async () => {
      // 클립보드 권한 없을 때 fallback: 일반 typing
      log('⚠️ 클립보드 API 실패, type fallback');
      await bodyEl.fill(bodyHtml.replace(/<[^>]+>/g, ''));
    });
    await page.keyboard.press('Meta+V').catch(() => page.keyboard.press('Control+V'));
    await page.waitForTimeout(1500);
    log('📋 본문 붙여넣기 완료');

    // 6) 발행 (DRY_RUN이면 임시저장만)
    if (DRY_RUN) {
      log('🧪 DRY_RUN — 발행 안 함, 임시저장만');
      await page.keyboard.press('Meta+S').catch(() => page.keyboard.press('Control+S'));
      await page.waitForTimeout(2000);
    } else {
      const publishBtn = await findFirst(editorFrame, [
        'button.publish_btn__m9KHH',
        'button:has-text("발행")',
        '.se-publish-button',
      ], '발행 버튼');
      await publishBtn.click();
      await page.waitForTimeout(2000);

      // 최종 발행 확인 버튼
      const confirmBtn = await findFirst(editorFrame, [
        'button.confirm_btn__WEaBq',
        'button:has-text("발행"):not(:has-text("예약"))',
      ], '최종 발행 확인', 8000);
      await confirmBtn.click();
      log('🚀 발행 클릭');
    }

    // 7) 완료 대기 + URL 캡처
    await page.waitForURL(/PostView|blog\.naver\.com/, { timeout: 30000 }).catch(() => {});
    const finalUrl = page.url();
    log(`✅ 완료: ${finalUrl}`);

    incrementCounter();
    await telegramNotify(`✅ 네이버 게시 성공\n<b>${title}</b>\n${finalUrl}`);
    return finalUrl;

  } catch (err) {
    log(`❌ 실패: ${err.message}`);
    const shot = join(DEBUG_DIR, `fail-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    await telegramNotify(
      `❌ 네이버 게시 실패\n<b>${title}</b>\n<code>${err.message}</code>\n` +
      `직접 처리가 필요합니다.`,
      shot,
    );
    throw err;
  } finally {
    releaseLock();
    await context.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
