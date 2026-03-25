-- Create storage buckets for indoor mapping assets
-- Per spec: floorplans, venue-assets, imports, exports, qa-assets
-- Note: If this fails (e.g. storage schema differs), create buckets via Supabase Dashboard

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('floorplans', 'floorplans', false),
  ('venue-assets', 'venue-assets', false),
  ('imports', 'imports', false),
  ('exports', 'exports', false),
  ('qa-assets', 'qa-assets', false)
ON CONFLICT (id) DO NOTHING;
