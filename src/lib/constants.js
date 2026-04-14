export const TEAMS = [
  { name: '감정팀', color: 'bg-slate-200 text-slate-900 ring-1 ring-slate-400' },
  { name: '개발팀', color: 'bg-[#e2e8f0] text-gray-900 ring-1 ring-gray-400' },
  { name: 'AI팀', color: 'bg-[#c6f6d5] text-green-900 ring-1 ring-green-400' },
  { name: '기획팀', color: 'bg-[#e9d8fd] text-purple-900 ring-1 ring-purple-400' },
  { name: '지원팀', color: 'bg-[#fed7e2] text-pink-900 ring-1 ring-pink-400' },
];

export const TEAM_COLORS = {
  '감정팀': 'bg-slate-200 text-slate-900 ring-1 ring-slate-400',
  '개발팀': 'bg-[#e2e8f0] text-gray-900 ring-1 ring-gray-400',
  'AI팀': 'bg-[#c6f6d5] text-green-900 ring-1 ring-green-400',
  '기획팀': 'bg-[#e9d8fd] text-purple-900 ring-1 ring-purple-400',
  '지원팀': 'bg-[#fed7e2] text-pink-900 ring-1 ring-pink-400',
};

export const GLOBAL_TAGS = [
  { name: 'AI 핵심', color: 'bg-[#e0e7ff] text-[#312e81] ring-1 ring-[#a5b4fc]' },
  { name: 'B2B', color: 'bg-slate-100 text-slate-800 ring-1 ring-slate-300' },
  { name: '캐시카우', color: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300' },
  { name: '핵심 단계', color: 'bg-[#fee2e2] text-[#991b1b] ring-1 ring-[#fca5a5]' },
  { name: '데이터 루프', color: 'bg-[#e6fffa] text-[#134e4a] ring-1 ring-[#5eead4]' },
  { name: '결제', color: 'bg-[#fdf2f8] text-[#831843] ring-1 ring-[#f9a8d4]' },
];

export const STATUS_MAP = {
  'none': { label: '미지정', color: 'bg-gray-100 text-gray-600 ring-1 ring-gray-300 shadow-sm' },
  'in-progress': { label: '진행 중', color: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300 shadow-sm' },
  'done': { label: '완료', color: 'bg-green-100 text-green-900 font-bold ring-2 ring-green-300 shadow-md' },
};

export const PRIORITY_MAP = {
  0: { label: '없음', icon: null,  color: '', borderColor: null },
  1: { label: '낮음', icon: '🔵', color: 'text-blue-500 dark:text-blue-400', borderColor: '#22C55E' },
  2: { label: '중간', icon: '🟡', color: 'text-amber-500 dark:text-amber-400', borderColor: '#F97316' },
  3: { label: '높음', icon: '🔴', color: 'text-red-500 dark:text-red-400', borderColor: '#EF4444' },
};

export const PROJECT_TINTS = [
  {
    column: 'bg-sky-50/45 dark:bg-bg-elevated border-sky-100/80 dark:border-border-subtle',
    header: 'bg-sky-100/55 dark:bg-bg-hover',
    headerHover: 'hover:bg-sky-100/75 dark:hover:bg-bg-hover',
    body: 'bg-sky-50/25 dark:bg-bg-base/50',
  },
  {
    column: 'bg-violet-50/45 dark:bg-bg-elevated border-violet-100/80 dark:border-border-subtle',
    header: 'bg-violet-100/55 dark:bg-bg-hover',
    headerHover: 'hover:bg-violet-100/75 dark:hover:bg-bg-hover',
    body: 'bg-violet-50/25 dark:bg-bg-base/50',
  },
  {
    column: 'bg-emerald-50/45 dark:bg-bg-elevated border-emerald-100/80 dark:border-border-subtle',
    header: 'bg-emerald-100/55 dark:bg-bg-hover',
    headerHover: 'hover:bg-emerald-100/75 dark:hover:bg-bg-hover',
    body: 'bg-emerald-50/25 dark:bg-bg-base/50',
  },
  {
    column: 'bg-slate-50/45 dark:bg-bg-elevated border-slate-100/80 dark:border-border-subtle',
    header: 'bg-slate-100/55 dark:bg-bg-hover',
    headerHover: 'hover:bg-slate-100/75 dark:hover:bg-bg-hover',
    body: 'bg-slate-50/25 dark:bg-bg-base/50',
  },
];
