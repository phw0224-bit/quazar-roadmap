import { useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, Github, ExternalLink, Eye, PenSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ProfileAvatar from './ProfileAvatar';
import CommentMarkdownToolbar from './CommentMarkdownToolbar';
import MarkdownPreview from './editor/MarkdownPreview';

function normalizeHttpUrl(value) {
  const normalized = `${value || ''}`.trim();
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeGitHubPageUrl(value) {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    return parsed.hostname === 'github.com' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function resolveGitHubReviewCommentUrl(comment) {
  const directUrl = normalizeGitHubPageUrl(comment.source_url)
    || normalizeGitHubPageUrl(comment.source_metadata?.review_url)
    || normalizeGitHubPageUrl(comment.source_metadata?.pull_url);
  if (directUrl) {
    return directUrl;
  }

  const repoFullName = `${comment.source_metadata?.repo_full_name || ''}`.trim();
  const pullNumber = Number.isInteger(comment.source_metadata?.pull_number)
    ? comment.source_metadata.pull_number
    : null;
  const reviewId = Number.isInteger(comment.source_metadata?.review_id)
    ? comment.source_metadata.review_id
    : null;

  if (repoFullName && pullNumber && reviewId) {
    return `https://github.com/${repoFullName}/pull/${pullNumber}#pullrequestreview-${reviewId}`;
  }

  return directUrl;
}

export default function Comment({
  comment,
  projectId,
  itemId,
  onUpdateComment,
  onDeleteComment,
  onShowConfirm,
  onShowToast,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(comment.content);
  const [editMode, setEditMode] = useState('write');
  const editTextareaRef = useRef(null);
  const isGitHubReviewComment = comment.source === 'github_review';

  const adjustEditTextareaHeight = () => {
    const textarea = editTextareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(100, textarea.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    if (isEditing) {
      setTimeout(adjustEditTextareaHeight, 0);
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) {
      adjustEditTextareaHeight();
    }
  }, [editedText, isEditing]);

  const handleUpdateComment = async () => {
    if (!editedText.trim() || editedText === comment.content) {
      setIsEditing(false);
      return;
    }

    try {
      await onUpdateComment(projectId, itemId, comment.id, { content: editedText });
      setIsEditing(false);
      onShowToast?.('댓글이 수정되었습니다.');
    } catch {
      onShowToast?.('댓글 수정에 실패했습니다.');
    }
  };

  const handleDeleteComment = async () => {
    onShowConfirm?.('댓글 삭제', '이 댓글을 정말 삭제하시겠습니까?', async () => {
      try {
        await onDeleteComment(projectId, itemId, comment.id);
        onShowToast?.('댓글이 삭제되었습니다.');
      } catch {
        onShowToast?.('댓글 삭제에 실패했습니다.');
      }
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return { date: `${year}.${month}.${day}`, time: `${hours}:${minutes}` };
  };

  const userName = isGitHubReviewComment
    ? comment.source_metadata?.reviewer_name || comment.source_metadata?.reviewer_login || 'GitHub Reviewer'
    : comment.profiles?.name || '익명 사용자';
  const userDept = comment.profiles?.department ? ` (${comment.profiles.department})` : '';
  const moodEmoji = comment.profiles?.customization?.moodEmoji || comment.profiles?.customization?.mood_emoji || '';
  const reviewStateLabel = comment.source_metadata?.review_state_label || 'Review';
  const reviewUrl = isGitHubReviewComment ? resolveGitHubReviewCommentUrl(comment) : null;

  return (
    <div className="group flex flex-col gap-2 transition-all duration-300 ease-notion p-4 rounded-2xl hover:bg-gray-50/50 dark:hover:bg-bg-hover/30 border border-transparent hover:border-gray-100 dark:hover:border-border-subtle" onPointerDown={e => e.stopPropagation()}>
      <div className="flex items-center gap-3">
        <ProfileAvatar
          name={userName}
          customization={isGitHubReviewComment ? null : comment.profiles?.customization}
          size="sm"
          showMood={false}
          className="shrink-0"
        />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-gray-900 dark:text-text-primary truncate">{userName}</span>
            {!isGitHubReviewComment && moodEmoji && <span className="text-sm leading-none">{moodEmoji}</span>}
            {isGitHubReviewComment ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-white dark:bg-white dark:text-gray-900">
                  <Github size={10} strokeWidth={3} />
                  {reviewStateLabel}
                </span>
                {reviewUrl && (
                  <a
                    href={reviewUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-gray-900 dark:border-border-subtle dark:text-text-tertiary dark:hover:text-text-primary"
                  >
                    <ExternalLink size={10} strokeWidth={3} />
                    원문
                  </a>
                )}
              </>
            ) : (
              <span className="text-[11px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-widest">{userDept}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-bold text-gray-500 dark:text-text-secondary">{formatDate(comment.created_at).date}</span>
            <span className="text-[11px] font-bold text-gray-400 dark:text-text-tertiary">•</span>
            <span className="text-sm font-bold text-gray-500 dark:text-text-secondary">{formatDate(comment.created_at).time}</span>
          </div>
        </div>
        
        {!isGitHubReviewComment && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 ml-auto">
            <button
              className="p-2 hover:bg-white dark:hover:bg-bg-hover rounded-lg text-gray-400 dark:text-text-tertiary hover:text-brand-500 dark:hover:text-brand-400 transition-all cursor-pointer shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-border-subtle"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
                setEditedText(comment.content);
                setEditMode('write');
              }}
              title="수정"
            >
              <Edit2 size={12} strokeWidth={3} />
            </button>
            <button
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 dark:text-text-tertiary hover:text-red-500 dark:hover:text-red-400 transition-all cursor-pointer shadow-sm border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteComment();
              }}
              title="삭제"
            >
              <Trash2 size={12} strokeWidth={3} />
            </button>
          </div>
        )}
      </div>

      <div className="pl-12">
        {!isEditing ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-text-secondary break-words leading-relaxed [&>*]:my-0 [&>p]:text-sm [&>p]:font-medium [&>p]:whitespace-pre-wrap [&>ul]:my-1 [&>ol]:my-1 [&>li]:text-sm [&>li]:font-medium [&>code]:bg-gray-100 [&>code]:dark:bg-bg-hover [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>pre]:bg-gray-100 [&>pre]:dark:bg-bg-hover [&>pre]:p-2 [&>pre]:rounded [&>pre]:overflow-x-auto [&_code]:text-xs [&_strong]:font-bold [&_em]:italic">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
              a: ({ ...props }) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="cursor-pointer text-brand-500 dark:text-brand-400 hover:underline"
                />
              ),
              code: ({ inline, ...props }) => {
                if (inline) {
                  return <code {...props} className="bg-gray-100 dark:bg-bg-hover px-1 py-0.5 rounded text-xs" />;
                }
                return <code {...props} />;
              },
              blockquote: ({ ...props }) => <blockquote {...props} className="border-l-2 border-gray-300 dark:border-border-subtle pl-3 italic text-gray-600 dark:text-text-tertiary my-1" />,
              hr: ({ ...props }) => <hr {...props} className="my-2 border-gray-200 dark:border-border-subtle" />,
              table: ({ ...props }) => <table {...props} className="w-full border-collapse border border-gray-200 dark:border-border-subtle text-xs" />,
              th: ({ ...props }) => <th {...props} className="border border-gray-200 dark:border-border-subtle bg-gray-100 dark:bg-bg-hover p-1" />,
              td: ({ ...props }) => <td {...props} className="border border-gray-200 dark:border-border-subtle p-1" />,
            }}>
              {comment.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col gap-3 bg-white dark:bg-bg-base border border-gray-200 dark:border-border-subtle rounded-2xl p-4 shadow-xl animate-in zoom-in-95 duration-200">
            <CommentMarkdownToolbar textareaRef={editTextareaRef} />
            <div className="flex items-center gap-1 self-start rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-border-subtle dark:bg-bg-hover/40">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditMode('write');
                  editTextareaRef.current?.focus();
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-widest ${
                  editMode === 'write'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-bg-elevated dark:text-text-primary'
                    : 'text-gray-500 dark:text-text-secondary'
                }`}
              >
                <PenSquare size={12} />
                작성
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditMode('preview');
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-widest ${
                  editMode === 'preview'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-bg-elevated dark:text-text-primary'
                    : 'text-gray-500 dark:text-text-secondary'
                }`}
              >
                <Eye size={12} />
                미리보기
              </button>
            </div>
            {editMode === 'write' ? (
              <textarea
                ref={editTextareaRef}
                className="w-full p-0 border-none rounded-lg text-sm font-bold resize-none min-h-[120px] focus:ring-0 bg-transparent text-gray-900 dark:text-text-primary overflow-hidden"
                value={editedText}
                onChange={(e) => {
                  setEditedText(e.target.value);
                  adjustEditTextareaHeight();
                }}
                onKeyDown={e => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <MarkdownPreview
                content={editedText || '_미리볼 내용이 없습니다._'}
                className="min-h-[120px] rounded-2xl border-dashed bg-gray-50/70 text-sm shadow-none dark:bg-bg-hover/10"
              />
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-50 dark:border-border-subtle">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(false);
                }}
                className="px-4 py-1.5 text-[13px] font-bold text-gray-400 hover:text-gray-900 dark:hover:text-text-primary transition-colors cursor-pointer uppercase tracking-widest"
              >
                취소
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpdateComment();
                }}
                className="px-5 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-[13px] font-black hover:bg-black dark:hover:bg-gray-100 transition-all shadow-md cursor-pointer uppercase tracking-widest active:scale-95"
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
