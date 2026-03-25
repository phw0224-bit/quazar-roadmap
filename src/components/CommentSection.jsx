import { useState } from 'react';
import { Send, MessageSquarePlus } from 'lucide-react';
import Comment from './Comment';

export default function CommentSection({
  phaseId,
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

  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;

    try {
      await onAddComment(phaseId, itemId, newCommentText);
      setNewCommentText('');
      setShowAddComment(false);
      onShowToast?.('댓글이 작성되었습니다.');
    } catch {
      onShowToast?.('댓글 작성에 실패했습니다.');
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
              phaseId={phaseId}
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
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] ml-1">New Comment</span>
              <textarea
                className="w-full p-0 border-none rounded-lg text-sm font-bold resize-none min-h-[100px] focus:ring-0 bg-transparent text-gray-900 dark:text-text-primary placeholder:text-gray-300 dark:placeholder:text-text-tertiary"
                placeholder="팀원들과 공유할 의견을 남겨주세요..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
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
                }}
                className="px-5 py-2 text-[13px] font-bold text-gray-400 hover:text-gray-900 dark:hover:text-text-primary transition-colors cursor-pointer uppercase tracking-widest"
              >
                취소
              </button>
              <button 
                onClick={handleAddComment}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-xl text-[13px] font-black hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer uppercase tracking-widest"
              >
                <Send size={14} strokeWidth={3} />
                댓글 작성
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
