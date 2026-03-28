import {
  getBoardData,
  getItemsByStatus,
  getItemsByMember,
  searchItems,
  getSections,
} from '../lib/supabase.js';
import { askOllama, SYSTEM_PROMPT } from '../lib/ollama.js';

const STATUS_LABEL = {
  'none': '⬜ 미지정',
  'in-progress': '🔵 진행 중',
  'done': '✅ 완료',
};

/**
 * 사용자 메시지를 분석해서 적절한 핸들러로 라우팅
 * @param {string} message - 구글챗 메시지 텍스트
 * @returns {Promise<string>} - 응답 텍스트
 */
export async function handleQuery(message) {
  const msg = message.replace(/@\S+/g, '').trim(); // @멘션 제거

  // ─── 키워드 기반 라우팅 ────────────────────────────────────────

  // 도움말
  if (/도움말|help|뭐 할 수 있|기능/i.test(msg)) {
    return getHelpMessage();
  }

  // 전체 현황 / 대시보드
  if (/전체|현황|대시보드|overview/i.test(msg)) {
    return await getDashboard();
  }

  // 진행 중인 작업
  if (/진행|in.?progress|하는 중|하고 있/i.test(msg)) {
    return await getInProgressItems(msg);
  }

  // 완료된 작업
  if (/완료|done|끝난|마친/i.test(msg)) {
    return await getDoneItems(msg);
  }

  // 이번 주 / 오늘
  if (/이번\s*주|이번주|오늘|today|this week/i.test(msg)) {
    return await getThisWeekItems(msg);
  }

  // 담당자 검색 - "홍길동 작업", "홍길동 이슈"
  const memberMatch = msg.match(/(.{2,5})\s*(작업|이슈|할 일|담당)/);
  if (memberMatch) {
    return await getMemberItems(memberMatch[1]);
  }

  // 보드 목록
  if (/보드|섹션|팀 목록|어떤 팀/i.test(msg)) {
    return await getBoardList();
  }

  // 검색 - "~~ 찾아줘", "~~ 검색"
  const searchMatch = msg.match(/(.+?)\s*(찾아|검색|관련)/);
  if (searchMatch) {
    return await getSearchResult(searchMatch[1].trim());
  }

  // 위 조건에 해당 없으면 → LLM이 전체 데이터 보고 자유 응답
  return await askWithFullData(msg);
}

// ─── 응답 함수들 ───────────────────────────────────────────────────

function getHelpMessage() {
  return `👋 *Roadmap 봇* 사용법

*조회*
• \`전체 현황 알려줘\` - 보드 전체 요약
• \`진행 중인 작업\` - 현재 진행 중인 이슈 전체
• \`이번주 작업\` - 진행 중 + 미지정 작업
• \`홍길동 작업\` - 특정 담당자 작업 조회
• \`로그인 찾아줘\` - 키워드 검색
• \`보드 목록\` - 팀/섹션 목록

*생성/수정*
• \`이슈 만들어줘: [설명]\` - 이슈 자동 생성
• \`[이슈명] 완료로 바꿔줘\` - 상태 변경
• \`[이슈명] 진행중으로 바꿔줘\` - 상태 변경`;
}

async function getDashboard() {
  const boards = await getBoardData();
  const lines = ['📊 *전체 보드 현황*\n'];

  for (const section of boards) {
    const totalItems = section.columns.reduce((sum, col) => sum + col.items.length, 0);
    const doneItems = section.columns.reduce(
      (sum, col) => sum + col.items.filter(i => i.status === 'done').length, 0
    );
    const inProgressItems = section.columns.reduce(
      (sum, col) => sum + col.items.filter(i => i.status === 'in-progress').length, 0
    );

    lines.push(`*${section.title}*`);
    lines.push(`  전체 ${totalItems}개 | 🔵 진행 중 ${inProgressItems}개 | ✅ 완료 ${doneItems}개\n`);
  }

  return lines.join('\n');
}

async function getInProgressItems(msg) {
  const items = await getItemsByStatus('in-progress');

  if (items.length === 0) return '현재 진행 중인 작업이 없습니다.';

  const lines = [`🔵 *진행 중인 작업 (${items.length}개)*\n`];

  items.forEach((item, i) => {
    const assignees = item.assignees?.length ? item.assignees.join(', ') : '담당자 없음';
    const column = item.projects?.title || '미지정';
    lines.push(`${i + 1}. *${item.title}*`);
    lines.push(`   📁 ${column} | 👤 ${assignees}`);
  });

  return lines.join('\n');
}

