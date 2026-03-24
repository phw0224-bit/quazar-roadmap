import { useState } from 'react';
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
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  return (
    <div className="flex flex-col gap-4" onPointerDown={e => e.stopPropagation()}>
      <div className="flex flex-col gap-3">
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
          <p className="text-[13px] text-gray-400 dark:text-gray-500 py-2">아직 댓글이 없습니다.</p>
        )}
      </div>

      <div className="pt-2">
        {!showAddComment ? (
          <button
            className="w-full text-left px-3 py-2 bg-gray-50 dark:bg-[#242424] text-gray-400 dark:text-gray-500 rounded-lg text-[13px] font-medium hover:bg-gray-100 dark:hover:bg-[#2b2b2b] transition-colors cursor-pointer border border-gray-100 dark:border-[#323232]"
            onClick={(e) => {
              e.stopPropagation();
              setShowAddComment(true);
            }}
          >
            댓글 추가...
          </button>
        ) : (
          <div className="flex flex-col gap-2 bg-gray-50 dark:bg-[#242424] border border-gray-200 dark:border-[#343434] rounded-lg p-3 shadow-sm">
            <textarea
              className="w-full p-0 border-none rounded text-[13px] font-medium resize-none min-h-[60px] focus:ring-0 bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="댓글을 입력하세요..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-50 dark:border-[#2f2f2f]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddComment(false);
                  setNewCommentText('');
                }}
                className="px-3 py-1.5 text-gray-400 dark:text-gray-300 rounded-md text-[12px] font-black hover:bg-gray-50 dark:hover:bg-[#2b2b2b] transition-colors cursor-pointer"
              >
                취소
              </button>
              <button 
                onClick={handleAddComment}
                className="px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white rounded-md text-[12px] font-black hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors cursor-pointer shadow-sm shadow-blue-200 dark:shadow-blue-900/40"
              >
                댓글 작성
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
