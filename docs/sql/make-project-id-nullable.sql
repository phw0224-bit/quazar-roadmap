-- Migration: Make items.project_id nullable + Add board_type column
-- Description: Allow general documents to exist without a project
-- Created: 2026-04-07

-- 1. Add board_type column to items (팀별 문서 분리)
ALTER TABLE items ADD COLUMN board_type text DEFAULT 'main';

-- 2. Update board_type from project references for existing items
UPDATE items i
SET board_type = p.board_type
FROM projects p
WHERE i.project_id = p.id AND i.board_type = 'main';

-- 3. Make project_id nullable (allow documents without projects)
ALTER TABLE items ALTER COLUMN project_id DROP NOT NULL;

-- 4. Add data integrity constraint
-- Rule: If project_id is null, then page_type must be 'page'
-- This ensures only documents (page_type='page') can exist without a project
ALTER TABLE items ADD CONSTRAINT check_page_without_project
  CHECK (project_id IS NOT NULL OR page_type = 'page');

-- 5. Create index for faster general document queries
-- Query pattern: WHERE board_type=X AND project_id IS NULL AND page_type='page'
CREATE INDEX IF NOT EXISTS idx_items_board_general_docs
ON items(board_type, project_id, page_type)
WHERE project_id IS NULL AND page_type = 'page';

-- 6. Create index for ordering general documents
CREATE INDEX IF NOT EXISTS idx_items_order_by_board_type
ON items(board_type, order_index)
WHERE project_id IS NULL AND page_type = 'page';

-- 7. Create index on board_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_items_board_type
ON items(board_type);