async function getDoneItems(msg) {
  const items = await getItemsByStatus('done');

  if (items.length === 0) return '완료된 작업이 없습니다.';

  const lines = [`✅ *완료된 작업 (${items.length}개)*\n`];

  items.slice(0, 15).forEach((item, i) => {
    const assignees = item.assignees?.length ? item.assignees.join(', ') : '-';
    const column = item.projects?.title || '미지정';
    lines.push(`${i + 1}. ${item.title}`);
    lines.push(`   📁 ${column} | 👤 ${assignees}`);
  });

  if (items.length > 15) {
    lines.push(`\n... 외 ${items.length - 15}개`);
  }

  return lines.join('\n');
}

async function getThisWeekItems(msg) {
  // 진행 중 + 미지정 아이템 = "이번 주 할 것들"
  const [inProgress, notStarted] = await Promise.all([
    getItemsByStatus('in-progress'),
    getItemsByStatus('none'),
  ]);

  const lines = [`📅 *이번 주 작업 현황*\n`];

  if (inProgress.length > 0) {
    lines.push(`*🔵 진행 중 (${inProgress.length}개)*`);
    inProgress.forEach((item, i) => {
      const assignees = item.assignees?.length ? item.assignees.join(', ') : '-';
      lines.push(`${i + 1}. ${item.title} | 👤 ${assignees}`);
    });
    lines.push('');
  }

  if (notStarted.length > 0) {
    lines.push(`*⬜ 시작 전 (${notStarted.length}개)*`);
    notStarted.slice(0, 10).forEach((item, i) => {
      const assignees = item.assignees?.length ? item.assignees.join(', ') : '-';
      lines.push(`${i + 1}. ${item.title} | 👤 ${assignees}`);
    });
    if (notStarted.length > 10) {
      lines.push(`... 외 ${notStarted.length - 10}개`);
    }
  }

  if (inProgress.length === 0 && notStarted.length === 0) {
    return '이번 주 등록된 작업이 없습니다.';
  }

  return lines.join('\n');
}

async function getMemberItems(memberName) {
  const items = await getItemsByMember(memberName);

  if (items.length === 0) {
    return `'${memberName}' 담당 작업을 찾을 수 없습니다.\n이름을 정확하게 입력해주세요.`;
  }

  const lines = [`👤 *${memberName} 담당 작업 (${items.length}개)*\n`];

  const grouped = {
    'in-progress': items.filter(i => i.status === 'in-progress'),
    'none': items.filter(i => i.status === 'none'),
    'done': items.filter(i => i.status === 'done'),
  };

  for (const [status, statusItems] of Object.entries(grouped)) {
    if (statusItems.length === 0) continue;
    lines.push(`*${STATUS_LABEL[status]}*`);
    statusItems.forEach(item => {
      const column = item.projects?.title || '미지정';
      lines.push(`  • ${item.title} (${column})`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

async function getBoardList() {
  const sections = await getSections();

  if (sections.length === 0) return '등록된 보드가 없습니다.';

  const lines = ['📋 *보드(섹션) 목록*\n'];
  sections.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.title}`);
  });

  return lines.join('\n');
}

async function getSearchResult(keyword) {
  const items = await searchItems(keyword);

  if (items.length === 0) return `'${keyword}' 관련 이슈를 찾을 수 없습니다.`;

  const lines = [`🔍 *'${keyword}' 검색 결과 (${items.length}개)*\n`];

  items.slice(0, 10).forEach((item, i) => {
    const status = STATUS_LABEL[item.status] || '⬜ 미지정';
    const assignees = item.assignees?.length ? item.assignees.join(', ') : '-';
    const column = item.projects?.title || '미지정';
    lines.push(`${i + 1}. *${item.title}*`);
    lines.push(`   ${status} | 📁 ${column} | 👤 ${assignees}`);
  });

  return lines.join('\n');
}

/**
 * 복잡한 질문 → 전체 데이터 + LLM으로 자유 응답
 */
async function askWithFullData(message) {
  const boards = await getBoardData();

  // 데이터 요약 (토큰 절약)
  const summary = boards.map(section => ({
    보드: section.title,
    컬럼들: section.columns.map(col => ({
      컬럼: col.title,
      작업들: col.items.map(item => ({
        제목: item.title,
        상태: STATUS_LABEL[item.status] || item.status,
        담당자: item.assignees || [],
        태그: item.tags || [],
      })),
    })),
  }));

  const dataText = JSON.stringify(summary, null, 2);

  return await askOllama(
    SYSTEM_PROMPT,
    `현재 보드 데이터:\n${dataText}\n\n질문: ${message}`
  );
}
