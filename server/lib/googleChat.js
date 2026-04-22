import { APP_BASE_URL } from './config.js';

function normalizeText(value, fallback = '') {
  const trimmed = `${value || ''}`.trim();
  return trimmed || fallback;
}

export function buildDevRequestDetailUrl(requestId) {
  const cleanRequestId = normalizeText(requestId);
  if (!cleanRequestId) return null;

  const url = new URL(APP_BASE_URL);
  url.searchParams.set('item', cleanRequestId);
  url.searchParams.set('fullscreen', '1');
  return url.toString();
}

export function buildDevRequestChatMessage({ request, creatorName }) {
  const title = normalizeText(request?.title, '제목 없음');
  const requestTeam = normalizeText(request?.request_team, '요청팀 미지정');
  const status = normalizeText(request?.status, '접수됨');
  const priority = normalizeText(request?.priority, '중간');
  const author = normalizeText(creatorName, '알 수 없음');
  const detailUrl = buildDevRequestDetailUrl(request?.id);
  const description = normalizeText(request?.description);

  const lines = [
    '개발팀 요청이 제출되었습니다.',
    '',
    `제목: ${title}`,
    `요청팀: ${requestTeam}`,
    `상태: ${status}`,
    `우선순위: ${priority}`,
    `작성자: ${author}`,
  ];

  if (description) {
    lines.push('', `요청 내용: ${description}`);
  }

  if (detailUrl) {
    lines.push('', `상세 링크: ${detailUrl}`);
  }

  return lines.join('\n');
}

export async function postGoogleChatWebhookMessage(webhookUrl, messageText) {
  const cleanWebhookUrl = normalizeText(webhookUrl);
  if (!cleanWebhookUrl) {
    return { skipped: true, reason: 'webhook-not-configured' };
  }

  const response = await fetch(cleanWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ text: messageText }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    const error = new Error(
      `Google Chat webhook request failed (${response.status})${responseText ? `: ${responseText}` : ''}`
    );
    error.status = response.status;
    error.responseText = responseText;
    throw error;
  }

  return { skipped: false };
}
