const DEFAULT_LIVE_WIDGET_SELECTOR = [
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

const LIVE_TABLE_ROOT_SELECTOR = '[data-live-table-root="true"], .cm-live-table-widget';

export function findLivePreviewWidgetRoot(target) {
  return target?.closest?.(DEFAULT_LIVE_WIDGET_SELECTOR) ?? null;
}

export function findLiveTableRoot(target) {
  return target?.closest?.(LIVE_TABLE_ROOT_SELECTOR) ?? null;
}

export function getLiveTableStartLine(tableRoot) {
  if (!tableRoot) return null;

  const startLine = Number.parseInt(tableRoot.getAttribute('data-live-table-start-line') || '', 10);
  return Number.isNaN(startLine) ? null : startLine;
}

export function shouldIgnoreLivePreviewWidgetEvent(event, className = '') {
  if (!event?.type) return false;
  if (!className.includes('cm-live-table-widget')) return false;

  return ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].includes(event.type);
}

function getLineFromIndex(doc, lineIndex) {
  const lineNumber = Math.min(Math.max(lineIndex + 1, 1), doc.lines);
  return doc.line(lineNumber).from;
}

export function getLiveTableEditPosition(view, tableRoot, target, tableStartLine) {
  if (!view?.state?.doc || tableStartLine == null) return null;

  const clickedRow = target?.closest?.('tr');
  if (!clickedRow || !tableRoot?.contains?.(clickedRow)) {
    return getLineFromIndex(view.state.doc, tableStartLine);
  }

  if (clickedRow.closest('thead')) {
    return getLineFromIndex(view.state.doc, tableStartLine);
  }

  if (clickedRow.closest('tbody')) {
    const bodyRows = Array.from(tableRoot.querySelectorAll('tbody tr'));
    const rowIndex = bodyRows.indexOf(clickedRow);
    if (rowIndex >= 0) {
      return getLineFromIndex(view.state.doc, tableStartLine + 2 + rowIndex);
    }
  }

  return getLineFromIndex(view.state.doc, tableStartLine);
}

export {
  DEFAULT_LIVE_WIDGET_SELECTOR,
};
