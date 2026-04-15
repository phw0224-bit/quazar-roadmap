import { useState } from 'react';
import { Edit2, Trash2, CornerDownRight } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';

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
  const moodEmoji = comment.profiles?.customization?.moodEmoji || comment.profiles?.customization?.mood_emoji || '';

  return (
    <div className="group flex flex-col gap-2 transition-all duration-300 ease-notion p-4 rounded-2xl hover:bg-gray-50/50 dark:hover:bg-bg-hover/30 border border-transparent hover:border-gray-100 dark:hover:border-border-subtle" onPointerDown={e => e.stopPropagation()}>
      <div className="flex items-center gap-3">
        <ProfileAvatar
          name={userName}
          customization={comment.profiles?.customization}
          size="sm"
          showMood={false}
          className="shrink-0"
        />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-gray-900 dark:text-text-primary truncate">{userName}</span>
            {moodEmoji && <span className="text-sm leading-none">{moodEmoji}</span>}
            <span className="text-[11px] font-black text-gray-400 dark:text-text-tertiary uppercase tracking-widest">{userDept}</span>
          </div>
          <span className="text-[11px] font-bold text-gray-300 dark:text-text-tertiary uppercase tracking-widest leading-none mt-0.5">{formatDate(comment.created_at)}</span>
        </div>
        
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 ml-auto">
          <button
            className="p-2 hover:bg-white dark:hover:bg-bg-hover rounded-lg text-gray-400 dark:text-text-tertiary hover:text-brand-500 dark:hover:text-brand-400 transition-all cursor-pointer shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-border-subtle"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setEditedText(comment.content);
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
      </div>

      <div className="pl-12">
        {!isEditing ? (
          <p className="m-0 text-sm font-medium text-gray-700 dark:text-text-secondary break-words leading-relaxed">
            {comment.content}
          </p>
        ) : (
          <div className="flex flex-col gap-3 bg-white dark:bg-bg-base border border-gray-200 dark:border-border-subtle rounded-2xl p-4 shadow-xl animate-in zoom-in-95 duration-200">
            <textarea
              className="w-full p-0 border-none rounded-lg text-sm font-bold resize-none min-h-[80px] focus:ring-0 bg-transparent text-gray-900 dark:text-text-primary"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              autoFocus
            />
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
