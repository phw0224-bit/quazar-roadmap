/**
 * @fileoverview Mermaid 다이어그램 렌더링 유틸.
 *
 * 테마(라이트/다크) 동기화와 안전한 SVG 렌더링을 공통 처리해
 * live 위젯과 preview 패널이 같은 방식으로 Mermaid를 표시하도록 맞춘다.
 */
import mermaid from 'mermaid';

let initializedTheme = null;

function getMermaidTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'neutral';
}

function ensureMermaidInitialized() {
  const nextTheme = getMermaidTheme();
  if (initializedTheme === nextTheme) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: nextTheme,
  });
  initializedTheme = nextTheme;
}

export async function renderMermaidSVG(code, idPrefix = 'mermaid') {
  ensureMermaidInitialized();
  const renderId = `${idPrefix}-${Math.random().toString(36).slice(2, 11)}`;
  const { svg } = await mermaid.render(renderId, code);
  return normalizeMermaidSVG(svg);
}

function normalizeMermaidSVG(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return svgText;

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/\s+/);
    const width = Number(parts[2]);
    if (Number.isFinite(width) && width > 0) {
      svg.setAttribute('width', String(width));
    }
  }

  const style = svg.getAttribute('style') || '';
  const cleanedStyle = style.replace(/max-width\s*:\s*[^;]+;?/gi, '').trim();
  const normalizedStyle = cleanedStyle
    ? `${cleanedStyle}${cleanedStyle.endsWith(';') ? '' : ';'}max-width:none;`
    : 'max-width:none;';
  svg.setAttribute('style', normalizedStyle);
  svg.classList.add('mermaid-scroll-svg');

  return svg.outerHTML;
}
