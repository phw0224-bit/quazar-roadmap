/**
 * @fileoverview 내부용 릴리즈 노트 데이터의 단일 소스.
 *
 * App은 currentRelease.id와 localStorage에 저장된 마지막 확인 버전을 비교해
 * 자동 노출 여부를 결정한다. 새 릴리즈를 추가할 때는 배열 맨 앞에 넣는다.
 */

export const RELEASE_NOTES_STORAGE_KEY = 'kanban-release-notes-last-seen';

export const RELEASE_NOTES = [
  {
    id: '2026-04-09-live-preview-detail-panel-fixes',
    version: '2026-04-09.1',
    title: '업데이트 내역',
    description: '라이브 마크다운 미리보기와 상세 패널 진입 동작을 손보고, 로컬 작업 상태를 저장소에서 분리하도록 정리했습니다.',
    sections: [
      {
        title: '수정',
        items: [
          'Markdown 라이브 프리뷰에서 토글 헤더, 불릿, 체크리스트, 코드 블록 처리 규칙을 보정해 inactive 상태의 렌더 정확도 개선',
          '토글 블록은 헤더와 콘텐츠를 분리해 헤더 접근성을 유지하면서 콘텐츠만 접히도록 정리',
          '아이템 상세 진입 시 기본 상태를 전체화면으로 열리게 바꿔 보드에서의 확인 흐름을 단순화',
          '상세 패널 전체화면 토글 문구를 현재 동작에 맞게 정리',
          '로컬 OMX 상태 디렉터리 `.omx/`를 gitignore에 추가해 개발자별 상태 파일이 커밋되지 않도록 조정',
        ],
      },
    ],
  },
  {
    id: '2026-04-07-entity-context-unification',
    version: '2026-04-07.3',
    title: '업데이트 내역',
    description: '아이템 타입 판별 규칙을 공통 모듈로 통합해 상세 패널/검색의 엔티티 처리 일관성을 높이고, 릴리즈 노트 현재값 참조 방식을 안정화했습니다.',
    sections: [
      {
        title: '변경',
        items: [
          'entityModel 공통 모듈을 추가해 task/document/folder/memo/project 타입 및 문맥(collection, boardType) 판별 로직 중앙화',
          'KanbanBoard 상세 패널 업데이트/삭제 분기를 엔티티 문맥 기반으로 정리하고 프로젝트 상세 아이템 생성 로직을 헬퍼로 통합',
          'ItemDetailPanel에 엔티티 라벨(프로젝트 문서/일반 문서/개인 메모 등) 기반 경로 표기를 반영',
          'SearchModal이 공통 엔티티 문맥을 사용해 결과 라벨을 일관되게 표시하도록 개선',
          'App에서 현재 릴리즈를 고정 상수 대신 RELEASE_NOTES[0] 파생값으로 사용하도록 변경',
          'CLAUDE.md에 import/export 계약 및 모듈 변경 절차 규칙을 보강',
        ],
      },
    ],
  },
  {
    id: '2026-04-07-general-doc-search-detail-fixes',
    version: '2026-04-07.2',
    title: '업데이트 내역',
    description: '일반 문서/개인 메모 상세 진입과 검색 결과 노출 경로를 정리하고, 상세 패널 수정·삭제 동작을 데이터 타입별로 안정화했습니다.',
    sections: [
      {
        title: '수정',
        items: [
          '일반 문서 목록 클릭 시 상세 패널이 안정적으로 열리도록 상세 열기 인자 처리 통일',
          '상세 패널에서 일반 문서/개인 메모 수정·삭제 시 각 전용 API로 분기하도록 처리',
          '검색 모달에 일반 문서·개인 메모를 포함해 보드 아이템 외 항목도 검색 가능하도록 확장',
          '검색 결과의 출처 라벨(개인 메모/일반 문서/일반 폴더) 표시를 추가해 구분성 개선',
          '상세 패널 연관 아이템 목록에 일반 문서를 포함하도록 보강',
        ],
      },
    ],
  },
  {
    id: '2026-04-07-personal-memo-general-docs',
    version: '2026-04-07.1',
    title: '업데이트 내역',
    description: '개인 메모 기능과 일반 문서 관리 기능이 추가되었으며, 프로젝트 문서 구조를 대폭 개선했습니다.',
    sections: [
      {
        title: '추가',
        items: [
          '개인 메모 보드: 사용자별 개인 메모를 관리할 수 있는 새로운 뷰 추가',
          '일반 문서 섹션: 보드별로 프로젝트에 속하지 않는 일반 문서를 관리할 수 있는 기능 추가',
          '개인 메모/일반 문서 CRUD: 생성, 수정, 삭제, 이동 기능 완전 구현',
          'docs/ 폴더: 구조화된 프로젝트 문서 (BUSINESS_RULES, DATA_MODEL, FLOWS, ROADMAP, DOCUMENTATION_GUIDE) 추가',
          'SQL 마이그레이션: 개인 메모 필드 추가 및 project_id nullable 변경 스크립트 문서화',
        ],
      },
      {
        title: '변경',
        items: [
          'CLAUDE.md 대폭 간소화: 11개 핵심 섹션으로 압축하여 AI 컨텍스트 파악 효율성 향상',
          'README.md 간소화: 핵심 정보만 남기고 상세 내용은 docs/ 폴더로 분리',
          'kanbanAPI 확장: getPersonalMemos, createPersonalMemo, updatePersonalMemo 등 API 함수 추가',
          'useKanbanData 훅 확장: 개인 메모 및 일반 문서 상태 관리 로직 추가',
        ],
      },
      {
        title: '삭제/정리',
        items: [
          'AGENTS.md 삭제: CLAUDE.md로 통합하여 문서 중복 제거',
          '레거시 문서 정리: 중복되거나 구식 설명 제거 및 최신 구조 반영',
        ],
      },
      {
        title: '기술 부채',
        items: [
          '개인 메모 Realtime 구독: 현재 초기 로드만 구현, 실시간 업데이트는 추후 추가 예정',
          '일반 문서 UI 개선: 드래그앤드롭 및 폴더 선택 UI 최적화 예정',
        ],
      },
    ],
  },
  {
    id: '2026-04-06-live-click-alignment',
    version: '2026-04-06.1',
    title: '업데이트 내역',
    description: '상세 설명 라이브 프리뷰에서 클릭 위치가 아래로 밀리던 문제를 줄이기 위한 클릭 매핑/스타일 보정을 반영했습니다.',
    sections: [
      {
        title: '변경',
        items: [
          '라이브 모드 클릭 처리에서 일반 텍스트 클릭은 CodeMirror 기본 동작으로 위임하도록 조정',
          '헤딩 폴드 토글 및 렌더 위젯 클릭만 최소 개입하도록 Editor 클릭 분기 정리',
          '렌더 위젯 클릭 시 `posAtDOM` 기준으로 해당 source 라인으로 이동하도록 보정',
          '라이브 위젯(math/callout/mermaid/table/blockquote/code/hr/image) 세로 margin을 축소해 누적 클릭 오차를 완화',
        ],
      },
      {
        title: '문서 업데이트',
        items: [
          'CLAUDE.md에 라이브 프리뷰 클릭 매핑 정책과 현재 상호작용 규칙 추가',
          'components/editor 동작 규칙을 현재 클릭 정책 기준으로 정리',
        ],
      },
      {
        title: '알려진 사항',
        items: [
          '코드블록/머메이드처럼 여러 source 라인을 하나의 렌더 블록으로 축약하는 구간은 특성상 세부 y 위치와 1:1 매핑에 한계가 있습니다.',
          '현재는 편집 안정성을 위해 해당 구간 클릭 시 블록 source 진입 일관성을 우선합니다.',
        ],
      },
    ],
  },
  {
    id: '2026-04-02-ui-docs',
    version: '2026-04-02.1',
    title: '업데이트 내역',
    description: '어제 배포 기준 이후 오늘 진행한 메인 보드 UI 정리, 릴리즈 노트 도입, 상세 상호작용 보정을 묶었습니다.',
    sections: [
      {
        title: '추가',
        items: [
          '앱 진입점에서 자동 노출되는 릴리즈 노트 시스템과 전용 모달 추가',
          '프로젝트/아이템 작성자 추적용 `created_by` SQL 마이그레이션 문서 추가',
          '프로젝트 컬럼 메뉴를 body 포털의 fixed 오버레이로 렌더하는 전용 위치 계산 규칙 추가',
          '상세 설명 섹션의 초기 모드를 본문 유무 기준으로 정하는 헬퍼 추가',
        ],
      },
      {
        title: '변경',
        items: [
          '메인 보드 레이아웃과 사이드바 상호작용을 다듬고 관련 상태 관리를 정리',
          '프로젝트 컬럼/카드 헤더와 담당자 편집 UI를 현재 보드 스타일에 맞게 정리',
          'AssigneePicker와 보드 문서(AGENTS.md, 폴더별 README)를 현재 구조 기준으로 업데이트',
          '프로젝트 컬럼 메뉴가 반투명 헤더/backdrop-blur 영향 없이 불투명하게 표시되도록 변경',
          '프로젝트 컬럼 메뉴가 열려 있을 때 클릭이 뒤 카드나 헤더로 관통되지 않도록 변경',
          '상세페이지에서 본문이 있으면 기본 탭이 라이브가 아니라 미리보기로 열리도록 변경',
        ],
      },
      {
        title: 'UI 변경',
        items: [
          '메인 보드 상단/사이드바/릴리즈 노트 모달의 시각 구조를 더 일관된 내부 툴 스타일로 정리',
          '카드와 프로젝트 컬럼의 hover/drag/카운터 표현을 정돈해 보드 밀도를 개선',
          '프로젝트 컬럼 메뉴가 보드 위에 더 선명한 단일 레이어로 표시됨',
          '빈 상세 설명은 즉시 입력 가능한 라이브 모드로, 기존 내용이 있는 상세 설명은 읽기 중심의 미리보기로 시작',
        ],
      },
      {
        title: '삭제/정리',
        items: [
          '보드 UI에 남아 있던 구형 헤더/사이드바 스타일과 문서 불일치를 정리',
          '프로젝트 컬럼 헤더 내부 absolute 메뉴 레이어 의존을 줄이고 오버레이 책임을 전용 헬퍼로 분리',
          '상세 설명 초기 모드의 하드코딩된 live 기본값을 공용 규칙 함수로 정리',
        ],
      },
    ],
  },
];

export const CURRENT_RELEASE_NOTE = RELEASE_NOTES[0];
