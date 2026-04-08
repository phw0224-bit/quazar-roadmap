/**
 * @fileoverview 개인 메모장 그리드 타일 카드 컴포넌트.
 * 
 * 특징:
 * - 제목 + 콘텐츠 미리보기(100자, HTML 제거) + 작성일
 * - 호버 시 그림자 효과
 * - 클릭 시 ItemDetailPanel 열기
 */
import { Calendar } from 'lucide-react';

function MemoGridCard({ memo, onOpenDetail, isReadOnly = false }) {
  // HTML 태그 제거 및 미리보기 텍스트 추출
  const getPreviewText = (html = '') => {
    if (!html) return '내용 없음';
    const text = html.replace(/<[^>]*>/g, '').trim();
    return text.length > 100 ? text.substring(0, 100) + '...' : text || '내용 없음';
  };

  // 날짜 포맷팅
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `오늘 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return '어제';
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
    }
  };

  const preview = getPreviewText(memo.description);
  const dateLabel = formatDate(memo.updated_at || memo.created_at);

  return (
    <div
      onClick={() => onOpenDetail?.(memo.id)}
      className="
        group
        bg-white dark:bg-bg-elevated
        border border-gray-200 dark:border-border-subtle
        rounded-xl
        p-4
        cursor-pointer
        transition-all duration-200
        hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-black/20
        hover:border-gray-300 dark:hover:border-border-base
        hover:-translate-y-0.5
        flex flex-col gap-3
        min-h-[160px]
      "
    >
      {/* 제목 */}
      <h3 className="
        text-base font-bold
        text-gray-900 dark:text-text-primary
        line-clamp-2
        leading-tight
      ">
        {memo.title || '제목 없음'}
      </h3>

      {/* 미리보기 */}
      <p className="
        text-sm
        text-gray-500 dark:text-text-secondary
        line-clamp-3
        leading-relaxed
        flex-1
      ">
        {preview}
      </p>

      {/* 날짜 */}
      {dateLabel && (
        <div className="
          flex items-center gap-1.5
          text-xs
          text-gray-400 dark:text-text-tertiary
          font-medium
        ">
          <Calendar size={12} />
          <span>{dateLabel}</span>
        </div>
      )}
    </div>
  );
}

export default MemoGridCard;
