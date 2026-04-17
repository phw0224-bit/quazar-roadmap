import express from 'express';
import cors from 'cors';
import { PORT } from './lib/config.js';
import { githubRouter } from './routes/github.js';
import { notificationsRouter } from './routes/notifications.js';
import { uploadRouter, UPLOAD_DIR } from './routes/upload.js';
import { summarizeRouter } from './routes/summarize.js';

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:1234', 'https://roadmap.ai-quazar.uk'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json({
  verify: (req, _res, buffer) => {
    req.rawBody = buffer;
  },
}));

app.use('/uploads', express.static(UPLOAD_DIR));

app.use('/api/github', githubRouter);
app.use('/', notificationsRouter);
app.use('/', uploadRouter);
app.use('/', summarizeRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'File server is running' });
});

app.listen(PORT, () => {
  console.log(`\n📁 File server is running on http://localhost:${PORT}`);
  console.log(`📂 Upload directory: ${UPLOAD_DIR}`);
  console.log(`✅ Ready to accept file uploads\n`);
});
