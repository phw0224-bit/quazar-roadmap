import { useState } from 'react';
import Comment from './Comment';

export default function CommentSection({
  phaseId,
  itemId,
  comments = [],
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}) {
  const [showAddComment, setShowAddComment] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;

    try {
      await onAddComment(phaseId, itemId, newCommentText);
      setNewCommentText('');
      setShowAddComment(false);
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2.5" onPointerDown={e => e.stopPropagation()}>
      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              phaseId={phaseId}
              itemId={itemId}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
            />
          ))
        ) : (
          <p className="text-[11px] text-gray-400 text-center py-2.5 m-0">댓글이 없습니다</p>
        )}
      </div>

      <div className="pt-2 border-t border-gray-50">
        {!showAddComment ? (
          <button
            className="w-full p-1.5 bg-gray-50 text-gray-500 border border-dashed border-gray-200 rounded text-[11px] font-bold transition-all hover:bg-gray-100 hover:text-gray-800 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setShowAddComment(true);
            }}
            onPointerDown={e => e.stopPropagation()}
          >
            + 댓글 추가
          </button>
        ) : (
          <div className="flex flex-col gap-1.5" onPointerDown={e => e.stopPropagation()}>
            <textarea
              className="w-full p-2 border border-gray-200 rounded text-[11px] font-sans font-bold resize-y min-h-[50px] focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
              placeholder="댓글을 입력하세요..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onPointerDown={e => e.stopPropagation()}
              onKeyDown={e => e.stopPropagation()}
              autoFocus
            />
            <div className="flex gap-1">
              <button 
                onClick={handleAddComment}
                className="flex-1 py-1.5 bg-green-600 text-white rounded text-[11px] font-bold hover:bg-green-700 cursor-pointer"
                onPointerDown={e => e.stopPropagation()}
              >
                추가
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddComment(false);
                  setNewCommentText('');
                }}
                className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded text-[11px] font-bold hover:bg-gray-400 cursor-pointer"
                onPointerDown={e => e.stopPropagation()}
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
