/**
 * @fileoverview Markdown에서 헤딩을 추출하여 TOC 데이터 생성
 *
 * 헤딩 구조를 파싱하고 중첩 레벨(depth)과 텍스트, 위치를 반환한다.
 * ItemDetailPanel의 TOC 패널과 Editor의 스크롤 타겟 계산에 사용된다.
 */

/**
 * @description 마크다운 텍스트에서 헤딩을 추출하여 배열로 반환
 * @param {string} markdown - 마크다운 텍스트
 * @returns {Array} 헤딩 객체 배열 [{ depth, text, lineIndex, offset }]
 */
export function extractHeadings(markdown) {
  if (!markdown) return [];

  const lines = markdown.split('\n');
  const headings = [];
  let offset = 0;

  lines.forEach((line, lineIndex) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const depth = match[1].length; // 1~6
      const text = match[2].trim();
      headings.push({
        depth,
        text,
        lineIndex,
        offset, // 문자 위치 (스크롤용)
      });
    }
    offset += line.length + 1; // +1 for \n
  });

  return headings;
}

/**
 * @description 헤딩 배열을 중첩 구조로 변환 (렌더링용)
 * @param {Array} headings - extractHeadings()의 반환값
 * @returns {Array} 중첩 트리 구조 [{ ...heading, children: [...] }]
 */
export function buildHeadingTree(headings) {
  const root = { children: [] };
  const stack = [root];

  headings.forEach((heading) => {
    const node = { ...heading, children: [] };

    // 현재 depth에 맞는 부모 찾기
    while (stack.length > 1 && stack[stack.length - 1].depth >= heading.depth) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(node);
    stack.push(node);
  });

  return root.children;
}
