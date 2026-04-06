import test from 'node:test';
import assert from 'node:assert/strict';

import { extractHeadings, buildHeadingTree } from './headingExtractor.js';

test('extractHeadings returns empty array for empty markdown', () => {
  const result = extractHeadings('');
  assert.deepEqual(result, []);
});

test('extractHeadings returns empty array for null markdown', () => {
  const result = extractHeadings(null);
  assert.deepEqual(result, []);
});

test('extractHeadings extracts all heading levels', () => {
  const markdown = `# Heading 1
Some text
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`;

  const result = extractHeadings(markdown);
  
  assert.equal(result.length, 6);
  assert.equal(result[0].depth, 1);
  assert.equal(result[0].text, 'Heading 1');
  assert.equal(result[0].lineIndex, 0);
  assert.equal(result[1].depth, 2);
  assert.equal(result[1].text, 'Heading 2');
  assert.equal(result[5].depth, 6);
  assert.equal(result[5].text, 'Heading 6');
});

test('extractHeadings ignores non-heading lines', () => {
  const markdown = `Normal text
# Heading 1
More text
**Bold text**
## Heading 2`;

  const result = extractHeadings(markdown);
  
  assert.equal(result.length, 2);
  assert.equal(result[0].text, 'Heading 1');
  assert.equal(result[1].text, 'Heading 2');
});

test('extractHeadings calculates correct offsets', () => {
  const markdown = `# H1
## H2`;

  const result = extractHeadings(markdown);
  
  assert.equal(result[0].offset, 0); // 첫 줄 시작
  assert.equal(result[1].offset, 5); // "# H1\n" = 5 characters
});

test('buildHeadingTree creates flat structure for same-level headings', () => {
  const headings = [
    { depth: 1, text: 'H1-A', lineIndex: 0, offset: 0 },
    { depth: 1, text: 'H1-B', lineIndex: 1, offset: 10 },
  ];

  const tree = buildHeadingTree(headings);
  
  assert.equal(tree.length, 2);
  assert.equal(tree[0].text, 'H1-A');
  assert.equal(tree[1].text, 'H1-B');
  assert.equal(tree[0].children.length, 0);
  assert.equal(tree[1].children.length, 0);
});

test('buildHeadingTree creates nested structure for hierarchical headings', () => {
  const headings = [
    { depth: 1, text: 'H1', lineIndex: 0, offset: 0 },
    { depth: 2, text: 'H2-A', lineIndex: 1, offset: 10 },
    { depth: 2, text: 'H2-B', lineIndex: 2, offset: 20 },
    { depth: 3, text: 'H3', lineIndex: 3, offset: 30 },
  ];

  const tree = buildHeadingTree(headings);
  
  assert.equal(tree.length, 1); // 최상위 H1 하나
  assert.equal(tree[0].text, 'H1');
  assert.equal(tree[0].children.length, 2); // H2-A, H2-B
  assert.equal(tree[0].children[0].text, 'H2-A');
  assert.equal(tree[0].children[1].text, 'H2-B');
  assert.equal(tree[0].children[1].children.length, 1); // H3
  assert.equal(tree[0].children[1].children[0].text, 'H3');
});

test('buildHeadingTree handles depth jumps correctly', () => {
  const headings = [
    { depth: 1, text: 'H1', lineIndex: 0, offset: 0 },
    { depth: 3, text: 'H3', lineIndex: 1, offset: 10 }, // H2 건너뜀
    { depth: 2, text: 'H2', lineIndex: 2, offset: 20 },
  ];

  const tree = buildHeadingTree(headings);
  
  assert.equal(tree.length, 1);
  assert.equal(tree[0].text, 'H1');
  assert.equal(tree[0].children.length, 2); // H3, H2 모두 H1의 자식
  assert.equal(tree[0].children[0].text, 'H3');
  assert.equal(tree[0].children[1].text, 'H2');
});
