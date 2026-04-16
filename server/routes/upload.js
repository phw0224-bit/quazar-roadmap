import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

function sanitizeFilename(filename) {
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  const sanitized = basename
    .replace(/[^\w\sㄱ-힣.-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
  return sanitized + ext;
}

function isAllowedFileType(mimetype, filename) {
  const ext = path.extname(filename).toLowerCase();
  const allowedExtensions = ALLOWED_FILE_TYPES[mimetype];
  if (!allowedExtensions) return false;
  return allowedExtensions.includes(ext);
}

const router = Router();

router.post('/upload/:itemId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 제공되지 않았습니다.' });
    }

    const { itemId } = req.params;
    const file = req.file;
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    if (!isAllowedFileType(file.mimetype, originalName)) {
      return res.status(400).json({
        error: '지원하지 않는 파일 형식입니다. (이미지, PDF, DOCX만 허용)',
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `파일 크기가 너무 큽니다. (최대 ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
      });
    }

    const itemDir = path.join(UPLOAD_DIR, itemId);
    if (!fs.existsSync(itemDir)) {
      fs.mkdirSync(itemDir, { recursive: true });
    }

    const timestamp = Date.now();
    const sanitizedName = sanitizeFilename(originalName);
    const filename = `${timestamp}_${sanitizedName}`;
    const filepath = path.join(itemDir, filename);

    fs.writeFileSync(filepath, file.buffer);

    res.json({
      success: true,
      url: `/uploads/${itemId}/${filename}`,
      filename,
      originalName,
      mimetype: file.mimetype,
      size: file.size,
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
  }
});

router.delete('/uploads/:itemId/:filename', async (req, res) => {
  try {
    const { itemId, filename } = req.params;
    const filepath = path.join(UPLOAD_DIR, itemId, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    fs.unlinkSync(filepath);

    const itemDir = path.join(UPLOAD_DIR, itemId);
    if (fs.readdirSync(itemDir).length === 0) {
      fs.rmdirSync(itemDir);
    }

    res.json({ success: true, message: '파일이 삭제되었습니다.' });
  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({ error: '파일 삭제 중 오류가 발생했습니다.' });
  }
});

router.delete('/uploads/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const itemDir = path.join(UPLOAD_DIR, itemId);

    if (!fs.existsSync(itemDir)) {
      return res.status(404).json({ error: '폴더를 찾을 수 없습니다.' });
    }

    fs.rmSync(itemDir, { recursive: true, force: true });
    res.json({ success: true, message: '모든 파일이 삭제되었습니다.' });
  } catch (error) {
    console.error('Directory delete error:', error);
    res.status(500).json({ error: '폴더 삭제 중 오류가 발생했습니다.' });
  }
});

export { UPLOAD_DIR };
export const uploadRouter = router;
