/**
 * @fileoverview 댓글용 경량 마크다운 도구모음
 * 
 * 필수 기능: 글머리, 오늘 날짜, 표, 체크박스
 */

import {
  Bold,
  Calendar,
  CheckSquare,
  Code,
  Heading1,
  List,
  ListOrdered,
  Quote,
  Table2,
} from 'lucide-react';
import { 
  insertBlockquote,
  insertBulletList, 
  insertCodeBlock,
  insertHeading,
  insertOrderedList,
  insertToday, 
  insertTable, 
  insertCheckbox,
  wrapBold,
} from '../lib/markdownHelpers';

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
 * 댓글 마크다운 도구모음
 * @param {Object} props
 * @param {React.RefObject<HTMLTextAreaElement>} props.textareaRef - textarea ref
 */
const TOOLBAR_ACTIONS = [
  { key: 'bold', label: '굵게', Icon: Bold, run: wrapBold },
  { key: 'heading', label: '제목', Icon: Heading1, run: (textarea) => insertHeading(textarea, 1) },
  { key: 'bullet', label: '목록', Icon: List, run: insertBulletList },
  { key: 'ordered', label: '번호', Icon: ListOrdered, run: insertOrderedList },
  { key: 'checkbox', label: '체크', Icon: CheckSquare, run: insertCheckbox },
  { key: 'quote', label: '인용', Icon: Quote, run: insertBlockquote },
  { key: 'code', label: '코드', Icon: Code, run: insertCodeBlock },
  { key: 'table', label: '표', Icon: Table2, run: insertTable },
  { key: 'today', label: '날짜', Icon: Calendar, run: insertToday },
];

export default function CommentMarkdownToolbar({ textareaRef }) {
  const runAction = (action) => {
    if (textareaRef.current) {
      action.run(textareaRef.current);
      textareaRef.current.focus();
    }
  };

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {TOOLBAR_ACTIONS.map((action) => (
        <ToolbarButton key={action.key} title={action.label} onClick={() => runAction(action)}>
          <span className="inline-flex items-center gap-1.5">
            <action.Icon size={15} />
            <span className="text-[11px] font-bold">{action.label}</span>
          </span>
        </ToolbarButton>
      ))}
    </div>
  );
}
