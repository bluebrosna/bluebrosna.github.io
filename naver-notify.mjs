#!/usr/bin/env node
/**
 * GitHub Actions에서 호출: 새 글이 준비됐다고 Telegram으로 알림
 *
 * 환경변수:
 *   TELEGRAM_BOT_TOKEN  : 알림 봇 토큰
 *   TELEGRAM_CHAT_ID    : 받을 채팅 ID
 *   GH_RUN_ID           : GitHub Actions run ID (artifact 다운로드용)
 *   GH_REPO             : owner/repo
 *   POST_TITLE          : 게시 예정 제목
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const runId = process.env.GH_RUN_ID;
const repo = process.env.GH_REPO;
const title = process.env.POST_TITLE || '(제목 없음)';

if (!token || !chatId) {
  console.log('Telegram 미설정 — 알림 건너뜀');
  process.exit(0);
}

const artifactUrl = `https://github.com/${repo}/actions/runs/${runId}`;
const cmd = `gh run download ${runId} -n naver-blog-payload -R ${repo} && node naver-post-local.mjs`;

const text =
  `📥 <b>네이버 블로그 게시 준비 완료</b>\n` +
  `제목: <b>${title}</b>\n` +
  `Artifact: <a href="${artifactUrl}">${runId}</a>\n\n` +
  `Mac에서 실행:\n<code>${cmd}</code>`;

const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
});

if (!res.ok) {
  console.error('Telegram 전송 실패:', await res.text());
  process.exit(1);
}
console.log('✅ Telegram 알림 전송 완료');
