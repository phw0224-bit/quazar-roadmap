/**
 * @fileoverview Tiptap 슬래시 커맨드 확장. `/` 입력 시 블록 선택 팝업 트리거.
 *
 * @tiptap/suggestion 기반. SlashCommandMenu(React 컴포넌트)를 ReactRenderer로 마운트.
 *
 * 지원 블록: Text, H1-H3, BulletList, OrderedList, Checklist, Callout,
 *            Toggle, Quote, CodeBlock, Divider, Image, ChildPage
 * ChildPage: onAddChildPage 콜백이 제공될 때만 커맨드 목록에 추가.
 *
 * 메뉴 위치 계산: 현재 커서 위치 기준. 뷰포트 하단 초과 시 위쪽으로 반전.
 */
/**
 * @fileoverview Tiptap 슬래시 커맨드(/) 확장.
 *
 * 에디터 본문에서 / 입력 시 메뉴 팝업을 트리거하며,
 * 하위 페이지 생성 및 기존 페이지 연결 콜백을 지원.
 */
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import SlashCommandMenu from '../SlashCommandMenu';

const COMMANDS = [
  {
    title: '텍스트',
    description: '기본 단락',
    icon: '¶',
    keywords: ['text', 'paragraph', '텍스트', '단락'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: '제목 1',
    description: '큰 제목',
    icon: 'H1',
    keywords: ['h1', 'heading', '제목', 'heading1'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: '제목 2',
    description: '중간 제목',
    icon: 'H2',
    keywords: ['h2', 'heading2', '제목'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: '제목 3',
    description: '소제목',
    icon: 'H3',
    keywords: ['h3', 'heading3', '소제목'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: '불릿 리스트',
    description: '점으로 구분된 목록',
    icon: '•',
    keywords: ['bullet', 'list', '목록', '불릿'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: '번호 목록',
    description: '순서 있는 목록',
    icon: '1.',
    keywords: ['ordered', 'numbered', '번호', '순서'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: '체크리스트',
    description: '할 일 목록',
    icon: '☑',
    keywords: ['todo', 'check', 'task', '체크', '할일'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Callout',
    description: '강조 박스 (💡⚠️❌ℹ️)',
    icon: '💡',
    keywords: ['callout', '콜아웃', 'note', 'highlight'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertCallout({ type: 'tip' }).run();
    },
  },
  {
    title: 'Toggle',
    description: '접기/펼치기 블록',
    icon: '▶',
    keywords: ['toggle', '토글', 'collapse', 'accordion'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertToggle({ variant: 'default' }).run();
    },
  },
  {
    title: '토글 제목 1',
    description: '제목 1 스타일 토글',
    icon: 'H1',
    keywords: ['toggle-h1', '토글 제목', 'h1', 'heading toggle'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertToggle({ variant: 'h1' }).run();
    },
  },
  {
    title: '토글 제목 2',
    description: '제목 2 스타일 토글',
    icon: 'H2',
    keywords: ['toggle-h2', '토글 제목', 'h2', 'heading toggle'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertToggle({ variant: 'h2' }).run();
    },
  },
  {
    title: '토글 제목 3',
    description: '제목 3 스타일 토글',
    icon: 'H3',
    keywords: ['toggle-h3', '토글 제목', 'h3', 'heading toggle'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertToggle({ variant: 'h3' }).run();
    },
  },
  {
    title: '토글 콜아웃',
    description: '강조형 토글',
    icon: '💬',
    keywords: ['toggle-note', '토글 콜아웃', 'note toggle', 'callout toggle'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertToggle({ variant: 'note' }).run();
    },
  },
  {
    title: '인용구',
    description: 'Blockquote',
    icon: '"',
    keywords: ['quote', 'blockquote', '인용'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: '코드블록',
    description: '언어별 코드 하이라이팅',
    icon: '</>',
    keywords: ['code', 'codeblock', '코드'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
  {
    title: '구분선',
    description: '수평 구분선',
    icon: '—',
    keywords: ['divider', 'hr', '구분', '선'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: '이미지',
    description: '이미지 업로드',
    icon: '🖼',
    keywords: ['image', '이미지', '사진', 'photo'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const wrapper = editor.view.dom.closest('.tiptap-wrapper');
      const fileInput = wrapper?.querySelector('input[type="file"]');
      fileInput?.click();
    },
  },
];

function updatePosition(popup, rect) {
  if (!rect) return;
  const OFFSET = 8;
  const menuHeight = 288;
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow > menuHeight
    ? rect.bottom + OFFSET
    : rect.top - menuHeight - OFFSET;
  popup.style.top = `${Math.max(8, top)}px`;
  popup.style.left = `${Math.min(rect.left, window.innerWidth - 272)}px`;
}

function cleanup(component, popup) {
  component?.destroy();
  popup?.remove();
}

const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      onAddChildPage: null,
      suggestion: {
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        items: ({ query, editor }) => {
          const q = query.toLowerCase().trim();
          
          let availableCommands = [...COMMANDS];
          
          const extension = editor.extensionManager.extensions.find(e => e.name === 'slashCommand');
          if (extension?.options?.onLinkExistingPage) {
            availableCommands.unshift({
              title: '기존 페이지 연결',
              description: '다른 페이지 또는 업무 링크 삽입',
              icon: '🔗',
              keywords: ['link', '링크', '연결', '기존', '페이지'],
              command: ({ editor, range }) => {
                extension.options.onLinkExistingPage(editor, range);
              },
            });
          }
          if (extension?.options?.onAddChildPage) {
            availableCommands.unshift({
              title: '하위 페이지',
              description: '이 페이지의 하위 페이지 생성',
              icon: '📄',
              keywords: ['page', '페이지', '하위', 'child', 'subpage'],
              command: ({ editor, range }) => {
                extension.options.onAddChildPage(editor, range);
              },
            });
          }

          if (!q) return availableCommands;
          return availableCommands.filter(item =>
            item.title.toLowerCase().includes(q) ||
            item.keywords.some(k => k.includes(q))
          );
        },
        render: () => {
          let component;
          let popup;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = document.createElement('div');
              popup.style.position = 'fixed';
              popup.style.zIndex = '9999';
              document.body.appendChild(popup);
              popup.appendChild(component.element);
              updatePosition(popup, props.clientRect());
            },
            onUpdate: (props) => {
              component?.updateProps(props);
              if (!props.clientRect || !popup) return;
              updatePosition(popup, props.clientRect());
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                cleanup(component, popup);
                component = undefined;
                popup = undefined;
                return true;
              }
              return component?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              cleanup(component, popup);
              component = undefined;
              popup = undefined;
            },
          };
        },
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default SlashCommand;
