import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { getMarkdownLivePreviewPlan } from '../utils/livePreview';
import { renderMermaidSVG } from '../utils/mermaidRenderer';

/**
 * @fileoverview Markdown live preview + 헤딩 폴딩 CodeMirror 확장.
 *
 * source markdown을 유지한 채 비활성 라인을 위젯/마크 decoration으로 렌더링하고,
 * 헤딩 단위 접기/펼치기 상태를 StateField로 추적한다.
 */

export const toggleHeadingFold = StateEffect.define();

const headingFoldField = StateField.define({
  create: () => new Set(),
  update(folds, tr) {
    let next = folds;
    for (const effect of tr.effects) {
      if (effect.is(toggleHeadingFold)) {
        next = new Set(next);
        const pos = effect.value;
        if (next.has(pos)) {
          next.delete(pos);
        } else {
          next.add(pos);
        }
      }
    }
    return next;
  },
});

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

class InlineImageWidget extends WidgetType {
  constructor(url, alt) {
    super();
    this.url = url;
    this.alt = alt;
  }

  eq(other) {
    return other.url === this.url && other.alt === this.alt;
  }

  toDOM() {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-live-image-wrapper';
    const img = document.createElement('img');
    img.src = this.url;
    img.alt = this.alt;
    img.className = 'cm-live-image-el';
    img.loading = 'lazy';
    wrapper.appendChild(img);
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

class MermaidWidget extends WidgetType {
  constructor(code) {
    super();
    this.code = code;
    this.id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
  }

  eq(other) {
    return other.code === this.code;
  }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-live-mermaid-wrapper';
    const container = document.createElement('div');
    container.className = 'cm-live-mermaid-diagram';
    container.id = this.id;
    requestAnimationFrame(async () => {
      if (!container.isConnected) return;
      try {
        const svg = await renderMermaidSVG(this.code, 'cm-live-mermaid');
        if (!container.isConnected) return;
        container.innerHTML = svg;
      } catch (error) {
        if (!container.isConnected) return;
        container.innerHTML = `<pre class="cm-live-mermaid-error">${error.message}</pre>`;
      }
    });

    wrapper.appendChild(container);
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

class FoldToggleWidget extends WidgetType {
  constructor(isFolded, lineFrom) {
    super();
    this.isFolded = isFolded;
    this.lineFrom = lineFrom;
  }

  eq(other) {
    return other.isFolded === this.isFolded && other.lineFrom === this.lineFrom;
  }

  toDOM() {
    const el = document.createElement('span');
    el.className = `cm-heading-fold-toggle${this.isFolded ? ' cm-heading-fold-toggle--folded' : ''}`;
    el.setAttribute('data-fold-line', String(this.lineFrom));
    el.textContent = this.isFolded ? '▶' : '▼';
    el.title = this.isFolded ? '펼치기' : '접기';
    return el;
  }

  ignoreEvent() {
    return false;
  }
}

class FoldedContentWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-heading-folded-placeholder';
    el.textContent = ' ···';
    return el;
  }

  ignoreEvent() {
    return false;
  }
}

function getHeadingFoldRange(doc, lineFrom) {
  const line = doc.lineAt(lineFrom);
  const match = line.text.match(/^(#{1,6})\s/);
  if (!match) return null;

  const level = match[1].length;
  let foldTo = -1;

  for (let ln = line.number + 1; ln <= doc.lines; ln++) {
    const nextLine = doc.line(ln);
    const nextMatch = nextLine.text.match(/^(#{1,6})\s/);
    if (nextMatch && nextMatch[1].length <= level) {
      foldTo = nextLine.from - 1;
      break;
    }
    foldTo = nextLine.to;
  }

  if (foldTo <= line.to) return null;
  return { from: line.to, to: foldTo };
}

function buildLivePreviewDecorationsFromState(state) {
  const selection = state.selection.main;
  const activeLineIndex = state.doc.lineAt(selection.head).number - 1;
  const plan = getMarkdownLivePreviewPlan(state.doc.toString(), activeLineIndex, selection.head);
  const folds = state.field(headingFoldField, false) || new Set();

  const activeFoldedRanges = [];
  const foldToggleDecos = [];

  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    if (!/^#{1,6}\s/.test(line.text)) continue;

    const inside = activeFoldedRanges.some((r) => line.from > r.from && line.from <= r.to);
    if (inside) continue;

    const foldRange = getHeadingFoldRange(state.doc, line.from);
    if (!foldRange) continue;

    const isFolded = folds.has(line.from);
    foldToggleDecos.push({ lineFrom: line.from, isFolded });

    if (isFolded) {
      activeFoldedRanges.push(foldRange);
    }
  }

  const isHidden = (pos) => activeFoldedRanges.some((r) => pos > r.from && pos <= r.to);
  const decorations = [];

  plan.replacements.forEach((item) => {
    if (isHidden(item.from)) return;
    if (item.html) {
      decorations.push(
        Decoration.replace({
          widget: new HTMLPreviewWidget(item.html, item.className),
          inclusive: false,
        }).range(item.from, item.to),
      );
    } else {
      decorations.push(
        Decoration.replace({
          widget: new InlinePreviewWidget(item.label, item.className),
          inclusive: false,
        }).range(item.from, item.to),
      );
    }
  });

  plan.lineClasses.forEach((item) => {
    if (isHidden(item.lineStart)) return;
    decorations.push(Decoration.line({ class: item.className }).range(item.lineStart));
  });

  plan.marks.forEach((item) => {
    if (isHidden(item.from)) return;
    decorations.push(Decoration.mark({ class: item.className }).range(item.from, item.to));
  });

  plan.blockWidgets.forEach((item) => {
    if (isHidden(item.from)) return;
    if (item.type === 'mermaid') {
      decorations.push(
        Decoration.replace({
          widget: new MermaidWidget(item.code),
          block: true,
        }).range(item.from, item.to),
      );
    } else {
      decorations.push(
        Decoration.replace({
          widget: new HTMLPreviewWidget(item.html, item.className),
          block: true,
        }).range(item.from, item.to),
      );
    }
  });

  plan.inlineWidgets.forEach((item) => {
    if (isHidden(item.from)) return;
    decorations.push(
      Decoration.replace({
        widget: new InlineImageWidget(item.url, item.alt),
        inclusive: false,
      }).range(item.from, item.to),
    );
  });

  foldToggleDecos.forEach(({ lineFrom, isFolded }) => {
    decorations.push(
      Decoration.widget({
        widget: new FoldToggleWidget(isFolded, lineFrom),
        side: -1,
      }).range(lineFrom),
    );
  });

  activeFoldedRanges.forEach((range) => {
    decorations.push(
      Decoration.replace({
        widget: new FoldedContentWidget(),
        block: true,
      }).range(range.from, range.to),
    );
  });

  return Decoration.set(decorations, true);
}

export function createLivePreviewExtension(enabled) {
  if (!enabled) return [];

  const field = StateField.define({
    create(state) {
      return buildLivePreviewDecorationsFromState(state);
    },
    update(_value, transaction) {
      return buildLivePreviewDecorationsFromState(transaction.state);
    },
    provide: (fieldRef) => EditorView.decorations.from(fieldRef),
  });

  return [headingFoldField, field];
}
