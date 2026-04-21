export const DEV_REQUEST_TABLE = Object.freeze('team_requests');

export const DEV_REQUEST_BOARD = Object.freeze({
  boardType: '개발팀',
  label: '요청',
  icon: '📝',
  description: '다른 팀이 요청을 등록하고 개발팀이 처리합니다.',
  emptyMessage: '아직 등록된 요청이 없습니다.',
});

export const DEV_REQUEST_STATUSES = Object.freeze(['접수됨', '검토중', '진행중', '완료']);

export const DEV_REQUEST_TEMPLATE = Object.freeze({
  title: '임시 요청명세 템플릿',
  subtitle: '아래 항목을 먼저 채우면 개발팀이 빠르게 검토할 수 있습니다.',
  note: '이 템플릿은 임시 버전입니다. 실제 운영 템플릿이 정해지면 이 정의만 교체하면 됩니다.',
  fields: [
    {
      key: 'background',
      label: '요청 배경',
      hint: '왜 지금 이 요청이 필요한지 한두 문장으로 적습니다.',
    },
    {
      key: 'goal',
      label: '목표',
      hint: '이 요청이 완료되면 무엇이 달라지는지 적습니다.',
    },
    {
      key: 'impact',
      label: '영향 범위',
      hint: '영향받는 팀, 기능, 사용자 범위를 적습니다.',
    },
    {
      key: 'priority',
      label: '우선순위',
      hint: '높음/중간/낮음 중 하나를 기준으로 작성합니다.',
    },
    {
      key: 'timeline',
      label: '희망 일정',
      hint: '원하는 시작일, 마감일, 외부 의존성을 적습니다.',
    },
    {
      key: 'links',
      label: '참고 링크',
      hint: '기획서, 스펙 문서, 디자인, 대화 링크 등을 붙입니다.',
    },
    {
      key: 'acceptance',
      label: '검수 기준',
      hint: '완료 여부를 판단할 수 있는 조건을 적습니다.',
    },
  ],
});

export const createDevRequestTemplateData = () => (
  Object.fromEntries(DEV_REQUEST_TEMPLATE.fields.map((field) => [field.key, '']))
);
