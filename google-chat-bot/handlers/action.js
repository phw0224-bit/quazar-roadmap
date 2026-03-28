import {
  createItem,
  updateItemStatus,
  findItemByTitle,
  getSections,
  getColumns,
} from '../lib/supabase.js';
import { generateIssueContent } from '../lib/ollama.js';

const STATUS_MAP = {
  '완료': 'done',
  '진행': 'in-progress',
  '진행중': 'in-progress',
  '진행 중': 'in-progress',
  '시작': 'in-progress',
  '미지정': 'none',
  '취소': 'none',
};

/**
 * 액션 메시지 처리 (생성/수정)
 * @param {string} message
 * @returns {Promise<string>}
 */
export async function handleAction(message) {
  const msg = message.replace(/@\S+/g, '').trim();

  // ─── 상태 변경: "JWT 이슈 완료로 바꿔줘" ────────────────────────
  const statusChangeMatch = msg.match(/(.+?)\s+(.+?)로\s*바꿔/);
  if (statusChangeMatch) {
    const [, itemKeyword, statusKeyword] = statusChangeMatch;
    return await changeItemStatus(itemKeyword.trim(), statusKeyword.trim());
  }

  // ─── 이슈 생성: "이슈 만들어줘: 설명" ───────────────────────────
  const createMatch = msg.match(/이슈\s*(만들어|생성|추가).*?[:：]\s*(.+)/);
  if (createMatch) {
    const description = createMatch[2].trim();
    return await createIssueWithAI(description);
  }

  return null; // 액션 아님 → query 핸들러로 넘김
}

// ─── 상태 변경 ────────────────────────────────────────────────────

async function changeItemStatus(itemKeyword, statusKeyword) {
  // 상태 키워드 → DB 값 변환
  const newStatus = STATUS_MAP[statusKeyword];
  if (!newStatus) {
    return `'${statusKeyword}'은(는) 올바른 상태가 아닙니다.\n사용 가능: 완료, 진행중, 미지정`;
  }

  // 이슈 검색
  const items = await findItemByTitle(itemKeyword);

  if (items.length === 0) {
    return `'${itemKeyword}' 관련 이슈를 찾을 수 없습니다.`;
  }

  // 여러 개 검색된 경우 → 가장 유사한 것 사용
  if (items.length > 1) {
    const listText = items
      .map((item, i) => `${i + 1}. ${item.title}`)
      .join('\n');
    return `여러 이슈가 검색됐습니다. 더 정확한 제목을 입력해주세요:\n${listText}`;
  }

  const item = items[0];
  await updateItemStatus(item.id, newStatus);

  const statusLabel = {
    'done': '✅ 완료',
    'in-progress': '🔵 진행 중',
    'none': '⬜ 미지정',
  }[newStatus];

  return `*"${item.title}"*\n상태가 *${statusLabel}*으로 변경됐습니다.`;
}

// ─── 이슈 생성 ────────────────────────────────────────────────────

async function createIssueWithAI(description) {
  // 1. 보드/컬럼 선택 안내 (기본: 첫 번째 섹션의 첫 번째 컬럼)
  const sections = await getSections();

  if (sections.length === 0) {
    return '보드가 없습니다. 먼저 Roadmap에서 보드를 생성해주세요.';
  }

  // 기본 섹션/컬럼 사용 (나중에 대화형으로 선택하게 확장 가능)
  const defaultSection = sections[0];
  const columns = await getColumns(defaultSection.id);

  if (columns.length === 0) {
    return `'${defaultSection.title}' 보드에 컬럼이 없습니다.`;
  }

  const defaultColumn = columns[0];

  // 2. AI로 이슈 내용 생성
  const generated = await generateIssueContent(description);

  // 3. Supabase에 저장
  const item = await createItem({
    columnId: defaultColumn.id,
    title: generated.title,
    content: generated.content,
    status: 'none',
    tags: generated.tags || [],
  });

  return `✅ *이슈가 생성됐습니다!*

*제목:* ${item.title}
*보드:* ${defaultSection.title} > ${defaultColumn.title}
*태그:* ${item.tags?.join(', ') || '없음'}
*상태:* ⬜ 미지정

Roadmap에서 담당자와 세부 내용을 확인하세요.`;
}
