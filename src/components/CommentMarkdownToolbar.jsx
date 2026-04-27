/**
 * @fileoverview 댓글용 경량 마크다운 도구모음
 * 
 * 필수 기능: 글머리, 오늘 날짜, 표, 체크박스
 */

import { List, Calendar, Table2, CheckSquare } from 'lucide-react';
import { 
  insertBulletList, 
  insertToday, 
  insertTable, 
  insertCheckbox 
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
export default function CommentMarkdownToolbar({ textareaRef }) {
  const handleBulletList = () => {
    if (textareaRef.current) {
      insertBulletList(textareaRef.current);
      textareaRef.current.focus();
    }
  };

  const handleToday = () => {
    if (textareaRef.current) {
      insertToday(textareaRef.current);
      textareaRef.current.focus();
    }
  };

  const handleTable = () => {
    if (textareaRef.current) {
      insertTable(textareaRef.current);
      textareaRef.current.focus();
    }
  };

  const handleCheckbox = () => {
    if (textareaRef.current) {
      insertCheckbox(textareaRef.current);
      textareaRef.current.focus();
    }
  };

  return (
    <div className="mb-2 flex gap-2">
      <ToolbarButton title="글머리 목록" onClick={handleBulletList}>
        <List size={15} />
      </ToolbarButton>
      <ToolbarButton title="오늘 날짜" onClick={handleToday}>
        <Calendar size={15} />
      </ToolbarButton>
      <ToolbarButton title="표" onClick={handleTable}>
        <Table2 size={15} />
      </ToolbarButton>
      <ToolbarButton title="체크박스" onClick={handleCheckbox}>
        <CheckSquare size={15} />
      </ToolbarButton>
    </div>
  );
}
