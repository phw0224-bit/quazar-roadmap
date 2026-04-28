import {
  createDevRequestDescriptionScaffold,
  createDevRequestInlinePlaceholders,
} from './devRequestBoard.js';

export const ITEM_TEMPLATES = {
  weekly: {
    scaffold: `# 주간 목표
`,
    placeholders: {},
  },
  development: {
    scaffold: `## 개발

## [원인]

##[목표]

## [과정]

## [결과]
`,
    placeholders: {
      '## [원인]': '- 왜 이 작업을 하는지, 요청 배경이나 문제상황',
      '## [목표]': '- 완료 기준, 기대 결과',
      '## [과정]': '- 진행 내용, 결정사항, 이슈',
      '## [결과]': '- 완료 내용, 현재 상태, 남은 액션, 참고 링크',
    },
  },
  policy: {
    scaffold: `## 정책

## [배경]

## [적용 범위]

## [결정 사항]

## [후속 조치]
`,
    placeholders: {
      '## [배경]': '- 왜 이 기준이 필요한지, 기존 문제',
      '## [적용 범위]': '- 누구/어디에 적용되는지',
      '## [결정 사항]': '- 최종 규칙, 예외, 합의 내용',
      '## [후속 조치]': '- 문서화, 공지, 반영 필요 사항',
    },
  },
  common: {
    scaffold: `## 공통

## [배경]

## [요청/목표]

## [진행 내용]

## [현재 상태]
`,
    placeholders: {
      '## [배경]': '- 요청 배경, 협업 필요 이유',
      '## [요청/목표]': '- 무엇을 맞추거나 정리해야 하는지',
      '## [진행 내용]': '- 협의 내용, 공유 내용, 정리 현황',
      '## [현재 상태]': '- 완료/진행중/추가 확인 필요 사항',
    },
  },
  bug: {
    scaffold: `## 버그

## [현상]

## [재현 조건]

## [원인 추정/확인]

## [조치 결과]
`,
    placeholders: {
      '## [현상]': '- 어떤 문제가 발생하는지',
      '## [재현 조건]': '- 언제, 어디서, 어떻게 발생하는지',
      '## [원인 추정/확인]': '- 확인된 원인 또는 추정 원인',
      '## [조치 결과]': '- 수정 여부, 테스트 결과, 남은 이슈',
    },
  },
  operations: {
    scaffold: `## 운영

## [현상]

## [영향 범위]

## [조치 내용]

## [잔여 과제]
`,
    placeholders: {
      '## [현상]': '- 현재 발생 중인 운영 이슈',
      '## [영향 범위]': '- 서비스/사용자/서버에 미치는 영향',
      '## [조치 내용]': '- 임시 조치, 원인 확인, 대응 내용',
      '## [잔여 과제]': '- 재발 방지, 추가 점검, 후속 작업',
    },
  },
  research: {
    scaffold: `## 조사

## [배경]

## [검토 대상]

## [검토 결과]

## [제안]
`,
    placeholders: {
      '## [배경]': '- 왜 검토가 필요한지',
      '## [검토 대상]': '- 어떤 후보/방법/도구를 봤는지',
      '## [검토 결과]': '- 장단점, 차이점, 확인 내용',
      '## [제안]': '- 추천안, 보류안, 추가 확인 필요 사항',
    },
  },
  risk: {
    scaffold: `## 리스크

## [리스크 내용]

## [발생 조건]

## [영향도]

## [대응 계획]
`,
    placeholders: {
      '## [리스크 내용]': '- 어떤 잠재 문제가 있는지',
      '## [발생 조건]': '- 어떤 상황에서 터질 수 있는지',
      '## [영향도]': '- 발생 시 영향 범위와 심각도',
      '## [대응 계획]': '- 사전 대응, 모니터링, 완화 방안',
    },
  },
  request: {
    scaffold: createDevRequestDescriptionScaffold(),
    placeholders: createDevRequestInlinePlaceholders(),
  },
};

export const COMMENT_TEMPLATES = {
  daily: {
    scaffold: `## 일일업무

### 어제 진행

### 오늘 예정

### 이슈 / 도움 필요
`,
    label: '일일업무',
  },
  development: {
    scaffold: `## 개발

## [원인]

## [목표]

## [과정]

## [결과]
`,
    label: '개발',
  },
  bug: {
    scaffold: `## 버그

## [현상]

## [재현 조건]

## [원인 추정/확인]

## [조치 결과]
`,
    label: '버그',
  },
  operations: {
    scaffold: `## 운영

## [현상]

## [영향 범위]

## [조치 내용]

## [잔여 과제]
`,
    label: '운영',
  },
  common: {
    scaffold: `## 공통

## [배경]

## [요청/목표]

## [진행 내용]

## [현재 상태]
`,
    label: '공통',
  },
};

export function getCommentTemplate(templateType) {
  return COMMENT_TEMPLATES[templateType] || null;
}

export function getCommentScaffold(templateType) {
  return getCommentTemplate(templateType)?.scaffold || '';
}

export function getCommentTemplateLabel(templateType) {
  return getCommentTemplate(templateType)?.label || templateType;
}

export function getItemTemplate(templateType) {
  return ITEM_TEMPLATES[templateType] || null;
}

export function getTemplateScaffold(templateType) {
  return getItemTemplate(templateType)?.scaffold || '';
}

export function getTemplateInlinePlaceholders(templateType) {
  return getItemTemplate(templateType)?.placeholders || {};
}
