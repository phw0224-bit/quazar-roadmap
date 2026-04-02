/**
 * @fileoverview 내부용 릴리즈 노트 데이터의 단일 소스.
 *
 * App은 currentRelease.id와 localStorage에 저장된 마지막 확인 버전을 비교해
 * 자동 노출 여부를 결정한다. 새 릴리즈를 추가할 때는 배열 맨 앞에 넣는다.
 */

export const RELEASE_NOTES_STORAGE_KEY = 'kanban-release-notes-last-seen';

export const RELEASE_NOTES = [
  {
    id: '2026-04-02',
    version: '2026-04-02',
    title: '업데이트 내역',
    description: '현재 배포 기준 변경사항입니다.',
    sections: [
      {
        title: '추가',
        items: [
          'Tiptap 기반 본문 편집기 추가',
          '/ 슬래시 명령어 기반 블록 삽입 지원',
          '파일 업로드 및 본문 내 이미지 삽입 지원',
          'AI 요약 생성 기능 추가',
          'Ctrl+K 전역 검색 모달 추가',
          '페이지 트리 기반 사이드바 탐색 추가',
          '타임라인 뷰, 피플 보드 뷰 추가',
        ],
      },
      {
        title: '변경',
        items: [
          '필터/정렬 상태를 URL 파라미터로 관리하도록 변경',
          "페이지(page_type='page')와 카드(task/null) 렌더링 분리",
          '프로젝트 완료 시 별도 완료 영역으로 이동하도록 변경',
          '담당자 입력이 추천 선택 + 직접 입력 방식으로 변경',
          '보드/섹션/페이지 이동 UX 개선',
        ],
      },
      {
        title: 'UI 변경',
        items: [
          '우측 상세 패널 리사이즈 가능',
          '사이드바 구조 및 페이지 트리 표시 방식 변경',
          '다크모드 스타일 전반 정리',
          '필터 바 및 보드 상단 액션 영역 정리',
          '카드/컬럼/섹션 드래그 인터랙션 정리',
        ],
      },
      {
        title: '삭제/정리',
        items: [
          '기존 단순 편집 흐름 일부를 Tiptap 기반 편집기로 대체',
          '초기 프로토타입 성격의 구형 에디터 사용 경로 축소',
          '미사용 가상 리스트/구형 컴포넌트는 유지 중이지만 기본 진입에서는 제외',
        ],
      },
    ],
  },
];

export const CURRENT_RELEASE_NOTE = RELEASE_NOTES[0];
