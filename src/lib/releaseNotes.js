/**
 * @fileoverview 내부용 릴리즈 노트 데이터의 단일 소스.
 *
 * App은 currentRelease.id와 localStorage에 저장된 마지막 확인 버전을 비교해
 * 자동 노출 여부를 결정한다. 새 릴리즈를 추가할 때는 배열 맨 앞에 넣는다.
 */

export const RELEASE_NOTES_STORAGE_KEY = 'kanban-release-notes-last-seen';

export const RELEASE_NOTES = [
  {
    id: '2026-04-14-profile-customization-reactions',
    version: 'v0.9.1',
    title: '프로필 꾸미기 & 이모지 리액션',
    description: '내 아바타 스타일·테마 컬러·무드 이모지·상태 메시지를 직접 꾸밀 수 있게 되었고, People 보드에서 팀원 프로필에 이모지 리액션을 남길 수 있습니다.',
    sections: [
      {
        title: '추가',
        items: [
          '프로필 꾸미기: 상단 아바타 클릭 시 아바타 스타일(12종)·테마 컬러(6종)·무드 이모지·상태 메시지를 설정하는 모달 추가',
          'ProfileAvatar 컴포넌트: 꾸미기 데이터를 반영한 공용 아바타 컴포넌트 추가',
          'People 보드 프로필 카드: 멤버 클릭 시 프로필 팝업(아바타·상태 메시지·이모지 리액션) 표시',
          '이모지 리액션: People 보드에서 팀원에게 👍🔥👏😂 반응 전송/취소 가능 (24시간 집계)',
          'profile_customizations / profile_reactions 테이블 연동 API 추가',
        ],
      },
      {
        title: '변경',
        items: [
          '댓글·Presence 아바타에 ProfileAvatar 적용 — 꾸미기 스타일 반영',
          '댓글 작성자 이름 옆에 무드 이모지 표시',
          '상단 유저 영역을 클릭 가능한 프로필 버튼으로 전환, 상태 메시지 표시 추가',
        ],
      },
    ],
  },
  {
    id: '2026-04-14-sidebar-dnd-project-rename',
    version: 'v0.9.0',
    title: '사이드바 DnD 재배치 & 인증 정책 변경',
    description: '사이드바에서 프로젝트와 페이지를 드래그로 재배치할 수 있게 되었고, 로그인 없이는 보드에 접근할 수 없도록 인증 정책을 변경했습니다.',
    sections: [
      {
        title: '추가',
        items: [
          '사이드바 드래그 앤 드롭: 프로젝트와 하위 페이지를 드래그해 순서·계층 변경',
          '드롭 위치(앞/뒤/안)를 시각적으로 표시하는 드롭 존 하이라이트 적용',
          '크로스 프로젝트 아이템 이동: 페이지를 다른 프로젝트로 드래그 이동 (Optimistic Update + 실패 시 롤백)',
        ],
      },
      {
        title: '변경',
        items: [
          '비로그인 사용자에게 보드 화면 대신 로그인 화면 강제 표시',
          '내부 상태명 phases → projects 일괄 정리 (도메인 용어 일관성 향상)',
          '릴리즈 노트 표시 여부 계산을 useEffect 대신 useState 초기값으로 개선',
        ],
      },
    ],
  },
  {
    id: '2026-04-09-live-preview-detail-panel-fixes',
    version: 'v0.8.2',
    title: '라이브 프리뷰 & 상세 패널 수정',
    description: '라이브 마크다운 미리보기와 상세 패널 진입 동작을 손보고, 로컬 작업 상태를 저장소에서 분리하도록 정리했습니다.',
    sections: [
      {
        title: '수정',
        items: [
          'Markdown 라이브 프리뷰에서 토글 헤더·불릿·체크리스트·코드 블록 처리 규칙 보정',
          '토글 블록 헤더/콘텐츠 분리 — 헤더 접근성 유지하면서 콘텐츠만 접히도록 정리',
          '아이템 상세 진입 시 기본 상태를 전체화면으로 변경',
          '로컬 상태 디렉터리 `.omx/`를 gitignore에 추가',
        ],
      },
    ],
  },
  {
    id: '2026-04-07-entity-context-unification',
    version: 'v0.8.1',
    title: '엔티티 문맥 통합 & 개인 메모/일반 문서',
    description: '개인 메모와 일반 문서 관리 기능을 추가하고, 아이템 타입 판별 로직을 공통 모듈로 통합했습니다.',
    sections: [
      {
        title: '추가',
        items: [
          '개인 메모 보드: 사용자별 개인 메모를 관리하는 새로운 뷰 추가',
          '일반 문서 섹션: 보드별 프로젝트에 속하지 않는 문서 관리 기능 추가',
          '개인 메모/일반 문서 CRUD 완전 구현 (생성·수정·삭제·이동)',
          '검색 모달에 일반 문서·개인 메모 포함, 출처 라벨(개인 메모/일반 문서/일반 폴더) 추가',
        ],
      },
      {
        title: '변경',
        items: [
          'entityModel 공통 모듈 추가 — task/document/folder/memo/project 타입 판별 로직 중앙화',
          'KanbanBoard 상세 패널 업데이트/삭제 분기를 엔티티 문맥 기반으로 정리',
          'ItemDetailPanel에 엔티티 라벨(프로젝트 문서/일반 문서/개인 메모 등) 기반 경로 표기 반영',
          '상세 패널 연관 아이템 목록에 일반 문서 포함',
        ],
      },
    ],
  },
  {
    id: '2026-04-06-mermaid-diagram',
    version: 'v0.8.0',
    title: 'Mermaid 다이어그램 지원',
    description: '에디터에서 Mermaid 문법으로 플로우차트, 시퀀스 다이어그램 등을 직접 작성하고 미리볼 수 있게 되었습니다.',
    sections: [
      {
        title: '추가',
        items: [
          'Mermaid 다이어그램: 코드 블록에서 mermaid 언어 지정 시 라이브 프리뷰에서 다이어그램 렌더링',
          '라이브 프리뷰 클릭 매핑 정책 정립 — 렌더 위젯 클릭 시 해당 source 라인으로 이동',
          '라이브 위젯(math/callout/mermaid/table/blockquote/code/hr/image) 세로 margin 축소로 클릭 오차 완화',
        ],
      },
    ],
  },
  {
    id: '2026-04-03-presence-realtime-collaboration',
    version: 'v0.7.0',
    title: 'Presence & 실시간 협업',
    description: '현재 보드에 접속 중인 팀원 아바타를 상단에서 확인할 수 있고, 아이템 상세 패널에서 누가 같이 보고 있는지 표시됩니다.',
    sections: [
      {
        title: '추가',
        items: [
          'Presence 시스템: Supabase Realtime을 이용해 현재 접속자 실시간 추적',
          'PresenceAvatars: 보드 상단에 온라인 팀원 아바타 표시',
          'ItemViewers: 아이템 상세 패널에서 같이 보고 있는 팀원 및 편집 중인 필드 표시',
          '상세 패널 헤더 액션(공유·전체화면 등) 개선',
          '사이드바 컨트롤 개선',
        ],
      },
    ],
  },
  {
    id: '2026-04-02-markdown-live-preview',
    version: 'v0.6.0',
    title: 'Markdown 라이브 프리뷰 에디터',
    description: '상세 설명 에디터가 CodeMirror 기반 마크다운 라이브 프리뷰 방식으로 전환되었고, 보드 UI 전반을 정리했습니다.',
    sections: [
      {
        title: '추가',
        items: [
          'Markdown 라이브 프리뷰: 작성하면서 동시에 렌더링 결과를 확인하는 CodeMirror 기반 에디터',
          '프로젝트 컬럼 메뉴를 body 포털의 fixed 오버레이로 렌더해 backdrop-blur 영향 없이 표시',
          '릴리즈 노트 시스템: 앱 진입 시 자동 노출되는 업데이트 내역 모달',
        ],
      },
      {
        title: '변경',
        items: [
          '메인 보드 레이아웃·사이드바 상호작용 정리',
          '상세 설명 초기 모드: 본문 있으면 미리보기, 없으면 라이브 모드로 시작',
          '프로젝트 컬럼 메뉴 클릭 관통 방지',
        ],
      },
    ],
  },
  {
    id: '2026-04-01-project-completion-performance',
    version: 'v0.5.0',
    title: '프로젝트 완료 기능 & 성능 개선',
    description: '칸반 컬럼(프로젝트)을 완료 처리해 하단 영역으로 분리할 수 있고, 대량 아이템 렌더링 성능을 개선했습니다.',
    sections: [
      {
        title: '추가',
        items: [
          '프로젝트 완료 토글: 컬럼 헤더에서 완료 처리 시 보드 하단 완료 영역으로 이동',
          '완료 프로젝트 섹션: 완료된 컬럼을 별도 영역에서 펼쳐보기 가능',
          '아이템 접기/펼치기: 컬럼당 기본 6개 표시, 나머지는 펼치기로 확인',
          '칸반 아이템 가상화(Virtualized List): 대량 아이템 렌더링 성능 최적화',
        ],
      },
    ],
  },
  {
    id: '2026-03-30-timeline-dnd-gantt',
    version: 'v0.4.0',
    title: '타임라인 DnD & Gantt 바',
    description: '타임라인 뷰에서 드래그로 프로젝트와 아이템 순서를 바꿀 수 있고, Gantt 스타일의 일정 바가 추가되었습니다.',
    sections: [
      {
        title: '추가',
        items: [
          '타임라인 DnD 재배치: 프로젝트·아이템을 드래그해 순서 변경',
          'Gantt 바: 시작일·종료일 기반 시각적 일정 바 표시',
          '타임라인 프로젝트 접기/펼치기',
          '프로젝트 상세 뷰: 프로젝트 클릭 시 담당 아이템 및 상세 정보 표시',
        ],
      },
    ],
  },
  {
    id: '2026-03-28-phase5-sidebar-pages',
    version: 'v0.3.0',
    title: '사이드바 & 중첩 페이지 트리',
    description: '사이드바가 추가되었고, 아이템을 중첩 페이지 구조로 관리할 수 있습니다. 전체 검색(Cmd+K), 타임라인 뷰, 필터/정렬도 이 버전에 함께 포함됩니다.',
    sections: [
      {
        title: '추가',
        items: [
          '사이드바: 프로젝트별 문서 트리를 탐색하는 접이식 사이드바',
          '중첩 페이지 트리: 아이템 하위에 페이지를 무한 중첩 생성 가능',
          '타임라인 뷰: 프로젝트·아이템의 일정을 한눈에 확인하는 뷰',
          '시작일·종료일·우선순위 필드 추가',
          'Cmd+K 전체 검색 모달: 보드 전체 아이템을 키워드로 검색',
          '필터/정렬/그룹: 상태·담당자·팀·우선순위 기준으로 필터링 및 정렬',
          'People 보드: 팀원별 담당 아이템 현황 뷰',
          'Notion 스타일 블록 UX: BubbleMenu, 슬래시 커맨드, Callout, 토글, TaskList, 코드블록',
        ],
      },
      {
        title: '변경',
        items: [
          '필터/정렬 상태 URL 쿼리 파라미터와 동기화',
          '에디터 블록 간격 Notion 스타일로 축소',
        ],
      },
    ],
  },
  {
    id: '2026-03-27-board-sections-url-state',
    version: 'v0.2.0',
    title: '보드 섹션 & URL 상태 동기화',
    description: '칸반 컬럼을 그룹으로 묶는 섹션 기능과 URL 기반 딥링크가 추가되었습니다.',
    sections: [
      {
        title: '추가',
        items: [
          '보드 섹션: 여러 프로젝트 컬럼을 그룹으로 묶는 접이식 섹션',
          'URL 상태 동기화: 뷰·아이템·전체화면·필터·정렬 상태를 URL 쿼리 파라미터로 관리',
          '딥링크: URL로 특정 섹션·프로젝트·아이템 위치로 직접 이동',
          '파일 업로드: 아이템에 파일 첨부 및 관리 기능 (Express 파일 서버)',
          '마크다운 복사/붙여넣기: Turndown 기반 마크다운↔WYSIWYG 변환',
          '테이블 블록: 에디터에서 테이블 삽입 및 스타일링',
        ],
      },
    ],
  },
  {
    id: '2026-03-23-initial-release',
    version: 'v0.1.0',
    title: '첫 번째 릴리즈',
    description: 'Quazar Roadmap 초기 버전입니다. 기본 칸반 보드, 다크모드, Supabase 인증이 포함되어 있습니다.',
    sections: [
      {
        title: '포함 기능',
        items: [
          '칸반 보드: 프로젝트 컬럼 + 아이템 카드 CRUD',
          'DnD: @dnd-kit 기반 카드 및 컬럼 드래그 앤 드롭',
          '아이템 상세 패널: Tiptap 에디터, 담당자·태그·날짜·연관 아이템 편집',
          '다크모드: Tailwind v4 dark: 접두사 기반',
          'Supabase 인증: 이메일 로그인, 비로그인 읽기 전용 모드',
          'AI 요약: Ollama 로컬 LLM 기반 아이템 요약 (qwen2.5:14b)',
          'Google Chat Bot: 웹훅 기반 NLU 연동',
        ],
      },
    ],
  },
];

export const CURRENT_RELEASE_NOTE = RELEASE_NOTES[0];
