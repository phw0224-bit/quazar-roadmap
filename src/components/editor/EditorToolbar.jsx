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
} from 'lucide-react';

const TOOLBAR_COMMAND_IDS = [
  'h1',
  'h2',
  'h3',
  'bullet',
  'numbered',
  'todo',
  'quote',
  'code',
  'table',
  'divider',
  'toggle',
  'toggle-note',
  'link-page',
  'page',
  'image',
];

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

function ToolbarButton({ title, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-subtle dark:bg-bg-base dark:text-text-secondary dark:hover:bg-bg-hover dark:hover:text-text-primary"
    >
      {children}
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
}) {
  if (!editable) return null;

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-gray-50 px-2 py-2 dark:border-border-subtle dark:bg-bg-elevated">
      <div className="flex flex-wrap items-center gap-1">
        {TOOLBAR_COMMAND_IDS.map((commandId) => {
          const command = commandMap[commandId];
          const Icon = TOOLBAR_ICONS[commandId];
          const isDisabled = (commandId === 'link-page' && !onLinkExistingPage)
            || (commandId === 'page' && !onAddChildPage)
            || (commandId === 'image' && !itemId);

          return (
            <ToolbarButton
              key={commandId}
              title={command.label}
              onClick={() => runCommandById(commandId)}
              disabled={isDisabled}
            >
              <Icon size={15} />
            </ToolbarButton>
          );
        })}
        <ToolbarButton title="굵게" onClick={insertBold}>
          <Bold size={15} />
        </ToolbarButton>
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
