import { StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { getMarkdownTableContext } from '../utils/tableEditing';

/**
 * @fileoverview Markdown 표 셀 활성 영역 표시용 CodeMirror decoration 확장.
 *
 * 커서가 표 셀 안에 있을 때 현재 셀 범위를 mark decoration으로 강조해
 * live/source 편집 중 셀 위치를 시각적으로 유지한다.
 */

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

export function createTableSelectionExtension(enabled) {
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
