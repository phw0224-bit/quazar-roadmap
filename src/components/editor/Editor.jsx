import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { DOMSerializer } from '@tiptap/pm/model';
import { useRef, useEffect, useState } from 'react';
import {
  Bold, Italic, List, ListOrdered, Quote, Code, Minus,
  Heading1, Heading2, Heading3, ImagePlus, CheckSquare, Strikethrough
} from 'lucide-react';

import ResizableImage from './extensions/ResizableImage';
import Callout from './extensions/Callout';
import Toggle from './extensions/Toggle';
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

export default function Editor({ content, onChange, editable, itemId, onShowToast, onBlur }) {
  const lastEmittedHTML = useRef(null);
  const editorRef = useRef(null);
  const wrapperRef = useRef(null);
  const fileInputRef = useRef(null);

  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [dragHandleTop, setDragHandleTop] = useState(null);
  const [isDragHandleVisible, setIsDragHandleVisible] = useState(false);

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
      Placeholder.configure({
        placeholder: '내용을 입력하세요... (/ 로 블록 추가, # 헤더, **볼드**, - 목록)',
      }),
      Callout,
      Toggle,
      SlashCommand,
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
    },
    onUpdate: ({ editor }) => {
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

  const handleMouseMove = (e) => {
    if (!editable) return;
    const pm = wrapperRef.current?.querySelector('.ProseMirror');
    if (!pm) return;
    let el = e.target;
    while (el && el.parentElement !== pm) el = el.parentElement;
    if (!el || el === pm) { setIsDragHandleVisible(false); return; }
    const pmRect = pm.getBoundingClientRect();
    const blockRect = el.getBoundingClientRect();
    setDragHandleTop(blockRect.top - pmRect.top + 10);
    setIsDragHandleVisible(true);
  };

  if (!editor) return null;

  return (
    <div
      ref={wrapperRef}
      className="tiptap-wrapper relative"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setIsDragHandleVisible(false)}
    >
      {/* 파일 input: 슬래시 커맨드에서 querySelector로 접근하므로 항상 DOM에 유지 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 드래그 핸들 */}
      {editable && isDragHandleVisible && dragHandleTop !== null && (
        <div
          className="absolute -left-5 text-gray-300 dark:text-text-tertiary select-none pointer-events-none flex items-center justify-center w-4 text-sm"
          style={{ top: dragHandleTop }}
          aria-hidden="true"
        >
          ⠿
        </div>
      )}

      {/* 툴바 토글 버튼 */}
      {editable && (
        <div className="flex items-center mb-1">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setToolbarVisible(v => !v); }}
            className="flex items-center gap-1 text-[11px] font-semibold text-gray-300 dark:text-text-tertiary hover:text-gray-500 dark:hover:text-text-secondary transition-colors px-2 py-0.5 rounded-lg hover:bg-gray-100 dark:hover:bg-bg-hover"
          >
            {toolbarVisible ? '▾ 서식 숨기기' : '▸ 서식'}
          </button>
        </div>
      )}

      {/* 툴바 (접힘 가능) */}
      {editable && toolbarVisible && (
        <Toolbar editor={editor} fileInputRef={fileInputRef} onShowToast={onShowToast} />
      )}

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
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="취소선"><Strikethrough size={13} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="인라인 코드"><Code size={13} /></ToolbarButton>
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
    </div>
  );
}
