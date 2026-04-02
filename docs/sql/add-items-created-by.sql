ALTER TABLE items
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
