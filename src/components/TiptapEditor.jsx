import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { DOMSerializer } from '@tiptap/pm/model';
import { useRef, useEffect } from 'react';
import {
  Bold, Italic, List, ListOrdered, Quote, Code, Minus,
  Heading1, Heading2, Heading3, ImagePlus
} from 'lucide-react';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' });

// 드래그 리사이즈 가능한 이미지 NodeView
function ImageResizeView({ node, updateAttributes, selected, editor }) {
  const imgRef = useRef(null);
  const isEditable = editor.isEditable;

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = imgRef.current.offsetWidth;

    const onMouseMove = (e) => {
      const newWidth = Math.max(50, startWidth + (e.clientX - startX));
      imgRef.current.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      updateAttributes({ width: `${imgRef.current.offsetWidth}px` });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <NodeViewWrapper style={{ display: 'inline-block', position: 'relative', maxWidth: '100%' }}>
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          style={{
            width: node.attrs.width || 'auto',
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: '0.5rem',
            outline: selected ? '2px solid #3b82f6' : 'none',
            outlineOffset: '2px',
          }}
          draggable={false}
        />
        {isEditable && selected && (
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              right: -5,
              bottom: -5,
              width: 14,
              height: 14,
              background: '#3b82f6',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'se-resize',
              zIndex: 10,
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

// 이미지 width 속성 + 드래그 리사이즈 NodeView 확장
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => element.style.width || element.getAttribute('width') || null,
        renderHTML: attributes => {
          if (!attributes.width) return {};
          return { style: `width: ${attributes.width}` };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageResizeView);
  },
});

// 기존 markdown 또는 HTML 콘텐츠를 Tiptap용 HTML로 변환
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
      const response = await fetch(`/upload/${itemId}`, {
        method: 'POST',
        body: formData,
      });
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

export default function TiptapEditor({ content, onChange, editable, itemId, onShowToast, onBlur }) {
  const lastEmittedHTML = useRef(null);
  const editorRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      ResizableImage.configure({ inline: false }),
      Placeholder.configure({
        placeholder: '내용을 입력하세요... (# 헤더, **볼드**, - 목록)',
      }),
    ],
    content: convertToHTML(content),
    editable,
    onCreate: ({ editor }) => {
      editorRef.current = editor;
    },
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
        const markdown = turndown.turndown(html);
        event.clipboardData?.setData('text/plain', markdown);
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
        const markdown = turndown.turndown(html);
        event.clipboardData?.setData('text/plain', markdown);
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
    onBlur: ({ event }) => {
      onBlur?.(event);
    },
  });

  // editable prop 변경 시 editor에 반영
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // 외부에서 content가 바뀔 때 (취소, 아이템 변경 등) editor 내용 동기화
  useEffect(() => {
    if (!editor) return;
    const newHTML = convertToHTML(content);
    // 방금 내가 emit한 변경이면 무시 (무한루프 방지)
    if (newHTML === lastEmittedHTML.current) {
      lastEmittedHTML.current = null;
      return;
    }
    // 에디터 포커스 중이 아닐 때만 강제 동기화
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
