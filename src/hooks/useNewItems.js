import { useState, useEffect, useCallback } from 'react';
import { timeAgo } from '../lib/timeUtils';

/**
 * @fileoverview 최근 24시간 내 생성된 새 아이템을 추적하는 훅.
 *
 * 사용자의 팀 보드에 새로 생성된 아이템을 감지하고,
 * 읽음 처리(localStorage)와 표시명 조합을 담당.
 *
 * @param {Array} projects - useKanbanData에서 받은 projects 배열
 * @param {String} currentBoardType - 현재 팀 보드 타입 ('main', '개발팀', 'AI팀', '지원팀')
 * @param {Boolean} isReadOnly - 비로그인 사용자 여부
 * @returns {Object} { newItems, markAsRead }
 */
export function useNewItems(projects, currentBoardType, isReadOnly) {
  const [newItemIds, setNewItemIds] = useState(new Set());

  const STORAGE_KEY = `newItems_read_${currentBoardType}`;
  const BOARD_TYPE = currentBoardType.toLowerCase() === 'main' ? 'main' : currentBoardType.toLowerCase();

  // localStorage에서 읽은 아이템 ID 불러오기
  const getReadIds = useCallback(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }, [STORAGE_KEY]);

  // 읽음 처리: localStorage에 ID 추가
  const markAsRead = useCallback((itemId) => {
    const readIds = getReadIds();
    readIds.add(itemId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(readIds)));
    setNewItemIds(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, [STORAGE_KEY, getReadIds]);

  // 모든 아이템 수집 및 필터링
  const collectNewItems = useCallback(() => {
    if (isReadOnly) return [];

    const readIds = getReadIds();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const allNewItems = [];

    // projects 배열 순회
    projects.forEach(project => {
      // 현재 보드 타입과 일치하는 프로젝트만
      if ((project.board_type || 'main') !== BOARD_TYPE) return;

      // 프로젝트 내 아이템들 순회
      if (project.items && Array.isArray(project.items)) {
        project.items.forEach(item => {
          // 칸반 카드만 (page_type이 null 또는 'task')
          if (item.page_type === 'page') return;

          // created_at이 24시간 이내인지 확인
          const itemCreatedAt = new Date(item.created_at);
          if (itemCreatedAt < twentyFourHoursAgo) return;

          // 읽지 않은 아이템만
          if (readIds.has(item.id)) return;

          allNewItems.push({
            id: item.id,
            title: item.title,
            project_id: project.id,
            project_title: project.title,
            created_at: item.created_at,
            board_type: project.board_type || 'main',
          });
        });
      }
    });

    // created_at 내림차순 정렬 (가장 최신 먼저) 후 최대 5개만
    const sorted = allNewItems
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    return sorted;
  }, [projects, isReadOnly, BOARD_TYPE, getReadIds]);

  // 초기 로드 및 projects 변경 시 업데이트
  useEffect(() => {
    const items = collectNewItems();
    const ids = new Set(items.map(item => item.id));
    setNewItemIds(ids);
  }, [projects, isReadOnly, BOARD_TYPE, collectNewItems]);

  // 표시 이름 생성 (프로젝트명/아이템명 또는 아이템명만)
  const getDisplayName = (item) => {
    if (item.project_id && item.project_title) {
      return `${item.project_title} / ${item.title}`;
    }
    return item.title;
  };

  const newItems = collectNewItems().map(item => ({
    ...item,
    displayName: getDisplayName(item),
    timeAgoText: timeAgo(item.created_at),
  }));

  return {
    newItems,
    markAsRead,
  };
}
