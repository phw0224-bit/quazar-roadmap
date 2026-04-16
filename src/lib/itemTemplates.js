export const ITEM_TEMPLATES = {
  common: `## 개요

## 배경

## 공유 대상

## 해야 할 일
- [ ]

## 참고 자료
`,
  policy: `## 목적

## 적용 범위

## 정책 내용

## 예외 사항

## 참고 문서
`,
  development: `## 목표

## 작업 범위

## 구현 메모

## 완료 조건
- [ ]

## 참고 사항
`,
  bug: `## 현상

## 재현 절차
1.
2.
3.

## 기대 결과

## 실제 결과

## 영향 범위

## 참고 로그 / 스크린샷
`,
  operations: `## 이슈 개요

## 현재 상태

## 영향도

## 대응 계획
- [ ]

## 마감/점검 시점
`,
  research: `## 조사 목적

## 검토 대상

## 확인한 내용

## 장단점

## 결론 / 제안
`,
  risk: `## 리스크 설명

## 발생 가능 시나리오

## 영향도

## 사전 대응 방안
- [ ]

## 트리거 / 모니터링 포인트
`,
};

export function getTemplateContent(templateType) {
  return ITEM_TEMPLATES[templateType] || '';
}
