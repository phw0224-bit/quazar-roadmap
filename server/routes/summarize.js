import { Router } from 'express';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b';

function extractTextBlocks(html) {
  if (!html) return [];
  const blockRegex = /<(h[1-4]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks = [];
  let match;
  while ((match = blockRegex.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > 10) blocks.push(text);
  }
  return blocks;
}

const router = Router();

router.post('/api/summarize', async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: '요약할 내용이 없습니다.' });
  }

  const blocks = extractTextBlocks(content);

  if (blocks.length === 0) {
    return res.status(400).json({ error: '요약할 텍스트가 충분하지 않습니다.' });
  }

  const numberedContent = blocks.map((text, i) => `[${i + 1}] ${text}`).join('\n\n');

  const prompt = `다음은 업무 문서의 내용입니다. 각 섹션에는 [번호]가 붙어 있습니다.

이 문서를 3~5개의 핵심 포인트로 요약하세요.
각 요약 포인트 끝에 해당 내용의 출처 번호를 [1], [2] 형태로 반드시 붙이세요.
한국어로 간결하게 작성하세요.

문서 내용:
${numberedContent}

아래 JSON 형식으로만 응답하세요. JSON 외 텍스트는 쓰지 마세요:
{
  "summary": [
    "핵심 포인트 1 [1]",
    "핵심 포인트 2 [2][3]"
  ]
}`;

  try {
    const healthCheck = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (!healthCheck?.ok) {
      return res.status(503).json({
        error: 'Ollama 서버에 연결할 수 없습니다. 로컬 LLM이 실행 중인지 확인해주세요.',
        code: 'OLLAMA_UNAVAILABLE',
      });
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: '당신은 업무 문서 요약 전문가입니다. JSON 형식으로만 응답합니다.' },
          { role: 'user', content: prompt },
        ],
        stream: false,
        options: { temperature: 0.3, num_predict: 1024 },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Ollama 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.message?.content || '';

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 형식 응답 없음');

    const parsed = JSON.parse(jsonMatch[0]);

    res.json({
      summary: parsed.summary || [],
      blocks,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Summarize error:', error);
    if (error.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Ollama 응답 시간이 초과되었습니다 (60초).' });
    }
    res.status(500).json({ error: `요약 생성 실패: ${error.message}` });
  }
});

export const summarizeRouter = router;
