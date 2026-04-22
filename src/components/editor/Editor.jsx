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
import { useTheme } from 'next-themes';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import SlashCommandMenu from './SlashCommandMenu';
import EditorToolbar from './EditorToolbar';
import { buildPageWikiLink } from './utils/markdownPreview';
import {
  EDITOR_COMMANDS,
  filterEditorCommands,
  getSlashCommandContext,
  getWikiLinkContext,
  rankWikiLinkItems,
} from './utils/editorCommands';
import {
  moveMarkdownTableSelection,
} from './utils/tableEditing';
import {
  insertAroundSelection,
  insertAtSelection,
  replaceRange,
} from './utils/editorTextOps';
import {
  createLivePreviewExtension,
  toggleHeadingFold,
} from './codemirror/livePreviewExtension';
import { supabase } from '../../lib/supabase';
import { createTableSelectionExtension } from './codemirror/tableSelectionExtension';
import { createTemplatePlaceholderExtension } from './codemirror/templatePlaceholderExtension';

const LIVE_WIDGET_SELECTOR = [
  '.cm-live-codeblock-widget',
  '.cm-live-mermaid-wrapper',
  '.cm-live-table-widget',
  '.cm-live-blockquote-widget',
  '.cm-live-callout-widget',
  '.cm-live-math-widget',
  '.cm-live-hr-widget',
  '.cm-live-image-wrapper',
  '.cm-heading-folded-placeholder',
].join(', ');

function Editor({
  content,
  placeholder = '내용을 입력하세요...',
  inlinePlaceholders = {},
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
  editorViewRef: externalEditorViewRef,
  onUpdate: externalOnUpdate,
}) {
  const { resolvedTheme } = useTheme();
  const internalEditorViewRef = useRef(null);
  const editorViewRef = externalEditorViewRef || internalEditorViewRef;
  const wrapperRef = useRef(null);
  const fileInputRef = useRef(null);
  const isApplyingExternalValue = useRef(false);
  const commandMap = useMemo(
    () => Object.fromEntries(EDITOR_COMMANDS.map((command) => [command.id, command])),
    [],
  );

  const [slashState, setSlashState] = useState(null);
  const slashStateRef = useRef(null);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const filteredSlashCommandsRef = useRef([]);

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


  const handleInsertPageLink = useCallback(() => {
    if (!onLinkExistingPage || !editorViewRef.current) return;

    onLinkExistingPage((item) => {
      if (!item) return;
      insertAtSelection(editorViewRef.current, buildPageWikiLink(item));
    });
  }, [editorViewRef, onLinkExistingPage]);

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
  }, [editorViewRef, onAddChildPage, onShowPrompt, onShowToast]);

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
  }, [closeSlashMenu, editorViewRef, handleInsertChildPage, handleInsertPageLink]);

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
  }, [closeSlashMenu, editorViewRef, runCommand, selectedSlashIndex]);

  const extensions = useMemo(() => [
    markdown({
      base: markdownLanguage,
    }),
    EditorView.lineWrapping,
    cmPlaceholder(() => {
      const element = document.createElement('div');
      element.className = 'cm-editor-placeholder';
      element.textContent = placeholder;
      return element;
    }),
    ...createTemplatePlaceholderExtension(inlinePlaceholders),
    ...createLivePreviewExtension(mode === 'live'),
    ...createTableSelectionExtension(editable),
    Prec.highest(keymap.of([
      {
        key: 'ArrowDown',
        run: () => {
          if (!slashStateRef.current || !filteredSlashCommandsRef.current.length) return false;
          setSelectedSlashIndex((index) => {
            const commands = filteredSlashCommandsRef.current;
            return commands.length ? (index + 1) % commands.length : 0;
          });
          return true;
        },
      },
      {
        key: 'ArrowUp',
        run: () => {
          if (!slashStateRef.current || !filteredSlashCommandsRef.current.length) return false;
          setSelectedSlashIndex((index) => {
            const commands = filteredSlashCommandsRef.current;
            return commands.length ? (index - 1 + commands.length) % commands.length : 0;
          });
          return true;
        },
      },
      {
        key: 'Enter',
        run: () => {
          if (!slashStateRef.current || !filteredSlashCommandsRef.current.length) return false;
          return executeSelectedSlashCommand();
        },
      },
      {
        key: 'Escape',
        run: () => {
          if (!slashStateRef.current) return false;
          closeSlashMenu();
          return true;
        },
      },
    ])),
    EditorView.domEventHandlers({
      mousedown: (event) => {
        const view = editorViewRef.current;
        if (!view || mode !== 'live' || event.button !== 0) return false;

        const foldToggle = event.target?.closest?.('[data-fold-line]');
        if (foldToggle) {
          const lineFrom = parseInt(foldToggle.getAttribute('data-fold-line'), 10);
          if (!Number.isNaN(lineFrom)) {
            event.preventDefault();
            view.dispatch({ effects: toggleHeadingFold.of(lineFrom) });
            return true;
          }
        }

        const widgetRoot = event.target?.closest?.(LIVE_WIDGET_SELECTOR);
        if (widgetRoot) {
          try {
            const widgetPos = view.posAtDOM(widgetRoot, 0);
            if (widgetPos != null) {
              const widgetLine = view.state.doc.lineAt(widgetPos);
              event.preventDefault();
              view.dispatch({
                selection: { anchor: widgetLine.from, head: widgetLine.from },
                scrollIntoView: true,
              });
              view.focus();
              return true;
            }
          } catch {
            // Fall through to default CodeMirror behavior when DOM->position mapping is unavailable.
          }
        }

        return false;
      },
      keydown: (event) => {
        const view = editorViewRef.current;

        if (view && event.key === 'Tab') {
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
              return true;
            }
          }
        }

        return false;
      },
    }),
  ], [closeSlashMenu, editable, editorViewRef, executeSelectedSlashCommand, inlinePlaceholders, mode, placeholder]);

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
  }, [content, editorViewRef, syncSlashMenu]);

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
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = data.session?.access_token;
      if (!token) throw new Error('로그인이 필요합니다.');
      const response = await fetch(`/upload/${itemId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
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
    >
      <EditorToolbar
        editable={editable}
        commandMap={commandMap}
        runCommandById={runCommandById}
        insertBold={() => insertAroundSelection(editorViewRef.current, '**', '**')}
        onLinkExistingPage={onLinkExistingPage}
        onAddChildPage={onAddChildPage}
        itemId={itemId}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
      />

      <div
        ref={(node) => {
          wrapperRef.current = node;
          if (containerRef) {
            if (typeof containerRef === 'function') containerRef(node);
            else containerRef.current = node;
          }
        }}
        className={`relative ${mode === 'live'
          ? 'overflow-visible cm-live-preview-shell bg-transparent'
          : 'overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-border-subtle dark:bg-[#0f1115]'
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
          theme={resolvedTheme === 'dark' ? oneDark : 'light'}
          onCreateEditor={(view) => {
            editorViewRef.current = view;
            syncSlashMenu(view);
          }}
          onUpdate={(viewUpdate) => {
            syncSlashMenu(viewUpdate.view);
            externalOnUpdate?.(viewUpdate.view);
          }}
          onChange={(value, viewUpdate) => {
            if (isApplyingExternalValue.current) return;
            onChange?.(value);
            syncSlashMenu(viewUpdate.view);
            externalOnUpdate?.(viewUpdate.view);
          }}
          onBlur={(event) => {
            if (event.relatedTarget?.closest?.('[data-slash-menu-root]')) return;
            onEditorBlur?.(event);
            onBlur?.(event);
          }}
          onFocus={(event) => {
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

export default Editor;
