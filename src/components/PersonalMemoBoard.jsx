/**
 * @fileoverview 개인 메모장 뷰. is_private=true인 아이템을 칸반 형식으로 관리.
 *
 * 특징:
 * - 비공개: 로그인한 본인만 접근 가능
 * - 간단한 칸반: 상태(미지정/진행중/완료)로만 분류
 * - 빠른 작성: + 버튼으로 즉시 새 메모 추가
 */
import { useState } from 'react';
import { Plus, Trash2, ArrowUpRight } from 'lucide-react';
import ProjectColumn from './ProjectColumn';
import KanbanCard from './KanbanCard';
import { STATUS_MAP } from '../lib/constants';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';

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
  const stopProp = (e) => e.stopPropagation();

  // 상태별로 메모 분류
  const memosAsPhase = {
    id: 'personal-memo',
    title: '개인 메모장',
    board_type: 'personal',
    items: memos || [],
  };

  const projectColumnProps = {
    onAddItem: onAddMemo,
    onUpdateItem: onUpdateMemo,
    onDeleteItem: onDeleteMemo,
    onOpenDetail,
    onShowConfirm,
    onShowToast,
    isReadOnly,
  };

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
    <div className="flex-1 overflow-x-auto overflow-y-auto pt-10 pb-10 pl-10 pr-10 custom-scrollbar bg-white dark:bg-bg-base transition-all duration-300 flex flex-col gap-12">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl filter drop-shadow-sm">📝</div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-text-primary tracking-tight">개인 메모장</h2>
            <p className="text-sm font-bold text-gray-400 dark:text-text-tertiary mt-1">
              오직 나만 접근 가능한 개인 용 메모 공간
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
            className="px-6 py-3 bg-blue-500 dark:bg-blue-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-600 dark:hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Plus size={18} strokeWidth={3} />
            새 메모 추가
          </button>
        )}
      </div>

      {/* 칸반 뷰 */}
      {memos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-gray-100 dark:bg-bg-elevated rounded-2xl flex items-center justify-center text-4xl mb-6">
              📭
            </div>
            <p className="text-gray-400 dark:text-text-tertiary font-black text-xl mb-4">
              아직 메모가 없습니다.
            </p>
            <p className="text-gray-400 dark:text-text-tertiary font-bold mb-6">
              개인 메모를 추가하여 생각을 정리하세요.
            </p>
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
                className="px-8 py-3 bg-blue-500 dark:bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-600 dark:hover:bg-blue-700 transition-all shadow-md flex items-center gap-2"
              >
                <Plus size={18} strokeWidth={3} />
                첫 메모 만들기
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-12 overflow-x-auto py-3 pb-6 custom-scrollbar min-h-[350px] px-2">
          <SortableContext
            items={memos.map((m) => m.id)}
            strategy={horizontalListSortingStrategy}
          >
            <ProjectColumn
              phase={memosAsPhase}
              phaseIndex={1}
              {...projectColumnProps}
            />
          </SortableContext>
        </div>
      )}
    </div>
  );
}

export default PersonalMemoBoard;
