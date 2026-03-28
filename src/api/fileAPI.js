/**
 * @fileoverview Express 서버(:3001) 파일 업로드/삭제 클라이언트. axios 사용.
 *
 * 서버 저장 경로: server/uploads/{itemId}/{sanitized-filename}
 * 허용 타입: 이미지(image/*), PDF, Office 문서. 최대 10MB.
 * 클라이언트 측에서도 MIME 사전 검증 (서버 검증과 이중 체크).
 *
 * uploadFile 반환: { url, filename, originalName, mimetype, size }
 */
import axios from 'axios';

const FILE_SERVER_URL = '';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// 허용된 파일 타입
const ALLOWED_MIME_TYPES = {
  // 이미지
  'image/jpeg': true,
  'image/png': true,
  'image/gif': true,
  'image/webp': true,
  'image/svg+xml': true,
  // PDF
  'application/pdf': true,
  // MS Office 문서
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true, // .docx
  'application/msword': true, // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true, // .xlsx
  'application/vnd.ms-excel': true, // .xls
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': true, // .pptx
  'application/vnd.ms-powerpoint': true, // .ppt
};

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
];

/**
 * 파일 타입이 허용되는지 검증
 */
function validateFileType(file) {
  const filename = file.name.toLowerCase();
  const extension = '.' + filename.split('.').pop();
  
  // MIME 타입 검증
  if (!ALLOWED_MIME_TYPES[file.type]) {
    return {
      valid: false,
      error: '지원하지 않는 파일 형식입니다. (이미지, PDF, Office 문서만 허용)'
    };
  }
  
  // 확장자 검증 (이중 체크)
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: '지원하지 않는 파일 확장자입니다.'
    };
  }
  
  return { valid: true };
}

/**
 * 파일 크기가 허용 범위 내인지 검증
 */
function validateFileSize(file) {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `파일 크기가 너무 큽니다. (최대 ${MAX_FILE_SIZE / 1024 / 1024}MB)`
    };
  }
  
  return { valid: true };
}

/**
 * 파일을 서버에 업로드
 * @param {File} file - 업로드할 파일
 * @param {string} itemId - 아이템 ID
 * @param {function} onProgress - 업로드 진행 상황 콜백 (선택)
 * @returns {Promise<{url: string, filename: string, originalName: string, mimetype: string, size: number}>}
 */
export async function uploadFile(file, itemId, onProgress) {
  // 파일 타입 검증
  const typeValidation = validateFileType(file);
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error);
  }
  
  // 파일 크기 검증
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error);
  }
  
  // FormData 생성
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await axios.post(
      `${FILE_SERVER_URL}/upload/${itemId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        },
      }
    );
    
    if (response.data.success) {
      return {
        url: response.data.url,
        filename: response.data.filename,
        originalName: response.data.originalName,
        mimetype: response.data.mimetype,
        size: response.data.size,
      };
    } else {
      throw new Error('파일 업로드에 실패했습니다.');
    }
  } catch (error) {
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('파일 업로드 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 파일 삭제
 * @param {string} itemId - 아이템 ID
 * @param {string} filename - 파일명
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteFile(itemId, filename) {
  try {
    const response = await axios.delete(
      `${FILE_SERVER_URL}/uploads/${itemId}/${filename}`
    );
    
    return response.data;
  } catch (error) {
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('파일 삭제 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 아이템의 모든 파일 삭제
 * @param {string} itemId - 아이템 ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteAllFiles(itemId) {
  try {
    const response = await axios.delete(
      `${FILE_SERVER_URL}/uploads/${itemId}`
    );
    
    return response.data;
  } catch (error) {
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('파일 삭제 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 파일 URL 생성
 * @param {string} itemId - 아이템 ID
 * @param {string} filename - 파일명
 * @returns {string} 파일 URL
 */
export function getFileUrl(itemId, filename) {
  return `${FILE_SERVER_URL}/uploads/${itemId}/${filename}`;
}

/**
 * 파일이 이미지인지 확인
 * @param {string} mimetype - MIME 타입
 * @returns {boolean}
 */
export function isImage(mimetype) {
  return mimetype?.startsWith('image/');
}

/**
 * 파일이 PDF인지 확인
 * @param {string} mimetype - MIME 타입
 * @returns {boolean}
 */
export function isPDF(mimetype) {
  return mimetype === 'application/pdf';
}

/**
 * 파일이 Office 문서인지 확인
 * @param {string} mimetype - MIME 타입
 * @returns {boolean}
 */
export function isOfficeDocument(mimetype) {
  return mimetype?.includes('officedocument') || 
         mimetype === 'application/msword' ||
         mimetype === 'application/vnd.ms-excel' ||
         mimetype === 'application/vnd.ms-powerpoint';
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 * @param {number} bytes - 바이트 크기
 * @returns {string} 포맷된 크기 (예: "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export default {
  uploadFile,
  deleteFile,
  deleteAllFiles,
  getFileUrl,
  isImage,
  isPDF,
  isOfficeDocument,
  formatFileSize,
};
