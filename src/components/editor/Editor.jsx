/**
 * @fileoverview 옵시디언 스타일 Markdown source editor.
 *
 * description의 단일 원본은 Markdown이며, 이 컴포넌트는 CodeMirror 6로 원문을 직접 편집한다.
 * 툴바와 슬래시 메뉴는 같은 명령 정의를 재사용하고, 파일/링크/하위 페이지도 Markdown 스니펫으로 삽입한다.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorSelection, StateField } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  Bold,
  Columns3,
  CheckSquare,
  Code,
  Eye,
  Eraser,
  FilePlus2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Link as LinkIcon,
  List,
  ListOrdered,
  MessageSquareQuote,
  Minus,
  Quote,
  Rows3,
  Table2,
  ChevronRightSquare,
  Trash2,
} from 'lucide-react';
import SlashCommandMenu from './SlashCommandMenu';
import { buildPageWikiLink } from './utils/markdownPreview';
import {
  EDITOR_COMMANDS,
  filterEditorCommands,
  getSlashCommandContext,
  getWikiLinkContext,
  rankWikiLinkItems,
} from './utils/editorCommands';
import {
  addMarkdownTableColumn,
  addMarkdownTableRow,
  clearMarkdownTableCell,
  deleteMarkdownTableColumn,
  deleteMarkdownTableRow,
  getMarkdownTableContext,
  moveMarkdownTableSelection,
} from './utils/tableEditing';
import { getMarkdownLivePreviewPlan } from './utils/livePreview';

function ToolbarButton({ title, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-subtle dark:bg-bg-base dark:text-text-secondary dark:hover:bg-bg-hover dark:hover:text-text-primary"
    >
      {children}
    </button>
  );
}

function insertAroundSelection(view, prefix, suffix = '') {
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const text = `${prefix}${selected}${suffix}`;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.range(from + prefix.length, from + prefix.length + selected.length),
  });
  view.focus();
}

function replaceRange(view, from, to, text, { selectFrom = null, selectTo = null } = {}) {
  if (!view) return;
  const anchor = selectFrom == null ? from + text.length : from + selectFrom;
  const head = selectTo == null ? anchor : from + selectTo;

  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.range(anchor, head),
  });
  view.focus();
}

function insertAtSelection(view, text, options = {}) {
  if (!view) return;
  const { from, to } = view.state.selection.main;
  replaceRange(view, from, to, text, {
    selectFrom: options.selectFrom ?? options.selectionFrom ?? null,
    selectTo: options.selectTo ?? options.selectionTo ?? null,
  });
}

const TOOLBAR_COMMAND_IDS = [
  'h1',
  'h2',
  'h3',
  'bullet',
  'numbered',
  'todo',
  'quote',
  'code',
  'table',
  'divider',
  'toggle',
  'toggle-note',
  'link-page',
  'page',
  'image',
];

const TOOLBAR_ICONS = {
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  bullet: List,
  numbered: ListOrdered,
  todo: CheckSquare,
  quote: Quote,
  code: Code,
  table: Table2,
  divider: Minus,
  toggle: ChevronRightSquare,
  'toggle-note': MessageSquareQuote,
  'link-page': LinkIcon,
  page: FilePlus2,
  image: ImagePlus,
};

class InlinePreviewWidget extends WidgetType {
  constructor(label, className) {
    super();
    this.label = label;
    this.className = className;
  }

  eq(other) {
    return other.label === this.label && other.className === this.className;
  }

  toDOM() {
    const element = document.createElement('span');
    element.className = this.className;
    element.textContent = this.label;
    return element;
  }
}

class HTMLPreviewWidget extends WidgetType {
  constructor(html, className) {
    super();
    this.html = html;
    this.className = className;
  }

  eq(other) {
    return other.html === this.html && other.className === this.className;
  }

  toDOM() {
    const element = document.createElement('div');
    element.className = this.className;
    element.innerHTML = this.html;
    return element;
  }

  ignoreEvent() {
    return false;
  }
}

function createLivePreviewExtension(enabled) {
  if (!enabled) return [];

  const field = StateField.define({
    create(state) {
      return buildLivePreviewDecorationsFromState(state);
    },
    update(_value, transaction) {
      if (transaction.docChanged || transaction.selection) {
        return buildLivePreviewDecorationsFromState(transaction.state);
      }
      return buildLivePreviewDecorationsFromState(transaction.state);
    },
    provide: (fieldRef) => EditorView.decorations.from(fieldRef),
  });

  return [field];
}

function createTableSelectionExtension(enabled) {
  if (!enabled) return [];

  const field = StateField.define({
    create(state) {
      return buildTableSelectionDecoration(state);
    },
    update(_value, transaction) {
      return buildTableSelectionDecoration(transaction.state);
    },
    provide: (fieldRef) => EditorView.decorations.from(fieldRef),
  });

  return [field];
}

function buildLivePreviewDecorationsFromState(state) {
  const selection = state.selection.main;
  const activeLineIndex = state.doc.lineAt(selection.head).number - 1;
  const plan = getMarkdownLivePreviewPlan(state.doc.toString(), activeLineIndex);
  const decorations = [];

  plan.replacements.forEach((item) => {
    decorations.push(
      Decoration.replace({
        widget: new InlinePreviewWidget(item.label, item.className),
        inclusive: false,
      }).range(item.from, item.to),
    );
  });

  plan.lineClasses.forEach((item) => {
    decorations.push(Decoration.line({ class: item.className }).range(item.lineStart));
  });

  plan.marks.forEach((item) => {
    decorations.push(Decoration.mark({ class: item.className }).range(item.from, item.to));
  });

  plan.blockWidgets.forEach((item) => {
    decorations.push(
      Decoration.replace({
        widget: new HTMLPreviewWidget(item.html, item.className),
        block: true,
      }).range(item.from, item.to),
    );
  });

  return Decoration.set(decorations, true);
}

function buildTableSelectionDecoration(state) {
  const context = getMarkdownTableContext(state.doc.toString(), state.selection.main.head);
  if (!context?.activeCell) return Decoration.none;

  return Decoration.set([
    Decoration.mark({ class: 'cm-table-active-cell' }).range(
      context.activeCell.from,
      Math.max(context.activeCell.from + 1, context.activeCell.to),
    ),
  ]);
}

export default function Editor({
  content,
  onChange,
  editable,
  mode = 'live',
  containerRef,
  allItems = [],
  itemId,
  onShowToast,
  onFocus,
  onBlur,
  onEditorBlur,
  onAddChildPage,
  onShowPrompt,
  onLinkExistingPage,
}) {
  const editorViewRef = useRef(null);
  const wrapperRef = useRef(null);
  const fileInputRef = useRef(null);
  const isApplyingExternalValue = useRef(false);
  const [isSurfaceHovered, setIsSurfaceHovered] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const commandMap = useMemo(
    () => Object.fromEntries(EDITOR_COMMANDS.map((command) => [command.id, command])),
    [],
  );

  const [slashState, setSlashState] = useState(null);
  const slashStateRef = useRef(null);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const filteredSlashCommandsRef = useRef([]);
  const [tableContext, setTableContext] = useState(null);

  useEffect(() => {
    slashStateRef.current = slashState;
  }, [slashState]);

  const closeSlashMenu = useCallback(() => {
    setSlashState(null);
    setSelectedSlashIndex(0);
  }, []);

  const filteredSlashCommands = useMemo(
    () => filterEditorCommands(slashState?.query || ''),
    [slashState?.query],
  );

  const wikiSuggestions = useMemo(() => {
    if (slashState?.type !== 'wiki') return [];
    const query = (slashState.query || '').trim().toLowerCase();
    return rankWikiLinkItems(allItems, query)
      .filter((item) => {
        const title = `${item?.title || item?.content || ''}`.trim();
        if (!title) return false;
        if (!query) return true;
        return title.toLowerCase().includes(query);
      })
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        label: item.title || item.content || '제목 없음',
        description: item.page_type === 'page' ? '페이지' : '업무',
        item,
      }));
  }, [allItems, slashState]);

  useEffect(() => {
    filteredSlashCommandsRef.current = slashState?.type === 'wiki'
      ? wikiSuggestions
      : filteredSlashCommands;
  }, [filteredSlashCommands, slashState?.type, wikiSuggestions]);

  useEffect(() => {
    setSelectedSlashIndex((current) => {
      const items = slashState?.type === 'wiki' ? wikiSuggestions : filteredSlashCommands;
      if (!items.length) return 0;
      return Math.min(current, items.length - 1);
    });
  }, [filteredSlashCommands, slashState?.type, wikiSuggestions]);

  const syncSlashMenu = useCallback((view) => {
    if (!editable || !view) {
      closeSlashMenu();
      return;
    }

    const selection = view.state.selection.main;
    if (!selection.empty) {
      closeSlashMenu();
      return;
    }

    const doc = view.state.doc.toString();
    const context = getSlashCommandContext(doc, selection.head);
    const wikiContext = getWikiLinkContext(doc, selection.head);

    if (!context && !wikiContext) {
      closeSlashMenu();
      return;
    }

    const coords = view.coordsAtPos(selection.head);
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    const left = coords && wrapperRect
      ? Math.max(12, Math.min(coords.left - wrapperRect.left, wrapperRect.width - 304))
      : 12;
    const top = coords && wrapperRect
      ? coords.bottom - wrapperRect.top + 12
      : 72;

    const nextContext = context
      ? { ...context, type: 'slash' }
      : { ...wikiContext, type: 'wiki' };

    setSlashState((current) => {
      if (
        current
        && current.from === nextContext.from
        && current.to === nextContext.to
        && current.query === nextContext.query
        && current.type === nextContext.type
        && current.position.left === left
        && current.position.top === top
      ) {
        return current;
      }

      return {
        ...nextContext,
        position: { left, top },
      };
    });
  }, [closeSlashMenu, editable]);

  const syncTableContext = useCallback((view) => {
    if (!editable || !view) {
      setTableContext(null);
      return;
    }

    const selection = view.state.selection.main;
    if (!selection.empty) {
      setTableContext(null);
      return;
    }

    setTableContext(getMarkdownTableContext(view.state.doc.toString(), selection.head));
  }, [editable]);

  const handleInsertPageLink = useCallback(() => {
    if (!onLinkExistingPage || !editorViewRef.current) return;

    onLinkExistingPage((item) => {
      if (!item) return;
      insertAtSelection(editorViewRef.current, buildPageWikiLink(item));
    });
  }, [onLinkExistingPage]);

  const handleInsertChildPage = useCallback(() => {
    if (!onAddChildPage || !onShowPrompt || !editorViewRef.current) return;

    onShowPrompt('하위 페이지 추가', '페이지 제목을 입력하세요', async (title) => {
      if (!title?.trim()) return;

      try {
        const newPage = await onAddChildPage(title.trim());
        if (!newPage) return;
        insertAtSelection(editorViewRef.current, buildPageWikiLink(newPage));
      } catch (error) {
        onShowToast?.(`하위 페이지 생성 실패: ${error.message}`);
      }
    });
  }, [onAddChildPage, onShowPrompt, onShowToast]);

  const runCommand = useCallback((command, range = null) => {
    const view = editorViewRef.current;
    if (!view || !command) return;

    if (command.action) {
      if (range) {
        replaceRange(view, range.from, range.to, '');
      }

      if (command.action === 'link-page') {
        handleInsertPageLink();
      } else if (command.action === 'create-page') {
        handleInsertChildPage();
      } else if (command.action === 'image') {
        fileInputRef.current?.click();
      }

      closeSlashMenu();
      return;
    }

    if (range) {
      replaceRange(view, range.from, range.to, command.insert, command);
    } else {
      insertAtSelection(view, command.insert, command);
    }

    closeSlashMenu();
  }, [closeSlashMenu, handleInsertChildPage, handleInsertPageLink]);

  const runCommandById = useCallback((commandId) => {
    const command = commandMap[commandId];
    if (!command) return;
    runCommand(command);
  }, [commandMap, runCommand]);

  const executeSelectedSlashCommand = useCallback(() => {
    const activeSlash = slashStateRef.current;
    const items = filteredSlashCommandsRef.current;
    if (!activeSlash || !items.length) return false;

    const selected = items[selectedSlashIndex] || items[0];
    if (!selected) return false;

    if (activeSlash.type === 'wiki') {
      replaceRange(
        editorViewRef.current,
        activeSlash.from,
        activeSlash.to,
        buildPageWikiLink(selected.item),
      );
      closeSlashMenu();
      return true;
    }

    runCommand(selected, { from: activeSlash.from, to: activeSlash.to });
    return true;
  }, [closeSlashMenu, runCommand, selectedSlashIndex]);

  const extensions = useMemo(() => [
    markdown({
      base: markdownLanguage,
    }),
    EditorView.lineWrapping,
    ...createLivePreviewExtension(mode === 'live'),
    ...createTableSelectionExtension(editable),
    EditorView.domEventHandlers({
      keydown: (event) => {
        const view = editorViewRef.current;

        if (slashStateRef.current && filteredSlashCommandsRef.current.length) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            setSelectedSlashIndex((index) => {
              const commands = filteredSlashCommandsRef.current;
              return commands.length ? (index + 1) % commands.length : 0;
            });
            return true;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            setSelectedSlashIndex((index) => {
              const commands = filteredSlashCommandsRef.current;
              return commands.length ? (index - 1 + commands.length) % commands.length : 0;
            });
            return true;
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            return executeSelectedSlashCommand();
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeSlashMenu();
            return true;
          }
        }

        if (view && (event.key === 'Tab')) {
          const selection = view.state.selection.main;
          if (selection.empty) {
            const move = moveMarkdownTableSelection(
              view.state.doc.toString(),
              selection.head,
              event.shiftKey ? 'prev' : 'next',
            );

            if (move) {
              event.preventDefault();
              replaceRange(view, 0, view.state.doc.length, move.text, {
                selectFrom: move.cursor,
                selectTo: move.cursor,
              });
              syncTableContext(view);
              return true;
            }
          }
        }

        return false;
      },
    }),
  ], [closeSlashMenu, executeSelectedSlashCommand, mode, syncTableContext]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    const nextValue = content || '';

    if (currentValue === nextValue) return;
    isApplyingExternalValue.current = true;
    view.dispatch({
      changes: { from: 0, to: currentValue.length, insert: nextValue },
    });
    isApplyingExternalValue.current = false;
    syncSlashMenu(view);
    syncTableContext(view);
  }, [content, syncSlashMenu, syncTableContext]);

  const applyTableChange = useCallback((operation) => {
    const view = editorViewRef.current;
    if (!view) return;
    const result = operation(view.state.doc.toString(), view.state.selection.main.head);
    if (!result) return;

    replaceRange(view, 0, view.state.doc.length, result.text, {
      selectFrom: result.cursor,
      selectTo: result.cursor,
    });
    syncTableContext(view);
  }, [syncTableContext]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !editorViewRef.current) return;

    if (file.size > 10 * 1024 * 1024) {
      onShowToast?.('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/upload/${itemId}`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('업로드 실패');
      const result = await response.json();

      const markdownText = result.mimetype?.startsWith('image/')
        ? `![${result.originalName}](${result.url})`
        : `[${result.originalName}](${result.url})`;

      insertAtSelection(editorViewRef.current, markdownText);
      onShowToast?.('파일이 업로드되었습니다.');
    } catch (error) {
      onShowToast?.(`파일 업로드 실패: ${error.message}`);
    }

    event.target.value = '';
  };

  return (
    <div
      className="space-y-3"
      onMouseEnter={() => setIsSurfaceHovered(true)}
      onMouseLeave={() => setIsSurfaceHovered(false)}
    >
      {editable && (
        <div className="relative rounded-2xl border border-gray-200 bg-gray-50 px-2 py-2 dark:border-border-subtle dark:bg-bg-elevated">
          <div className="flex flex-wrap items-center gap-1">
          {TOOLBAR_COMMAND_IDS.map((commandId) => {
            const command = commandMap[commandId];
            const Icon = TOOLBAR_ICONS[commandId];
            const isDisabled = (commandId === 'link-page' && !onLinkExistingPage)
              || (commandId === 'page' && !onAddChildPage)
              || (commandId === 'image' && !itemId);

            return (
              <ToolbarButton
                key={commandId}
                title={command.label}
                onClick={() => runCommandById(commandId)}
                disabled={isDisabled}
              >
                <Icon size={15} />
              </ToolbarButton>
            );
          })}
          <ToolbarButton title="굵게" onClick={() => insertAroundSelection(editorViewRef.current, '**', '**')}>
            <Bold size={15} />
          </ToolbarButton>
          </div>
          {tableContext && (
            <div
              className={`pointer-events-none absolute left-2 right-2 top-full z-20 mt-2 flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-2 shadow-lg transition-all duration-150 dark:border-border-subtle dark:bg-bg-base dark:shadow-black/20 ${
                isSurfaceHovered || isEditorFocused ? 'pointer-events-auto opacity-100 translate-y-0' : '-translate-y-1 opacity-0'
              }`}
            >
              <span className="px-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-gray-400 dark:text-text-tertiary">
                Table R{tableContext.activeEditableRowIndex + 1} C{tableContext.activeColumnIndex + 1}
              </span>
              <ToolbarButton title="행 추가" onClick={() => applyTableChange(addMarkdownTableRow)}>
                <Rows3 size={15} />
              </ToolbarButton>
              <ToolbarButton title="열 추가" onClick={() => applyTableChange(addMarkdownTableColumn)}>
                <Columns3 size={15} />
              </ToolbarButton>
              <ToolbarButton title="셀 비우기" onClick={() => applyTableChange(clearMarkdownTableCell)}>
                <Eraser size={15} />
              </ToolbarButton>
              <ToolbarButton title="행 삭제" onClick={() => applyTableChange(deleteMarkdownTableRow)}>
                <span className="inline-flex items-center gap-1">
                  <Rows3 size={15} />
                  <Trash2 size={11} />
                </span>
              </ToolbarButton>
              <ToolbarButton title="열 삭제" onClick={() => applyTableChange(deleteMarkdownTableColumn)}>
                <span className="inline-flex items-center gap-1">
                  <Columns3 size={15} />
                  <Trash2 size={11} />
                </span>
              </ToolbarButton>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={handleFileChange}
          />
        </div>
      )}

      <div
        ref={(node) => {
          wrapperRef.current = node;
          if (containerRef) {
            if (typeof containerRef === 'function') containerRef(node);
            else containerRef.current = node;
          }
        }}
        className={`relative overflow-hidden ${mode === 'live'
          ? 'cm-live-preview-shell bg-transparent'
          : 'rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-border-subtle dark:bg-[#0f1115]'
        }`}
      >
        <CodeMirror
          value={content || ''}
          height="420px"
          basicSetup={{
            lineNumbers: mode !== 'live',
            foldGutter: true,
            highlightActiveLine: mode !== 'live',
            highlightActiveLineGutter: mode !== 'live',
          }}
          editable={editable}
          extensions={extensions}
          theme={editable ? oneDark : 'light'}
          onCreateEditor={(view) => {
            editorViewRef.current = view;
            syncSlashMenu(view);
            syncTableContext(view);
          }}
          onUpdate={(viewUpdate) => {
            syncSlashMenu(viewUpdate.view);
            syncTableContext(viewUpdate.view);
          }}
          onChange={(value, viewUpdate) => {
            if (isApplyingExternalValue.current) return;
            onChange?.(value);
            syncSlashMenu(viewUpdate.view);
            syncTableContext(viewUpdate.view);
          }}
          onBlur={(event) => {
            if (event.relatedTarget?.closest?.('[data-slash-menu-root]')) return;
            setIsEditorFocused(false);
            onEditorBlur?.(event);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsEditorFocused(true);
            onFocus?.(event);
          }}
        />

        {editable && slashState && (slashState.type === 'wiki' ? wikiSuggestions.length > 0 : filteredSlashCommands.length > 0) && (
          <div data-slash-menu-root className="pointer-events-auto">
            <SlashCommandMenu
              items={slashState.type === 'wiki' ? wikiSuggestions : filteredSlashCommands}
              selectedIndex={selectedSlashIndex}
              position={slashState.position}
              title={slashState.type === 'wiki' ? 'Wiki Links' : 'Slash Commands'}
              onSelect={(command) => {
                if (slashState.type === 'wiki') {
                  replaceRange(editorViewRef.current, slashState.from, slashState.to, buildPageWikiLink(command.item));
                  closeSlashMenu();
                  return;
                }
                runCommand(command, { from: slashState.from, to: slashState.to });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
