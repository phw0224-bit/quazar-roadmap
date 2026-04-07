-- 개인 메모장 기능 추가
-- 개인 메모 여부, 소유자 ID 필드 추가

ALTER TABLE items
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

ALTER TABLE items
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

-- 인덱스 추가: 개인 메모 조회 성능 최적화
CREATE INDEX IF NOT EXISTS idx_items_is_private_owner_id
ON items(is_private, owner_id)
WHERE is_private = true;
