/**
 * @fileoverview 댓글 마크다운 텍스트 삽입 헬퍼 함수.
 * 
 * textarea에서 선택한 텍스트를 마크다운 형식으로 감싸거나,
 * 커서 위치에 마크다운 문법 삽입.
 */

/**
 * 선택 텍스트 또는 커서 위치 정보 추출
 * @param {HTMLTextAreaElement} textarea - 대상 textarea
 * @returns {{ text: string, start: number, end: number }}
 */
function getSelection(textarea) {
  return {
    text: textarea.value.substring(textarea.selectionStart, textarea.selectionEnd),
    start: textarea.selectionStart,
    end: textarea.selectionEnd,
  };
}

/**
 * 텍스트 삽입 후 커서/선택 복원
 * @param {HTMLTextAreaElement} textarea
 * @param {{ text: string, start: number, end: number }} selection
 * @param {string} before - 선택 전 텍스트
 * @param {string} after - 선택 후 텍스트
 * @param {number} cursorOffset - 선택 끝에서의 커서 오프셋 (기본값 0 = 선택 끝)
 */
function wrapSelection(textarea, selection, before, after, cursorOffset = 0) {
  const { text, start, end } = selection;
  const before_text = textarea.value.substring(0, start);
  const after_text = textarea.value.substring(end);
  
  const newValue = before_text + before + text + after + after_text;
  textarea.value = newValue;
  
  // 선택 텍스트가 있었다면 선택 유지, 없으면 커서만 이동
  if (text) {
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + text.length;
  } else {
    textarea.selectionStart = textarea.selectionEnd = start + before.length + cursorOffset;
  }
  
  // 변경 이벤트 발생 (부모 컴포넌트의 useState 업데이트)
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * 글머리 목록 삽입 (`- 항목`)
 * @param {HTMLTextAreaElement} textarea
 */
export function insertBulletList(textarea) {
  const selection = getSelection(textarea);
  const { text, start, end } = selection;
  
  if (text) {
    // 선택된 텍스트가 여러 줄인 경우 각 줄에 - 추가
    const lines = text.split('\n');
    const wrapped = lines.map(line => (line.startsWith('- ') ? line : `- ${line}`)).join('\n');
    wrapSelection(textarea, selection, '', '', 0);
    
    const before_text = textarea.value.substring(0, start);
    const after_text = textarea.value.substring(start + text.length);
    textarea.value = before_text + wrapped + after_text;
    
    textarea.selectionStart = start;
    textarea.selectionEnd = start + wrapped.length;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // 커서 위치에 새로운 글머리 항목 추가
    wrapSelection(textarea, selection, '- ', '', 0);
  }
}

/**
 * 오늘 날짜 삽입 (`2026.04.27`)
 * @param {HTMLTextAreaElement} textarea
 */
export function insertToday(textarea) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  
  const selection = getSelection(textarea);
  wrapSelection(textarea, selection, dateStr, '', 0);
}

/**
 * 표 삽입 (2행 3열 기본 표)
 * ```
 * | 컬럼1 | 컬럼2 | 컬럼3 |
 * |-------|-------|-------|
 * | 셀1   | 셀2   | 셀3   |
 * ```
 * @param {HTMLTextAreaElement} textarea
 */
export function insertTable(textarea) {
  const selection = getSelection(textarea);
  const table = '\n| 컬럼1 | 컬럼2 | 컬럼3 |\n|-------|-------|-------|\n| 셀1   | 셀2   | 셀3   |\n';
  
  const { start } = selection;
  const before_text = textarea.value.substring(0, start);
  const after_text = textarea.value.substring(selection.end);
  
  textarea.value = before_text + table + after_text;
  textarea.selectionStart = textarea.selectionEnd = start + table.length;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * 체크박스 삽입 (`- [ ] 항목`)
 * @param {HTMLTextAreaElement} textarea
 */
export function insertCheckbox(textarea) {
  const selection = getSelection(textarea);
  wrapSelection(textarea, selection, '- [ ] ', '', 0);
}
