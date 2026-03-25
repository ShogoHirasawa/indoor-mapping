-- Global organization for OSM-style shared map editing
-- Audit logs for "who edited what when"

-- 1. Create Global organization (fixed ID for signup flow)
INSERT INTO indoor.organizations (id, name)
VALUES ('c0eebc99-0000-4ef8-bb6d-6bb9bd380a11', 'Global')
ON CONFLICT (id) DO NOTHING;

-- 2. Audit logs table
CREATE TABLE indoor.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON indoor.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user_id ON indoor.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON indoor.audit_logs(created_at);

-- 3. Grant access for anon/authenticated
GRANT SELECT, INSERT ON indoor.audit_logs TO anon;
GRANT SELECT, INSERT ON indoor.audit_logs TO authenticated;

-- 4. RLS for audit_logs (authenticated users can insert, read own org's logs via entity)
ALTER TABLE indoor.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow insert by authenticated users (trigger runs as table owner, may need SECURITY DEFINER)
CREATE POLICY audit_insert ON indoor.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow read by authenticated users (for history display)
CREATE POLICY audit_select ON indoor.audit_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 5. Trigger function for audit logging
CREATE OR REPLACE FUNCTION indoor.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = indoor
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO indoor.audit_logs (entity_type, entity_id, action, user_id, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, 'create', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO indoor.audit_logs (entity_type, entity_id, action, user_id, old_values, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, 'update', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO indoor.audit_logs (entity_type, entity_id, action, user_id, old_values)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 6. Attach triggers to key tables
CREATE TRIGGER audit_venues
  AFTER INSERT OR UPDATE OR DELETE ON indoor.venues
  FOR EACH ROW EXECUTE FUNCTION indoor.audit_trigger_func();

CREATE TRIGGER audit_buildings
  AFTER INSERT OR UPDATE OR DELETE ON indoor.buildings
  FOR EACH ROW EXECUTE FUNCTION indoor.audit_trigger_func();

CREATE TRIGGER audit_levels
  AFTER INSERT OR UPDATE OR DELETE ON indoor.levels
  FOR EACH ROW EXECUTE FUNCTION indoor.audit_trigger_func();

CREATE TRIGGER audit_spaces
  AFTER INSERT OR UPDATE OR DELETE ON indoor.spaces
  FOR EACH ROW EXECUTE FUNCTION indoor.audit_trigger_func();

CREATE TRIGGER audit_openings
  AFTER INSERT OR UPDATE OR DELETE ON indoor.openings
  FOR EACH ROW EXECUTE FUNCTION indoor.audit_trigger_func();

CREATE TRIGGER audit_vertical_connectors
  AFTER INSERT OR UPDATE OR DELETE ON indoor.vertical_connectors
  FOR EACH ROW EXECUTE FUNCTION indoor.audit_trigger_func();

CREATE TRIGGER audit_routing_nodes
  AFTER INSERT OR UPDATE OR DELETE ON indoor.routing_nodes
  FOR EACH ROW EXECUTE FUNCTION indoor.audit_trigger_func();

CREATE TRIGGER audit_routing_edges
  AFTER INSERT OR UPDATE OR DELETE ON indoor.routing_edges
  FOR EACH ROW EXECUTE FUNCTION indoor.audit_trigger_func();

CREATE TRIGGER audit_amenities
  AFTER INSERT OR UPDATE OR DELETE ON indoor.amenities
  FOR EACH ROW EXECUTE FUNCTION indoor.audit_trigger_func();

CREATE TRIGGER audit_occupants
  AFTER INSERT OR UPDATE OR DELETE ON indoor.occupants
  FOR EACH ROW EXECUTE FUNCTION indoor.audit_trigger_func();
