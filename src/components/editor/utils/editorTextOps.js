import { EditorSelection } from '@codemirror/state';

/**
 * @fileoverview CodeMirror Markdown 편집에서 공용으로 사용하는 텍스트 변경 유틸.
 *
 * Editor.jsx에서 툴바 명령, 슬래시 명령, 표 이동이 모두 같은 변경 규칙을 쓰도록
 * selection 계산과 dispatch 패턴을 한 곳에 모은다.
 */

export function insertAroundSelection(view, prefix, suffix = '') {
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

export function replaceRange(view, from, to, text, { selectFrom = null, selectTo = null } = {}) {
  if (!view) return;
  const anchor = selectFrom == null ? from + text.length : from + selectFrom;
  const head = selectTo == null ? anchor : from + selectTo;

  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.range(anchor, head),
  });
  view.focus();
}

export function insertAtSelection(view, text, options = {}) {
  if (!view) return;
  const { from, to } = view.state.selection.main;
  replaceRange(view, from, to, text, {
    selectFrom: options.selectFrom ?? options.selectionFrom ?? null,
    selectTo: options.selectTo ?? options.selectionTo ?? null,
  });
}
