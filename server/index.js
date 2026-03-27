import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// CORS 설정 (React 앱에서 접근 가능하도록)
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:1234', 'https://roadmap.ai-quazar.uk'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// 업로드 디렉토리 설정
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

// 업로드 디렉토리가 없으면 생성
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 정적 파일 서빙 (업로드된 파일 접근)
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// 파일 타입 검증
const ALLOWED_FILE_TYPES = {
  // 이미지
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  // PDF
  'application/pdf': ['.pdf'],
  // MS Office 문서
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-powerpoint': ['.ppt']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Multer 설정 (메모리 저장소 사용 - 파일 검증 후 직접 저장)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// 파일명 sanitize (안전한 파일명으로 변환)
function sanitizeFilename(filename) {
  // 파일명에서 위험한 문자 제거, 한글과 영문, 숫자, 하이픈, 언더스코어만 허용
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  
  // 특수문자 제거 및 공백을 언더스코어로 변환
  const sanitized = basename
    .replace(/[^\w\sㄱ-힣.-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100); // 파일명 길이 제한
  
  return sanitized + ext;
}

// 파일 타입 검증 함수
function isAllowedFileType(mimetype, filename) {
  const ext = path.extname(filename).toLowerCase();
  const allowedExtensions = ALLOWED_FILE_TYPES[mimetype];
  
  if (!allowedExtensions) {
    return false;
  }
  
  return allowedExtensions.includes(ext);
}

// 파일 업로드 API
app.post('/upload/:itemId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 제공되지 않았습니다.' });
    }

    const { itemId } = req.params;
    const file = req.file;

    // multer는 multipart 파일명을 latin1로 디코딩 → UTF-8 한글 깨짐 방지
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    // 파일 타입 검증
    if (!isAllowedFileType(file.mimetype, originalName)) {
      return res.status(400).json({
        error: '지원하지 않는 파일 형식입니다. (이미지, PDF, DOCX만 허용)'
      });
    }

    // 파일 크기 검증 (multer limits에서도 체크하지만 명시적으로 한번 더)
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `파일 크기가 너무 큽니다. (최대 ${MAX_FILE_SIZE / 1024 / 1024}MB)`
      });
    }

    // 아이템별 디렉토리 생성
    const itemDir = path.join(UPLOAD_DIR, itemId);
    if (!fs.existsSync(itemDir)) {
      fs.mkdirSync(itemDir, { recursive: true });
    }

    // 파일명 생성 (타임스탬프 + sanitized 원본 파일명)
    const timestamp = Date.now();
    const sanitizedName = sanitizeFilename(originalName);
    const filename = `${timestamp}_${sanitizedName}`;
    const filepath = path.join(itemDir, filename);

    // 파일 저장
    fs.writeFileSync(filepath, file.buffer);

    // 파일 URL 반환
    const fileUrl = `/uploads/${itemId}/${filename}`;

    res.json({
      success: true,
      url: fileUrl,
      filename: filename,
      originalName: originalName,
      mimetype: file.mimetype,
      size: file.size
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
  }
});

// 파일 삭제 API
app.delete('/uploads/:itemId/:filename', async (req, res) => {
  try {
    const { itemId, filename } = req.params;

    // 파일 경로 생성
    const filepath = path.join(UPLOAD_DIR, itemId, filename);

    // 파일 존재 확인
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    // 파일 삭제
    fs.unlinkSync(filepath);

    // 디렉토리가 비어있으면 삭제
    const itemDir = path.join(UPLOAD_DIR, itemId);
    const files = fs.readdirSync(itemDir);
    if (files.length === 0) {
      fs.rmdirSync(itemDir);
    }

    res.json({ success: true, message: '파일이 삭제되었습니다.' });

  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({ error: '파일 삭제 중 오류가 발생했습니다.' });
  }
});

// 아이템 전체 파일 삭제 API (아이템 삭제 시 사용)
app.delete('/uploads/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const itemDir = path.join(UPLOAD_DIR, itemId);

    if (!fs.existsSync(itemDir)) {
      return res.status(404).json({ error: '폴더를 찾을 수 없습니다.' });
    }

    // 디렉토리 및 모든 파일 삭제
    fs.rmSync(itemDir, { recursive: true, force: true });

    res.json({ success: true, message: '모든 파일이 삭제되었습니다.' });

  } catch (error) {
    console.error('Directory delete error:', error);
    res.status(500).json({ error: '폴더 삭제 중 오류가 발생했습니다.' });
  }
});

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'File server is running' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`\n📁 File server is running on http://localhost:${PORT}`);
  console.log(`📂 Upload directory: ${UPLOAD_DIR}`);
  console.log(`✅ Ready to accept file uploads\n`);
});
