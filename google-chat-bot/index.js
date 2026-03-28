import express from 'express';
import 'dotenv/config';
import { handleQuery } from './handlers/query.js';
import { handleAction } from './handlers/action.js';
import { checkOllamaHealth } from './lib/ollama.js';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// ─── 헬스체크 ─────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const ollamaOk = await checkOllamaHealth();
  res.json({
    status: 'ok',
    ollama: ollamaOk ? 'connected' : 'disconnected',
    model: process.env.OLLAMA_MODEL || 'qwen2.5:14b',
  });
});

// ─── 구글챗 웹훅 ─────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('[webhook]', event.type, event.message?.text?.slice(0, 50));

    // 봇이 스페이스에 추가됐을 때
    if (event.type === 'ADDED_TO_SPACE') {
      return res.json({
        text: '👋 안녕하세요! *Roadmap 봇*입니다.\n"도움말" 이라고 입력하면 사용법을 알려드려요.',
      });
    }

    // 스페이스에서 제거됐을 때
    if (event.type === 'REMOVED_FROM_SPACE') {
      return res.sendStatus(200);
    }

    // 메시지 수신
    if (event.type === 'MESSAGE') {
      const userMessage = event.message?.text || '';

      if (!userMessage.trim()) {
        return res.json({ text: '메시지를 입력해주세요.' });
      }

      // 로딩 표시를 위해 즉시 응답하지 않고 처리 후 반환
      const response = await processMessage(userMessage);
      return res.json({ text: response });
    }

    res.sendStatus(200);

  } catch (error) {
    console.error('[webhook error]', error);
    res.json({ text: `오류가 발생했습니다: ${error.message}` });
  }
});

// ─── 메시지 처리 ───────────────────────────────────────────────────
async function processMessage(message) {
  try {
    // 1. 액션 처리 시도 (이슈 생성, 상태 변경 등)
    const actionResult = await handleAction(message);
    if (actionResult) return actionResult;

    // 2. 조회 처리 (현황 조회, 검색 등)
    return await handleQuery(message);

  } catch (error) {
    console.error('[processMessage error]', error);

    // Ollama 연결 실패
    if (error.message.includes('Ollama')) {
      return `⚠️ AI 서버(Ollama)에 연결할 수 없습니다.\nMac Mini가 켜져 있는지 확인해주세요.\n\n기본 조회는 계속 사용할 수 있습니다:\n• "진행 중인 작업"\n• "이번주 작업"\n• "홍길동 작업"`;
    }

    return `오류가 발생했습니다: ${error.message}`;
  }
}

// ─── 서버 시작 ────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🤖 Roadmap 챗봇 서버 시작: http://localhost:${PORT}`);
  console.log(`📡 웹훅 주소: http://localhost:${PORT}/webhook`);
  console.log(`🔍 헬스체크: http://localhost:${PORT}/health\n`);

  // Ollama 연결 확인
  const ollamaOk = await checkOllamaHealth();
  if (ollamaOk) {
    console.log(`✅ Ollama 연결 성공 (${process.env.OLLAMA_URL || 'http://localhost:11434'})`);
  } else {
    console.warn(`⚠️  Ollama 연결 실패 - Mac Mini 설정 후 재시작 필요`);
  }

  console.log(`\n모델: ${process.env.OLLAMA_MODEL || 'qwen2.5:14b'}`);
  console.log('준비 완료!\n');
});
