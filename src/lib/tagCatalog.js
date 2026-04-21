export const TAG_CATALOG = [
  {
    name: '일지',
    description: '개발일지',
    color: '64748b',
    templateType: 'daily',
  },
  {
    name: '공통',
    description: '개발팀 포함 여러 팀/업무에 공통 적용되는 항목',
    color: '64748b',
    templateType: 'common',
  },
  {
    name: '정책',
    description: '업무 수행에 필요한 기준 문서 (컨벤션, 가이드, 규칙)',
    color: '7c3aed',
    templateType: 'policy',
  },
  {
    name: '개발',
    description: '실제 기능 개발/개선 등의 코드 작업 내역서',
    color: '2563eb',
    templateType: 'development',
  },
  {
    name: '버그',
    description: '의도한 설계와 다르게 동작하는 문제',
    color: 'dc2626',
    templateType: 'bug',
  },
  {
    name: '운영',
    description: '현재 서비스되는 운영 중심의 이슈사항',
    color: 'ea580c',
    templateType: 'operations',
  },
  {
    name: '조사',
    description: '도입/의사결정을 위한 검토, 리서치, PoC',
    color: '0891b2',
    templateType: 'research',
  },
  {
    name: '리스크',
    description: '잠재 문제 시나리오와 사전 대응이 필요한 사항',
    color: 'be123c',
    templateType: 'risk',
  },
];

export const TAG_CATALOG_BY_NAME = new Map(
  TAG_CATALOG.map((tag) => [tag.name, tag])
);
