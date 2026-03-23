import { useState } from 'react';

export default function Comment({
  comment,
  phaseId,
  itemId,
  onUpdateComment,
  onDeleteComment,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(comment.content);

  const handleUpdateComment = async () => {
    if (!editedText.trim() || editedText === comment.content) {
      setIsEditing(false);
      return;
    }

    try {
      await onUpdateComment(phaseId, itemId, comment.id, { content: editedText });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update comment:', err);
    }
  };

  const handleDeleteComment = async () => {
    if (window.confirm('이 댓글을 삭제하시겠습니까?')) {
      try {
        await onDeleteComment(phaseId, itemId, comment.id);
      } catch (err) {
        console.error('Failed to delete comment:', err);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR');
  };

  return (
    <div className="bg-gray-50 border border-gray-100 rounded p-2 text-xs group" onPointerDown={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] text-gray-400">{formatDate(comment.created_at)}</span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-0.5 px-1 bg-white border border-gray-200 rounded text-[9px] hover:bg-gray-50 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setEditedText(comment.content);
            }}
            onPointerDown={e => e.stopPropagation()}
            title="수정"
          >
            ✏️
          </button>
          <button
            className="p-0.5 px-1 bg-white border border-gray-200 rounded text-[9px] hover:bg-red-50 hover:border-red-500 text-red-600 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteComment();
            }}
            onPointerDown={e => e.stopPropagation()}
            title="삭제"
          >
            🗑️
          </button>
        </div>
      </div>

      {!isEditing ? (
        <p className="m-0 text-gray-700 break-words leading-snug font-bold">{comment.content}</p>
      ) : (
        <div className="flex flex-col gap-1.5" onPointerDown={e => e.stopPropagation()}>
          <textarea
            className="w-full p-1.5 border border-gray-200 rounded text-[11px] font-sans font-bold resize-y min-h-[50px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            onPointerDown={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            autoFocus
          />
          <div className="flex gap-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleUpdateComment();
              }}
              onPointerDown={e => e.stopPropagation()}
              className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700 cursor-pointer"
            >
              저장
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(false);
              }}
              onPointerDown={e => e.stopPropagation()}
              className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold hover:bg-gray-300 cursor-pointer"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
