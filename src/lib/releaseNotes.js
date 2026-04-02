/**
 * @fileoverview 내부용 릴리즈 노트 데이터의 단일 소스.
 *
 * App은 currentRelease.id와 localStorage에 저장된 마지막 확인 버전을 비교해
 * 자동 노출 여부를 결정한다. 새 릴리즈를 추가할 때는 배열 맨 앞에 넣는다.
 */

export const RELEASE_NOTES_STORAGE_KEY = 'kanban-release-notes-last-seen';

export const RELEASE_NOTES = [
  {
    id: '2026-04-02-ui-docs',
    version: '2026-04-02.1',
    title: '업데이트 내역',
    description: '프로젝트 컬럼 메뉴 안정화와 상세 설명 기본 모드 개선을 반영했습니다.',
    sections: [
      {
        title: '추가',
        items: [
          '프로젝트 컬럼 메뉴를 body 포털의 fixed 오버레이로 렌더하는 전용 위치 계산 규칙 추가',
          '상세 설명 섹션의 초기 모드를 본문 유무 기준으로 정하는 헬퍼 추가',
          '문서용 components/lib README와 AGENTS.md에 신규 UI 규칙 반영',
        ],
      },
      {
        title: '변경',
        items: [
          '프로젝트 컬럼 메뉴가 반투명 헤더/backdrop-blur 영향 없이 불투명하게 표시되도록 변경',
          '프로젝트 컬럼 메뉴가 열려 있을 때 클릭이 뒤 카드나 헤더로 관통되지 않도록 변경',
          '상세페이지에서 본문이 있으면 기본 탭이 라이브가 아니라 미리보기로 열리도록 변경',
        ],
      },
      {
        title: 'UI 변경',
        items: [
          '프로젝트 컬럼 메뉴가 보드 위에 더 선명한 단일 레이어로 표시됨',
          '빈 상세 설명은 즉시 입력 가능한 라이브 모드로, 기존 내용이 있는 상세 설명은 읽기 중심의 미리보기로 시작',
        ],
      },
      {
        title: '삭제/정리',
        items: [
          '프로젝트 컬럼 헤더 내부 absolute 메뉴 레이어 의존을 줄이고 오버레이 책임을 전용 헬퍼로 분리',
          '상세 설명 초기 모드의 하드코딩된 live 기본값을 공용 규칙 함수로 정리',
        ],
      },
    ],
  },
];

export const CURRENT_RELEASE_NOTE = RELEASE_NOTES[0];
