import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquarePlus, X, Loader2 } from 'lucide-react';
import Comment from './Comment';
import CommentMarkdownToolbar from './CommentMarkdownToolbar';
import { COMMENT_TEMPLATES } from '../lib/itemTemplates';
import { getCommentScaffold } from '../lib/itemTemplates';

export default function CommentSection({
  projectId,
  itemId,
  comments = [],
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onShowConfirm,
  onShowToast,
}) {
  const [showAddComment, setShowAddComment] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(140, textarea.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [newCommentText]);

  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;

    setIsSubmitting(true);
    try {
      const tags = selectedTag ? [selectedTag] : [];
      await onAddComment(projectId, itemId, newCommentText, tags);
      setNewCommentText('');
      setSelectedTag(null);
      setShowAddComment(false);
      onShowToast?.('댓글이 작성되었습니다.');
    } catch {
      onShowToast?.('댓글 작성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectTag = (tagName) => {
    setSelectedTag(tagName);
    const scaffold = getCommentScaffold(tagName);
    if (scaffold && !newCommentText.trim()) {
      setNewCommentText(scaffold);
      setTimeout(adjustTextareaHeight, 0);
    }
  };

  return (
    <div className="flex flex-col gap-6" onPointerDown={e => e.stopPropagation()}>
      <div className="flex flex-col gap-4">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              projectId={projectId}
              itemId={itemId}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
              onShowConfirm={onShowConfirm}
              onShowToast={onShowToast}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 bg-gray-50/50 dark:bg-bg-hover/20 rounded-3xl border border-dashed border-gray-200 dark:border-border-subtle">
            <MessageSquarePlus size={32} className="text-gray-300 dark:text-text-tertiary mb-3" />
            <p className="text-sm font-bold text-gray-400 dark:text-text-tertiary uppercase tracking-widest">아직 댓글이 없습니다.</p>
          </div>
        )}
      </div>

      <div className="mt-2">
        {!showAddComment ? (
          <button
            className="w-full text-left px-5 py-3.5 bg-gray-50 dark:bg-bg-elevated text-gray-400 dark:text-text-tertiary rounded-2xl text-sm font-bold hover:bg-white dark:hover:bg-bg-hover transition-all duration-200 cursor-pointer border border-gray-100 dark:border-border-subtle hover:shadow-md uppercase tracking-widest flex items-center gap-3"
            onClick={(e) => {
              e.stopPropagation();
              setShowAddComment(true);
            }}
          >
            <Send size={16} strokeWidth={3} className="text-gray-300 dark:text-text-tertiary" />
            새로운 댓글을 입력하세요...
          </button>
        ) : (
          <div className="flex flex-col gap-4 bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-2 duration-300 ease-notion">
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-black text-text-tertiary dark:text-text-tertiary uppercase tracking-[0.2em] ml-1">새 댓글</span>
              
              <div className="flex gap-2 flex-wrap">
                {Object.entries(COMMENT_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectTag(key);
                    }}
                    className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-widest rounded-lg transition-all border ${
                      selectedTag === key
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                        : 'bg-gray-50 dark:bg-bg-hover text-gray-600 dark:text-text-secondary border-gray-200 dark:border-border-subtle hover:border-gray-400 dark:hover:border-text-tertiary'
                    }`}
                  >
                    {template.label}
                  </button>
                ))}
                {selectedTag && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTag(null);
                      setNewCommentText('');
                    }}
                    className="px-2 py-1.5 text-[12px] font-bold text-gray-400 dark:text-text-tertiary hover:text-red-500 dark:hover:text-red-400 uppercase tracking-widest transition-colors"
                    title="태그 제거"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <CommentMarkdownToolbar textareaRef={textareaRef} />
              
              <textarea
                ref={textareaRef}
                className="w-full p-0 border-none rounded-lg text-sm font-bold resize-none min-h-[140px] focus:ring-0 bg-transparent text-gray-900 dark:text-text-primary placeholder:text-gray-300 dark:placeholder:text-text-tertiary overflow-hidden"
                placeholder="팀원들과 공유할 의견을 남겨주세요..."
                value={newCommentText}
                onChange={(e) => {
                  setNewCommentText(e.target.value);
                  adjustTextareaHeight();
                }}
                onKeyDown={e => e.stopPropagation()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-50 dark:border-border-subtle">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddComment(false);
                  setNewCommentText('');
                  setSelectedTag(null);
                }}
                disabled={isSubmitting}
                className="px-5 py-2 text-[13px] font-bold text-gray-400 hover:text-gray-900 dark:hover:text-text-primary transition-colors cursor-pointer uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>
              <button 
                onClick={handleAddComment}
                disabled={isSubmitting}
                className={`flex items-center gap-2 px-6 py-2 text-white rounded-xl text-[13px] font-black transition-all shadow-md uppercase tracking-widest ${
                  isSubmitting
                    ? 'bg-gray-600 dark:bg-gray-700 cursor-not-allowed opacity-70'
                    : 'bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100 hover:shadow-lg active:scale-95 cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} strokeWidth={3} className="animate-spin" />
                    작성 중...
                  </>
                ) : (
                  <>
                    <Send size={14} strokeWidth={3} />
                    댓글 작성
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
