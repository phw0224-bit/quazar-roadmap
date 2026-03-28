import { useEditor, EditorContent } from '@tiptap/react';
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
import { useRef, useEffect } from 'react';
import {
  Bold, Italic, List, ListOrdered, Quote, Code, Minus,
  Heading1, Heading2, Heading3, ImagePlus, CheckSquare
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

function Toolbar({ editor, itemId, onShowToast }) {
  const fileInputRef = useRef(null);

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
        editor.chain().focus().setImage({ src: result.url, alt: result.originalName, width: null }).run();
      } else {
        editor.chain().focus().insertContent(
          `<a href="${result.url}" target="_blank">${result.originalName}</a>`
        ).run();
      }
      onShowToast?.('파일이 업로드되었습니다.');
    } catch (err) {
      onShowToast?.('파일 업로드 실패: ' + err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        className="hidden"
        onChange={handleFileChange}
      />
      <ToolbarButton onClick={() => fileInputRef.current?.click()} isActive={false} title="이미지/파일 첨부">
        <ImagePlus size={15} />
      </ToolbarButton>
    </div>
  );
}

export default function Editor({ content, onChange, editable, itemId, onShowToast, onBlur }) {
  const lastEmittedHTML = useRef(null);
  const editorRef = useRef(null);

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

  if (!editor) return null;

  return (
    <div className="tiptap-wrapper">
      {editable && (
        <Toolbar editor={editor} itemId={itemId} onShowToast={onShowToast} />
      )}
      <EditorContent
        editor={editor}
        className="prose dark:prose-invert max-w-none tiptap-content"
      />
    </div>
  );
}
