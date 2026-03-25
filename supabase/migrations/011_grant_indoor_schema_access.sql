-- Grant anon and authenticated roles access to indoor schema
-- Required for Supabase REST API to query indoor tables (RLS still applies)

GRANT USAGE ON SCHEMA indoor TO anon;
GRANT USAGE ON SCHEMA indoor TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA indoor TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA indoor TO authenticated;
