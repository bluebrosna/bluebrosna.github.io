#!/usr/bin/env node
/**
 * 네이버 영구 프로필 셋업 (최초 1회 실행)
 *
 * 실행 방식:
 *   node scripts/setup-naver-profile.mjs
 *
 * 동작:
 *   1. Chromium 창을 띄움 (headless: false)
 *   2. 네이버 로그인 페이지로 이동
 *   3. 사용자가 직접 로그인 + 2FA + "이 기기 신뢰" 체크
 *   4. 사용자가 터미널에서 Enter 누르면 종료
 *   5. 프로필이 PROFILE_DIR 에 저장되어 이후 자동화에서 재사용
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import readline from 'readline';

const PROFILE_DIR = process.env.NAVER_PROFILE_DIR
  || join(homedir(), '.openclaw', 'playwright', 'naver-profile');

mkdirSync(PROFILE_DIR, { recursive: true });

console.log(`📁 프로필 디렉터리: ${PROFILE_DIR}`);
console.log('🌐 Chromium을 띄웁니다. 창에서 네이버에 직접 로그인하세요.');
console.log('   - 2FA가 뜨면 완료해주세요');
console.log('   - "이 기기를 신뢰" 옵션이 보이면 반드시 체크하세요');
console.log('   - 로그인 완료 후 글쓰기 페이지까지 한 번 들어가보세요');
console.log('   - 끝나면 이 터미널로 돌아와 Enter를 누르세요\n');

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
});

const page = context.pages()[0] || await context.newPage();
await page.goto('https://nid.naver.com/nidlogin.login');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await new Promise((resolve) => rl.question('\n✅ 로그인 끝났으면 Enter: ', resolve));
rl.close();

await context.close();
console.log('\n💾 프로필이 저장되었습니다. 이제 naver-post-local.mjs를 사용할 수 있습니다.');
