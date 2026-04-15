/**
 * @fileoverview 개인 메모장 뷰. Apple Notes 스타일 그리드 레이아웃.
 *
 * 특징:
 * - 비공개: 로그인한 본인만 접근 가능
 * - 그리드 타일: 제목 + 미리보기 + 작성일
 * - 검색/필터/정렬: 키워드 검색, 최신순/오래된순/제목순
 * - 반응형: 모바일 1열 → 데스크탑 4열
 */
import { useState, useMemo } from 'react';
import { Plus, Search, SortDesc } from 'lucide-react';
import MemoGridCard from './MemoGridCard';

function PersonalMemoBoard({
  memos = [],
  onAddMemo,
  onUpdateMemo,
  onDeleteMemo,
  onOpenDetail,
  onShowConfirm,
  onShowToast,
  onShowPrompt,
  isReadOnly = false,
  loading = false,
}) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortBy, setSortBy] = useState('updated_desc'); // updated_desc, updated_asc, title_asc

  // 검색/정렬 필터링
  const filteredMemos = useMemo(() => {
    let result = [...(memos || [])];

    // 검색 필터
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      result = result.filter(memo => {
        const title = (memo.title || '').toLowerCase();
        const content = (memo.description || '').replace(/<[^>]*>/g, '').toLowerCase();
        return title.includes(keyword) || content.includes(keyword);
      });
    }

    // 정렬
    result.sort((a, b) => {
      if (sortBy === 'updated_desc') {
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      } else if (sortBy === 'updated_asc') {
        return new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at);
      } else if (sortBy === 'title_asc') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });

    return result;
  }, [memos, searchKeyword, sortBy]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 dark:border-border-subtle bg-white/80 dark:bg-bg-elevated/80 px-4 py-3 text-sm font-semibold text-gray-500 dark:text-text-secondary">
          <div className="h-4 w-4 rounded-full border-2 border-gray-200 dark:border-border-subtle border-t-gray-500 dark:border-t-text-secondary animate-spin" />
          <span>개인 메모 로드 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-bg-base transition-all duration-300 flex flex-col">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white dark:bg-bg-base border-b border-gray-200 dark:border-border-subtle px-10 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="text-4xl filter drop-shadow-sm">📝</div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight">개인 메모장</h2>
              <p className="text-sm font-bold text-gray-400 dark:text-text-tertiary mt-1">
                오직 나만 접근 가능한 개인 메모 공간 ({memos.length}개)
              </p>
            </div>
          </div>

          {!isReadOnly && (
            <button
              onClick={() =>
                onShowPrompt('새 메모 추가', '메모 제목을 입력하세요', (title) => {
                  if (title) {
                    onAddMemo?.(title, '');
                    onShowToast?.(`'${title}' 메모가 생성되었습니다.`);
                  }
                })
              }
              className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-black dark:hover:bg-gray-100 transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Plus size={18} strokeWidth={3} />
              새 메모 추가
            </button>
          )}
        </div>

        {/* 검색 + 정렬 */}
        <div className="flex items-center gap-3">
          {/* 검색바 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-text-tertiary" size={18} />
            <input
              type="text"
              placeholder="제목 또는 내용 검색..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="
                w-full
                pl-10 pr-4 py-2.5
                bg-gray-50 dark:bg-bg-elevated
                border border-gray-200 dark:border-border-subtle
                rounded-lg
                text-sm
                text-gray-900 dark:text-text-primary
                placeholder:text-gray-400 dark:placeholder:text-text-tertiary
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:focus:ring-brand-400/30
                transition-all
              "
            />
          </div>

          {/* 정렬 드롭다운 */}
          <div className="relative">
            <SortDesc className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-text-tertiary pointer-events-none" size={18} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="
                pl-10 pr-8 py-2.5
                bg-gray-50 dark:bg-bg-elevated
                border border-gray-200 dark:border-border-subtle
                rounded-lg
                text-sm font-medium
                text-gray-900 dark:text-text-primary
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:focus:ring-brand-400/30
                cursor-pointer
                transition-all
                appearance-none
              "
            >
              <option value="updated_desc">최신순</option>
              <option value="updated_asc">오래된순</option>
              <option value="title_asc">제목순</option>
            </select>
          </div>
        </div>
      </div>

      {/* 그리드 또는 빈 상태 */}
      <div className="flex-1 px-10 py-8">
        {filteredMemos.length === 0 ? (
          <div className="flex-1 flex items-center justify-center min-h-[50vh]">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-gray-100 dark:bg-bg-elevated rounded-2xl flex items-center justify-center text-4xl mb-6">
                {searchKeyword ? '🔍' : '📭'}
              </div>
              <p className="text-gray-400 dark:text-text-tertiary font-black text-xl mb-4">
                {searchKeyword ? '검색 결과가 없습니다.' : '아직 메모가 없습니다.'}
              </p>
              <p className="text-gray-400 dark:text-text-tertiary font-bold mb-6">
                {searchKeyword ? '다른 키워드로 검색해 보세요.' : '개인 메모를 추가하여 생각을 정리하세요.'}
              </p>
              {!isReadOnly && !searchKeyword && (
                <button
                  onClick={() =>
                    onShowPrompt('새 메모 추가', '메모 제목을 입력하세요', (title) => {
                      if (title) {
                        onAddMemo?.(title, '');
                        onShowToast?.(`'${title}' 메모가 생성되었습니다.`);
                      }
                    })
                  }
                  className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-black uppercase tracking-widest hover:bg-black dark:hover:bg-gray-100 transition-all shadow-md flex items-center gap-2"
                >
                  <Plus size={18} strokeWidth={3} />
                  첫 메모 만들기
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMemos.map((memo) => (
              <MemoGridCard
                key={memo.id}
                memo={memo}
                onOpenDetail={onOpenDetail}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PersonalMemoBoard;
