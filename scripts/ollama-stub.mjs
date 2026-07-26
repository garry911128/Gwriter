// 假的 Ollama /api/chat，給 E2E 用。
//
// 真的 Ollama 在 CI 裡要拉好幾 GB 的模型，而且 LLM 輸出不確定會讓測試 flaky。
// 這支只回固定字串，讓「按下 AI 按鈕 → 建議出現 → 採用建議」這條路徑可以被穩定驗證。
//
//   node scripts/ollama-stub.mjs [port]

import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? process.env.OLLAMA_STUB_PORT ?? 11435);
const REPLY = 'E2E 固定回應：山上有座廟。';

const server = createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.startsWith('/api/chat')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  // 讀完 body 再回應，避免後端收到 connection reset
  req.resume();
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: { role: 'assistant', content: REPLY } }));
  });
});

server.listen(port, () => {
  console.log(`ollama stub listening on http://127.0.0.1:${port}`);
});
