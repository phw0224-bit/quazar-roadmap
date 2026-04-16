import { StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';

class TemplatePlaceholderWidget extends WidgetType {
  constructor(text) {
    super();
    this.text = text;
  }

  eq(other) {
    return other.text === this.text;
  }

  toDOM() {
    const element = document.createElement('span');
    element.className = 'cm-inline-template-placeholder';
    element.textContent = this.text;
    return element;
  }

  ignoreEvent() {
    return false;
  }
}

function findPreviousNonEmptyLine(doc, lineNumber) {
  for (let current = lineNumber - 1; current >= 1; current -= 1) {
    const line = doc.line(current);
    if (line.text.trim()) {
      return line;
    }
  }

  return null;
}

function buildTemplatePlaceholderDecorations(state, placeholders) {
  const keys = Object.keys(placeholders || {});
  if (!keys.length) {
    return Decoration.none;
  }

  const decorations = [];

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    if (line.text.trim()) {
      continue;
    }

    const previousLine = findPreviousNonEmptyLine(state.doc, lineNumber);
    if (!previousLine || previousLine.number !== lineNumber - 1) {
      continue;
    }

    const placeholderText = placeholders[previousLine.text.trim()];
    if (!placeholderText) {
      continue;
    }

    decorations.push(
      Decoration.widget({
        widget: new TemplatePlaceholderWidget(placeholderText),
        side: 1,
      }).range(line.from),
    );
  }

  return decorations.length ? Decoration.set(decorations, true) : Decoration.none;
}

export function createTemplatePlaceholderExtension(placeholders = {}) {
  const templatePlaceholderField = StateField.define({
    create: (state) => buildTemplatePlaceholderDecorations(state, placeholders),
    update: (value, transaction) => {
      if (!transaction.docChanged && !transaction.selection) {
        return value;
      }

      return buildTemplatePlaceholderDecorations(transaction.state, placeholders);
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return [templatePlaceholderField];
}
