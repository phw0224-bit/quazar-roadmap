import { useState } from 'react';

export default function Comment({
  comment,
  phaseId,
  itemId,
  onUpdateComment,
  onDeleteComment,
  onShowConfirm,
  onShowToast,
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
      onShowToast?.('댓글이 수정되었습니다.');
    } catch (err) {
      console.error('Failed to update comment:', err);
    }
  };

  const handleDeleteComment = async () => {
    onShowConfirm?.('댓글 삭제', '이 댓글을 정말 삭제하시겠습니까?', async () => {
      try {
        await onDeleteComment(phaseId, itemId, comment.id);
        onShowToast?.('댓글이 삭제되었습니다.');
      } catch (err) {
        console.error('Failed to delete comment:', err);
      }
    });
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

  const userName = comment.profiles?.name || '익명 사용자';
  const userDept = comment.profiles?.department ? ` (${comment.profiles.department})` : '';

  return (
    <div className="group flex flex-col gap-1 transition-all" onPointerDown={e => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center text-[11px] font-black text-gray-600 dark:text-[#A9B8C8] uppercase shadow-inner border border-gray-50 dark:border-[#343434]">
          {userName.charAt(0)}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-black text-gray-900 dark:text-gray-100">{userName}</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold">{userDept}</span>
          </div>
          <span className="text-[10px] text-gray-300 dark:text-gray-500 font-bold leading-none">{formatDate(comment.created_at)}</span>
        </div>
        
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
          <button
            className="p-1 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setEditedText(comment.content);
            }}
            title="수정"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button
            className="p-1 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteComment();
            }}
            title="삭제"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </div>

      <div className="pl-9 mt-0.5">
        {!isEditing ? (
          <p className="m-0 text-[14px] text-gray-700 dark:text-gray-200 break-words leading-relaxed font-medium tracking-tight">
            {comment.content}
          </p>
        ) : (
          <div className="flex flex-col gap-2 bg-gray-50 dark:bg-[#242424] border border-gray-200 dark:border-[#343434] rounded-lg p-3 shadow-inner">
            <textarea
              className="w-full p-0 border-none rounded text-[14px] font-medium resize-none min-h-[60px] focus:ring-0 bg-transparent text-gray-800 dark:text-gray-200"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(false);
                }}
                className="px-2 py-1 text-gray-400 dark:text-gray-300 rounded text-[11px] font-black hover:bg-white dark:hover:bg-[#2b2b2b] transition-colors cursor-pointer"
              >
                취소
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpdateComment();
                }}
                className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-black hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
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
