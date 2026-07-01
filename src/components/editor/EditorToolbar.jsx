import {
  Bold,
  CheckSquare,
  Code,
  FilePlus2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Link as LinkIcon,
  List,
  ListOrdered,
  MessageSquareQuote,
  Minus,
  Quote,
  Table2,
  ChevronRightSquare,
  Calendar,
} from 'lucide-react';

const TOOLBAR_ICONS = {
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  bullet: List,
  numbered: ListOrdered,
  todo: CheckSquare,
  quote: Quote,
  code: Code,
  table: Table2,
  divider: Minus,
  toggle: ChevronRightSquare,
  'toggle-note': MessageSquareQuote,
  'link-page': LinkIcon,
  page: FilePlus2,
  image: ImagePlus,
};

const TOOLBAR_GROUPS = [
  {
    title: '텍스트',
    items: ['h1', 'h2', 'h3', 'bullet', 'numbered', 'todo', 'bold'],
  },
  {
    title: '구조',
    items: ['quote', 'code', 'table', 'divider', 'toggle', 'toggle-note'],
  },
  {
    title: '삽입',
    items: ['link-page', 'page', 'image', 'date'],
  },
];

function ToolbarButton({ title, label, onClick, children, disabled = false, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-label={title}
      className={`inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white text-left text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-subtle dark:bg-bg-base dark:text-text-secondary dark:hover:bg-bg-hover dark:hover:text-text-primary ${
        compact
          ? 'min-w-0 px-2.5 py-1.5'
          : 'min-w-[72px] px-2.5 py-2'
      }`}
    >
      {children}
      <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-bold tracking-tight`}>{label}</span>
    </button>
  );
}

/**
 * @fileoverview Editor 상단 툴바 + 표 컨텍스트 액션 오버레이.
 *
 * Editor.jsx에서 명령 실행과 상태 관리만 담당하고, 아이콘/버튼 렌더링은 별도 컴포넌트로 분리한다.
 */
function EditorToolbar({
  editable,
  commandMap,
  runCommandById,
  insertBold,
  onLinkExistingPage,
  onAddChildPage,
  itemId,
  fileInputRef,
  onFileChange,
  onInsertDate,
  compact = false,
}) {
  if (!editable) return null;

  return (
    <div className={`relative rounded-2xl border border-gray-200 bg-gray-50 dark:border-border-subtle dark:bg-bg-elevated ${
      compact ? 'px-2 py-2' : 'px-2 py-2'
    }`}>
      <div className="flex flex-col gap-2">
        {TOOLBAR_GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            {!compact && (
              <span className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-text-tertiary">
                {group.title}
              </span>
            )}
            <div className={`flex flex-wrap items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
              {group.items.map((item) => {
                if (item === 'bold') {
                  return (
                    <ToolbarButton key={item} title="굵게" label="굵게" onClick={insertBold} compact={compact}>
                      <Bold size={15} />
                    </ToolbarButton>
                  );
                }

                if (item === 'date') {
                  if (!onInsertDate) return null;
                  return (
                    <ToolbarButton key={item} title="오늘 날짜 삽입" label="날짜" onClick={onInsertDate} compact={compact}>
                      <Calendar size={15} />
                    </ToolbarButton>
                  );
                }

                const command = commandMap[item];
                if (!command) return null;

                const Icon = TOOLBAR_ICONS[item];
                const isDisabled = (item === 'link-page' && !onLinkExistingPage)
                  || (item === 'page' && !onAddChildPage)
                  || (item === 'image' && !itemId);

                return (
                  <ToolbarButton
                    key={item}
                    title={command.label}
                    label={command.label}
                    onClick={() => runCommandById(item)}
                    disabled={isDisabled}
                    compact={compact}
                  >
                    <Icon size={15} />
                  </ToolbarButton>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        onChange={onFileChange}
      />
    </div>
  );
}

export default EditorToolbar;
