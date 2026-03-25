-- Grant service_role access to indoor schema (for server/script use with SUPABASE_SERVICE_ROLE_KEY)
-- Fixes: "permission denied for schema indoor" when running export-imdf.ts

GRANT USAGE ON SCHEMA indoor TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA indoor TO service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA indoor TO service_role;
