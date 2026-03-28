import 'dotenv/config';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b';

/**
 * Ollama API 호출
 * @param {string} systemPrompt - 시스템 역할 정의
 * @param {string} userMessage - 사용자 메시지
 * @returns {Promise<string>} - AI 응답 텍스트
 */
export async function askOllama(systemPrompt, userMessage) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        options: {
          temperature: 0.3,  // 낮을수록 일관성 있는 응답
          num_predict: 1024, // 최대 토큰 수
        },
      }),
      signal: AbortSignal.timeout(60000), // 60초 타임아웃
    });

    if (!response.ok) {
      throw new Error(`Ollama 응답 오류: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || '응답을 생성하지 못했습니다.';

  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('Ollama 응답 시간 초과 (60초). 서버 상태를 확인해주세요.');
    }
    throw new Error(`Ollama 연결 실패: ${error.message}`);
  }
}

/**
 * 시스템 프롬프트 - 봇의 역할 정의
 */
export const SYSTEM_PROMPT = `당신은 회사의 업무 보드(Roadmap)를 관리하는 도우미 봇입니다.
구글챗 스페이스에서 팀원들의 질문에 답하고, 업무 보드를 조회하거나 수정합니다.

규칙:
- 항상 한국어로 간결하게 답변하세요
- 목록은 번호나 이모지로 보기 좋게 정리하세요
- 담당자, 상태, 컬럼명을 반드시 함께 표시하세요
- 데이터가 없으면 "해당 조건의 작업이 없습니다"라고 말하세요
- 추측하지 말고 주어진 데이터만 사용하세요

상태 표시 방법:
- none → ⬜ 미지정
- in-progress → 🔵 진행 중
- done → ✅ 완료`;

/**
 * Ollama 서버 상태 확인
 * @returns {Promise<boolean>}
 */
export async function checkOllamaHealth() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 이슈 내용 자동 생성
 * 짧은 설명 → 제목 + 마크다운 본문 생성
 * @param {string} description - 짧은 설명
 * @returns {Promise<{title: string, content: string, tags: string[]}>}
 */
export async function generateIssueContent(description) {
  const prompt = `다음 설명을 바탕으로 개발 이슈를 작성해주세요.

설명: "${description}"

아래 JSON 형식으로만 응답하세요. JSON 외에 다른 텍스트는 쓰지 마세요:
{
  "title": "이슈 제목 (간결하게 40자 이내)",
  "content": "## 개요\\n내용\\n\\n## 작업 내용\\n- 항목1\\n- 항목2\\n\\n## 완료 조건\\n- 조건1",
  "tags": ["태그1", "태그2"]
}`;

  const raw = await askOllama(
    '당신은 개발팀 이슈 작성 전문가입니다. JSON 형식으로만 응답합니다.',
    prompt
  );

  // JSON 파싱
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 형식 응답 없음');
    return JSON.parse(jsonMatch[0]);
  } catch {
    // 파싱 실패 시 기본값 반환
    return {
      title: description,
      content: `## 개요\n${description}`,
      tags: [],
    };
  }
}
