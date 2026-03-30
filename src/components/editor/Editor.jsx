/**
 * @fileoverview Tiptap v3 기반 리치텍스트 에디터. ItemDetailPanel의 description 필드 전용.
 *
 * 핵심 기능:
 * - 마크다운 붙여넣기 지원 (marked로 HTML 변환)
 * - 복사 시 HTML→마크다운 변환 (turndown)
 * - 파일 업로드 (이미지: 인라인 삽입, 문서: 링크)
 * - `/` 슬래시 커맨드로 블록 삽입 (하위 페이지 생성, 기존 페이지 연결 지원)
 * - 툴바 + BubbleMenu (텍스트 선택 시 플로팅)
 * - @멘션: `@` 입력 시 팀원 목록 팝업 (Supabase profiles 연동)
 * - GlobalDragHandle: 에디터 블록 드래그 핸들
 * - **IME composition 처리**: 한글 입력 시 composition 중간 상태를 onChange로 emit하지 않음
 *
 * content prop: HTML 또는 마크다운. 에디터 내부는 항상 HTML로 처리.
 * onChange: 편집 시마다 HTML emit. lastEmittedHTML로 중복 emit 방지. IME composition 중에는 호출 안 함.
 */
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { Mention } from '@tiptap/extension-mention';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { DOMSerializer } from '@tiptap/pm/model';
import { supabase } from '../../lib/supabase';
import {
  Bold, Italic, List, ListOrdered, Quote, Code, Minus,
  Heading1, Heading2, Heading3, ImagePlus, CheckSquare, Strikethrough,
  Underline as UnderlineIcon, Link as LinkIcon, Highlighter, Palette
} from 'lucide-react';

import ResizableImage from './extensions/ResizableImage';
import Callout from './extensions/Callout';
import Toggle from './extensions/Toggle';
import PageLink from './extensions/PageLink';
import SlashCommand from './extensions/SlashCommand';

const lowlight = createLowlight(common);
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

function convertToHTML(content) {
  if (!content) return '';
  if (content.trimStart().startsWith('<')) return content;
  return marked(content);
}

function ToolbarButton({ onClick, isActive, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
        isActive
          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
          : 'text-gray-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-bg-hover hover:text-gray-900 dark:hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-border-subtle mx-0.5 self-center" />;
}

function Toolbar({ editor, fileInputRef, onShowToast }) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 bg-gray-50 dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-xl mb-3">
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="굵게 (Ctrl+B)">
        <Bold size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="기울임 (Ctrl+I)">
        <Italic size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="밑줄 (Ctrl+U)">
        <UnderlineIcon size={15} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="제목 1">
        <Heading1 size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="제목 2">
        <Heading2 size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="제목 3">
        <Heading3 size={15} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="글머리 기호">
        <List size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="번호 목록">
        <ListOrdered size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="체크리스트">
        <CheckSquare size={15} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="인용">
        <Quote size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="코드 블록">
        <Code size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} isActive={false} title="구분선">
        <Minus size={15} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton onClick={() => fileInputRef.current?.click()} isActive={false} title="이미지/파일 첨부">
        <ImagePlus size={15} />
      </ToolbarButton>
    </div>
  );
}

const MentionSuggestion = {
  items: async ({ query }) => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .ilike('name', `%${query}%`)
      .limit(10);
    return profiles || [];
  },
  render: () => {
    let component;
    let popup;

    return {
      onStart: (props) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },
      onUpdate(props) {
        component.updateProps(props);
        if (!props.clientRect) return;
        popup[0].setProps({ getReferenceClientRect: props.clientRect });
      },
      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }
        return component.ref?.onKeyDown(props);
      },
      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    };
  },
};

