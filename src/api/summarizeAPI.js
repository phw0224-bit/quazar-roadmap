/**
 * @fileoverview AI 요약 API 호출. Express 서버가 Ollama(qwen2.5:14b) 프록시.
 *
 * 입력: Tiptap HTML 문자열
 * 서버 처리: extractTextBlocks(html) → 번호 부여 → Ollama 프롬프트
 * 출력: { summary: string[], blocks: string[], generatedAt: ISO8601 }
 *
 * summary의 [N] 인용 번호는 blocks 배열의 인덱스와 대응.
 * Ollama 미실행 시 503. 이 경우 ItemDetailPanel에서 에러 메시지 표시.
 */

/**
 * 본문 HTML 내용을 서버로 보내 AI 요약을 받아옵니다.
 * 서버는 Ollama 로컬 LLM을 호출합니다.
 *
 * @param {string} htmlContent - TiptapEditor의 getHTML() 결과
 * @returns {Promise<{ summary: string[], blocks: string[], generatedAt: string }>}
 */
export async function summarizeContent(htmlContent) {
  const response = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: htmlContent }),
  });

  const data = await response.json();

  if (!response.ok) {
    // 서버에서 내려준 에러 메시지를 그대로 throw
    throw new Error(data.error || '요약 생성에 실패했습니다.');
  }

  return data;
  // 반환 형태:
  // {
  //   summary: ["핵심 포인트 1 [1]", "핵심 포인트 2 [2][3]"],
  //   blocks:  ["실제 본문 텍스트 1", "실제 본문 텍스트 2"],
  //   generatedAt: "2026-03-28T12:00:00.000Z"
  // }
}
