import { Upload } from 'lucide-react';
import { useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function FileUploadButton({ 
  itemId, 
  onUploadSuccess, 
  onUploadError 
}) {
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      try {
        // 파일 크기 검증 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('파일 크기는 10MB를 초과할 수 없습니다.');
        }

        // FormData 생성
        const formData = new FormData();
        formData.append('file', file);

        // 파일 업로드
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const token = data.session?.access_token;
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`/upload/${itemId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '파일 업로드에 실패했습니다.');
        }

        const result = await response.json();
        onUploadSuccess?.(result);
      } catch (error) {
        console.error('File upload error:', error);
        onUploadError?.(error);
      }
    }

    // 파일 선택 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        onChange={handleFileSelect}
        className="hidden"
        id={`file-upload-${itemId}`}
      />
      <label
        htmlFor={`file-upload-${itemId}`}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-text-secondary bg-white dark:bg-bg-elevated border border-gray-300 dark:border-border-subtle rounded-lg hover:bg-gray-50 dark:hover:bg-bg-hover cursor-pointer transition-colors"
      >
        <Upload size={16} />
        파일 첨부
      </label>
    </div>
  );
}
