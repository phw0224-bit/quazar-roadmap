/**
 * @fileoverview 아이템 상세 패널의 Markdown description 전용 섹션.
 *
 * 라이브/원문/미리보기 모드, AI 요약, 위키링크 열기, 기존 페이지 연결 모달을 한 곳에서 관리해
 * ItemDetailPanel이 본문 편집 구현 세부사항을 직접 들고 있지 않도록 분리한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Code2,
  Eye,
  FileText,
  LayoutTemplate,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import MarkdownEditor from './editor/Editor';
import MarkdownPreview from './editor/MarkdownPreview';
import SearchModal from './SearchModal';
import { summarizeContent } from '../api/summarizeAPI';
import { getInitialDescriptionMode } from './itemDescriptionMode';
import { toggleMarkdownTaskItem } from './editor/utils/markdownPreview';
import {
  convertMarkdownToEditorHTML,
  isLikelyHTML,
  normalizeDescriptionSource,
} from './editor/utils/markdownTransform';

import { ENTITY_TYPES } from '../lib/entityModel';

export default function ItemDescriptionSection({
  item,
  projectId,
  allItems = [],
  isReadOnly,
  entityContext = null,
  onEditingChange,
  onOpenDetail,
  onShowToast,
  onUpdateItem,
  onAddChildPage,
  onShowPrompt,
  editorViewRef,
  onEditorUpdate,
}) {
  const [description, setDescription] = useState(normalizeDescriptionSource(item?.description || ''));
  const [descriptionMode, setDescriptionMode] = useState(() => getInitialDescriptionMode({
    isReadOnly,
    description: item?.description || '',
  }));
  const [aiSummary, setAiSummary] = useState(item?.ai_summary || null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const linkCallbackRef = useRef(null);
  const descriptionRef = useRef(null);

  const isMemo = entityContext?.type === ENTITY_TYPES.MEMO;

  useEffect(() => {
    setDescription(normalizeDescriptionSource(item?.description || ''));
    setDescriptionMode(getInitialDescriptionMode({
      isReadOnly,
      description: item?.description || '',
    }));
    setAiSummary(item?.ai_summary || null);
    setSummaryError(null);
    setIsEditorFocused(false);
  }, [isReadOnly, item]);

  useEffect(() => {
    if (!descriptionRef.current) return;
    const blocks = descriptionMode === 'preview'
      ? descriptionRef.current.querySelectorAll('h1, h2, h3, h4, p, li')
      : descriptionRef.current.querySelectorAll('.cm-line');
    blocks.forEach((block, index) => {
      block.id = `ai-block-${index + 1}`;
    });
  }, [description, descriptionMode]);

  const showEditorPane = !isReadOnly && (descriptionMode === 'live' || descriptionMode === 'source');
  const showPreviewPane = isReadOnly || descriptionMode === 'preview';

  useEffect(() => {
    onEditingChange?.(showEditorPane && isEditorFocused);
  }, [isEditorFocused, onEditingChange, showEditorPane]);

  useEffect(() => () => {
    onEditingChange?.(false);
  }, [onEditingChange]);

  const handleDescriptionBlur = async () => {
    const originalDescription = normalizeDescriptionSource(item.description || '');
    if (description === originalDescription) return;
    await onUpdateItem(projectId, item.id, { description });
  };

  const handleLinkExistingPage = useCallback((callback) => {
    linkCallbackRef.current = callback;
    setShowLinkModal(true);
  }, []);

  const handleLinkSelect = async (itemId) => {
    const itemToLink = allItems.find((candidate) => candidate.id === itemId);
    if (itemToLink) {
      linkCallbackRef.current?.(itemToLink);

      const currentRelations = item.related_items || [];
      if (!currentRelations.includes(itemId) && item.id !== itemId) {
        await onUpdateItem(projectId, item.id, { related_items: [...currentRelations, itemId] });
        onShowToast?.('연관 업무가 추가되었습니다.');
      }
    } else {
      linkCallbackRef.current?.(null);
    }

    setShowLinkModal(false);
    linkCallbackRef.current = null;
  };

  const renderWithCitations = useCallback((text) => {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, index) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (!match) return <span key={index}>{part}</span>;

      const citation = Number.parseInt(match[1], 10);
      return (
        <button
          key={index}
          type="button"
          onClick={() => {
            const element = document.getElementById(`ai-block-${citation}`);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          title={`본문 [${citation}] 섹션으로 이동`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-violet-200 bg-violet-100 text-[10px] font-black text-violet-600 transition-colors hover:bg-violet-200 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-400 dark:hover:bg-violet-800/50"
        >
          {citation}
        </button>
      );
    });
  }, []);

  const handleSummarize = async () => {
    if (!description || isSummarizing) return;

    setIsSummarizing(true);
    setSummaryError(null);

    try {
      const summaryHTML = isLikelyHTML(description)
        ? description
        : convertMarkdownToEditorHTML(description);
      const result = await summarizeContent(summaryHTML);
      setAiSummary(result);
      await onUpdateItem(projectId, item.id, { ai_summary: result });
      onShowToast?.('AI 요약이 완료되었습니다.');
    } catch (error) {
      setSummaryError(error.message);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleOpenLink = useCallback((target) => {
    const linkedItem = allItems.find((candidate) =>
      candidate.id === target
      || candidate.title === target
      || candidate.content === target
    );

    if (linkedItem) {
      onOpenDetail?.(linkedItem.id);
      return;
    }

    onShowToast?.(`연결된 페이지를 찾지 못했습니다: ${target}`);
  }, [allItems, onOpenDetail, onShowToast]);

  const handleToggleTaskItem = useCallback((taskIndex, checked) => {
    if (isReadOnly) return;
    setDescription((prev) => {
      const next = toggleMarkdownTaskItem(prev || '', taskIndex, checked);
      if (next !== prev) {
        onUpdateItem(projectId, item.id, { description: next });
      }
      return next;
    });
  }, [isReadOnly, item.id, onUpdateItem, projectId]);

  const linkModalPhases = useMemo(
    () => [{ title: '전체 아이템', items: allItems }],
    [allItems],
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-border-subtle">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-gray-400" />
            <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-text-tertiary">
              {isMemo ? '메모 내용' : '상세 설명 (Wiki)'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-border-subtle dark:bg-bg-elevated">
                <button
                  type="button"
                  onClick={() => setDescriptionMode('live')}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest transition-colors ${
                    descriptionMode === 'live'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-bg-base dark:text-text-primary'
                      : 'text-gray-500 dark:text-text-secondary'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5"><LayoutTemplate size={12} />라이브</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDescriptionMode('source')}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest transition-colors ${
                    descriptionMode === 'source'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-bg-base dark:text-text-primary'
                      : 'text-gray-500 dark:text-text-secondary'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5"><Code2 size={12} />원문</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDescriptionMode('preview')}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest transition-colors ${
                    descriptionMode === 'preview'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-bg-base dark:text-text-primary'
                      : 'text-gray-500 dark:text-text-secondary'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5"><Eye size={12} />미리보기</span>
                </button>
              </div>
            )}

            {description && !isReadOnly && !isMemo && (
              <button
                type="button"
                onClick={handleSummarize}
                disabled={isSummarizing}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-violet-500 transition-all hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800/40 dark:bg-violet-900/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
              >
                {isSummarizing ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {isSummarizing ? '요약 중...' : 'AI 요약'}
              </button>
            )}
          </div>
        </div>

        {summaryError && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-500 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <div>
              <p className="mb-0.5 text-[13px] font-black">요약 실패</p>
              <p className="text-[12px] font-medium opacity-80">{summaryError}</p>
            </div>
          </div>
        )}

        {aiSummary && (
          <div className="overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-white dark:border-violet-900/40 dark:from-violet-950/20 dark:to-bg-base">
            <div className="flex items-center justify-between border-b border-violet-100 px-7 py-5 dark:border-violet-900/30">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-violet-100 p-2 dark:bg-violet-900/40">
                  <Sparkles size={15} className="text-violet-500 dark:text-violet-400" />
                </div>
                <div>
                  <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">
                    AI 요약
                  </h3>
                  <p className="mt-0.5 text-[11px] text-violet-400 dark:text-violet-500">
                    {new Date(aiSummary.generatedAt).toLocaleString('ko-KR')} 생성
                  </p>
                </div>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleSummarize}
                  disabled={isSummarizing}
                  className="flex cursor-pointer items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-violet-400 transition-colors hover:text-violet-600 disabled:opacity-50 dark:text-violet-500 dark:hover:text-violet-300"
                >
                  <RefreshCw size={11} className={isSummarizing ? 'animate-spin' : ''} />
                  {isSummarizing ? '요약 중...' : '다시 요약'}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-4 px-7 py-6">
              {aiSummary.summary.map((point, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-100 text-[10px] font-black text-violet-500 dark:border-violet-800/40 dark:bg-violet-900/40 dark:text-violet-400">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-text-secondary">
                    {renderWithCitations(point)}
                  </p>
                </div>
              ))}
              <p className="mt-2 text-[11px] font-bold text-violet-300 dark:text-violet-600">
                숫자 배지를 클릭하면 해당 본문 섹션으로 이동합니다.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {showEditorPane && (
            <MarkdownEditor
              key={`editor-${item.id}`}
              content={description}
              onChange={setDescription}
              editable={!isReadOnly}
              mode={descriptionMode === 'live' ? 'live' : 'source'}
              containerRef={descriptionRef}
              allItems={allItems}
              itemId={item.id}
              onShowToast={onShowToast}
              onFocus={() => setIsEditorFocused(true)}
              onBlur={handleDescriptionBlur}
              onEditorBlur={() => setIsEditorFocused(false)}
              onAddChildPage={onAddChildPage ? async (title) => onAddChildPage(projectId, item.id, title) : null}
              onShowPrompt={onShowPrompt}
              onLinkExistingPage={handleLinkExistingPage}
              editorViewRef={editorViewRef}
              onUpdate={onEditorUpdate}
            />
          )}

          {showPreviewPane && (
            <MarkdownPreview
              content={description}
              containerRef={descriptionRef}
              onOpenLink={handleOpenLink}
              onToggleTaskItem={handleToggleTaskItem}
              allItems={allItems}
            />
          )}
        </div>
      </div>

      {showLinkModal && (
        <SearchModal
          projects={linkModalPhases}
          onOpenDetail={handleLinkSelect}
          onClose={() => {
            linkCallbackRef.current?.(null);
            setShowLinkModal(false);
            linkCallbackRef.current = null;
          }}
        />
      )}
    </>
  );
}
