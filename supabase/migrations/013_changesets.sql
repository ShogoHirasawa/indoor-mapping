-- OSM-style changesets: group edits for upload and revert-by-changeset

-- 1. Changesets table (one row per "Upload")
CREATE TABLE indoor.changesets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_changesets_user_id ON indoor.changesets(user_id);
CREATE INDEX idx_changesets_created_at ON indoor.changesets(created_at);

-- 2. Link audit_logs to changeset (nullable: edits outside Upload have no changeset)
ALTER TABLE indoor.audit_logs
  ADD COLUMN changeset_id uuid REFERENCES indoor.changesets(id) ON DELETE SET NULL;

CREATE INDEX idx_audit_logs_changeset_id ON indoor.audit_logs(changeset_id);

-- 3. Update trigger to store current changeset_id from session variable
-- App sets: SET LOCAL app.current_changeset_id = '<uuid>' at start of Upload transaction
CREATE OR REPLACE FUNCTION indoor.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = indoor
AS $$
DECLARE
  cid uuid;
BEGIN
  cid := NULLIF(trim(current_setting('app.current_changeset_id', true)), '')::uuid;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO indoor.audit_logs (entity_type, entity_id, action, user_id, new_values, changeset_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'create', auth.uid(), to_jsonb(NEW), cid);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO indoor.audit_logs (entity_type, entity_id, action, user_id, old_values, new_values, changeset_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'update', auth.uid(), to_jsonb(OLD), to_jsonb(NEW), cid);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO indoor.audit_logs (entity_type, entity_id, action, user_id, old_values, changeset_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', auth.uid(), to_jsonb(OLD), cid);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 4. RLS for changesets
ALTER TABLE indoor.changesets ENABLE ROW LEVEL SECURITY;

CREATE POLICY changesets_insert ON indoor.changesets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY changesets_select ON indoor.changesets
  FOR SELECT USING (true);

-- 5. Grants
GRANT SELECT, INSERT ON indoor.changesets TO anon;
GRANT SELECT, INSERT ON indoor.changesets TO authenticated;