const MentionList = forwardRef(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => { setSelectedIndex(0); }, [items]);

  const selectItem = (index) => {
    const item = items[index];
    if (item) command({ id: item.id, label: item.name });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-white dark:bg-bg-elevated border border-gray-200 dark:border-border-subtle rounded-xl shadow-2xl overflow-hidden py-1 min-w-[140px] z-[9999]">
      {items.length > 0 ? (
        items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            className={`w-full text-left px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
              index === selectedIndex
                ? 'bg-blue-500 text-white'
                : 'text-gray-700 dark:text-text-primary hover:bg-gray-100 dark:hover:bg-bg-hover'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] uppercase font-black ${index === selectedIndex ? 'bg-white text-blue-500' : 'bg-gray-200 dark:bg-bg-hover text-gray-500'}`}>
              {item.name.charAt(0)}
            </div>
            {item.name}
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-gray-400">검색 결과 없음</div>
      )}
    </div>
  );
});
MentionList.displayName = 'MentionList';

export default function Editor({ content, onChange, editable, itemId, onShowToast, onBlur, onAddChildPage, onShowPrompt, onOpenDetail, onLinkExistingPage }) {
  const lastEmittedHTML = useRef(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const isComposing = useRef(false);

  /**
   * @description 이미지는 에디터에 직접 삽입, 그 외 문서는 다운로드 링크로 삽입.
   * POST /upload/:itemId 성공 후 items.files jsonb 업데이트는 호출 측(ItemDetailPanel)에서 처리.
   * @param {Event} e - input[type=file] change 이벤트
   */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      if (result.mimetype?.startsWith('image/')) {
        editorRef.current?.chain().focus().setImage({ src: result.url, alt: result.originalName, width: null }).run();
      } else {
        editorRef.current?.chain().focus().insertContent(
          `<a href="${result.url}" target="_blank">${result.originalName}</a>`
        ).run();
      }
      onShowToast?.('파일이 업로드되었습니다.');
    } catch (err) {
      onShowToast?.('파일 업로드 실패: ' + err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ResizableImage.configure({ inline: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 hover:text-blue-600 underline cursor-pointer transition-colors',
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      GlobalDragHandle.configure({
        dragHandleWidth: 28,
        scrollTreshold: 100,
        dragHandleSelector: '#global-drag-handle',
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded font-bold transition-all',
        },
        suggestion: MentionSuggestion,
      }),
      Placeholder.configure({
        placeholder: '내용을 입력하세요... (/ 로 블록 추가, # 헤더, **볼드**, - 목록)',
      }),
      Callout,
      Toggle,
      PageLink.configure({
        onOpenDetail: onOpenDetail,
      }),
      SlashCommand.configure({
        onAddChildPage: (onAddChildPage && onShowPrompt) ? (editor, range) => {
          onShowPrompt('하위 페이지 추가', '페이지 제목을 입력하세요', async (title) => {
            if (title && title.trim()) {
              try {
                const newPage = await onAddChildPage(title.trim());
                if (newPage) {
                  editor.chain().focus().deleteRange(range).insertContent({
                    type: 'pageLink',
                    attrs: { id: newPage.id, title: newPage.title },
                  }).run();
                }
              } catch (err) {
                onShowToast?.('하위 페이지 생성 실패: ' + err.message);
              }
            } else {
              editor.chain().focus().deleteRange(range).run();
            }
          });
        } : null,
        onLinkExistingPage: onLinkExistingPage ? (editor, range) => {
          onLinkExistingPage((item) => {
            if (item) {
              editor.chain().focus().deleteRange(range).insertContent({
                type: 'pageLink',
                attrs: { id: item.id, title: item.title || item.content },
              }).run();
            } else {
              editor.chain().focus().deleteRange(range).run();
            }
          });
        } : null,
      }),
    ],
    content: convertToHTML(content),
    editable,
    onCreate: ({ editor }) => { editorRef.current = editor; },
    editorProps: {
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;
        const html = marked(text);
        editorRef.current?.commands.insertContent(html);
        return true;
      },
      handleCopy: (view, event) => {
        const { from, to } = view.state.selection;
        if (from === to) return false;
        const fragment = view.state.doc.slice(from, to).content;
        const serializer = DOMSerializer.fromSchema(view.state.schema);
        const div = document.createElement('div');
        div.appendChild(serializer.serializeFragment(fragment));
        const html = div.innerHTML;
        event.clipboardData?.setData('text/plain', turndown.turndown(html));
        event.clipboardData?.setData('text/html', html);
        event.preventDefault();
        return true;
      },
      handleCut: (view, event) => {
        const { from, to } = view.state.selection;
        if (from === to) return false;
        const fragment = view.state.doc.slice(from, to).content;
        const serializer = DOMSerializer.fromSchema(view.state.schema);
        const div = document.createElement('div');
        div.appendChild(serializer.serializeFragment(fragment));
        const html = div.innerHTML;
        event.clipboardData?.setData('text/plain', turndown.turndown(html));
        event.clipboardData?.setData('text/html', html);
        event.preventDefault();
        view.dispatch(view.state.tr.deleteSelection());
        return true;
      },
      handleDOMEvents: {
        compositionstart: () => {
          isComposing.current = true;
          return false;
        },
        compositionend: () => {
          isComposing.current = false;
          // composition 완료 후 최종 상태를 onChange로 emit
          if (editorRef.current) {
            const html = editorRef.current.getHTML();
            if (html !== lastEmittedHTML.current) {
              lastEmittedHTML.current = html;
              onChange?.(html);
            }
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      // IME composition 중이면 onChange 호출 스킵
      if (isComposing.current) return;

      const html = editor.getHTML();
      lastEmittedHTML.current = html;
      onChange?.(html);
    },
    onBlur: ({ event }) => { onBlur?.(event); },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const newHTML = convertToHTML(content);
    if (newHTML === lastEmittedHTML.current) {
      lastEmittedHTML.current = null;
      return;
    }
    if (!editor.isFocused) {
      editor.commands.setContent(newHTML, false);
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  return (
    <div className="tiptap-wrapper relative">
      {/* 파일 input: 슬래시 커맨드에서 querySelector로 접근하므로 항상 DOM에 유지 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* BubbleMenu: 텍스트 선택 시 플로팅 툴바 */}
      {editable && (
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top', offset: 8 }}
          shouldShow={({ state, from, to }) => from !== to && !state.selection.empty}
          className="flex items-center gap-0.5 px-1.5 py-1 rounded-xl shadow-lg border bg-white dark:bg-bg-elevated border-gray-200 dark:border-border-strong animate-scale-in z-50"
        >
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="굵게"><Bold size={13} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="기울임"><Italic size={13} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="밑줄"><UnderlineIcon size={13} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="취소선"><Strikethrough size={13} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="인라인 코드"><Code size={13} /></ToolbarButton>
          <Divider />
          <ToolbarButton
            onClick={() => {
              const url = window.prompt('URL을 입력하세요:');
              if (url) editor.chain().focus().setLink({ href: url }).run();
              else if (url === '') editor.chain().focus().unsetLink().run();
            }}
            isActive={editor.isActive('link')}
            title="링크"
          >
            <LinkIcon size={13} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHighlight({ color: editor.isActive('highlight') ? 'transparent' : '#ffeb3b' }).run()}
            isActive={editor.isActive('highlight')}
            title="형광펜"
          >
            <Highlighter size={13} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              const color = window.prompt('색상 코드(예: #ff0000)를 입력하세요:');
              if (color) editor.chain().focus().setColor(color).run();
              else if (color === '') editor.chain().focus().unsetColor().run();
            }}
            isActive={editor.isActive('textStyle', { color: /./ })}
            title="글자 색상"
          >
            <Palette size={13} />
          </ToolbarButton>
          <Divider />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="제목 1"><Heading1 size={13} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="제목 2"><Heading2 size={13} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="제목 3"><Heading3 size={13} /></ToolbarButton>
        </BubbleMenu>
      )}

      <EditorContent
        editor={editor}
        className="prose dark:prose-invert max-w-none tiptap-content"
      />

      {/* 포탈을 이용해 드래그 핸들을 document.body에 렌더링 (ItemDetailPanel의 transform으로 인한 위치 오류 방지) */}
      {typeof document !== 'undefined' && createPortal(
        <div id="global-drag-handle" className="drag-handle"></div>,
        document.body
      )}
    </div>
  );
}
