# Indoor Mapping Setup Guide

## Prerequisites

- Node.js 18+
- Supabase project (existing or new)
- Supabase CLI (optional, for local development)

## 1. Environment Variables

Copy `.env.example` to `.env.local` and set:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For admin operations
```

## 2. Database Migrations

### Option A: Supabase Dashboard

1. Go to SQL Editor in your Supabase project
2. Run each migration file in order from `supabase/migrations/` (001 through 010)
   - 001_enable_postgis.sql
   - 002_create_indoor_schema.sql
   - 003_create_base_tables.sql
   - ... through 010_create_storage_buckets.sql

### Option B: Supabase CLI

```bash
# One-time: authenticate (opens browser)
npx supabase login

# Link + push + seed (project ref from .env.local)
npm run db:setup
```

Or step by step: `npm run db:link` → `npm run db:push` → `npm run db:seed`.

## 3. Access Seed Data

After running migrations and seed, add yourself to the sample organization. **This step cannot be done via CLI** (it requires `auth.uid()` which only exists in an authenticated session). Run in Supabase Dashboard SQL Editor while logged in, or from your app:

```sql
INSERT INTO indoor.organization_memberships (organization_id, user_id, role)
SELECT id, auth.uid(), 'owner'
FROM indoor.organizations
WHERE name = 'Sample Organization'
LIMIT 1;
```

Run this in the SQL Editor while logged in, or via an API route that uses the authenticated user.

## 4. Storage Buckets

Migrations create these buckets:

- `floorplans` - Floor plan PDFs/images
- `venue-assets` - Photos, assets
- `imports` - IMDF zip input files
- `exports` - IMDF zip output files
- `qa-assets` - QA images

Configure bucket policies in Supabase Dashboard if needed.

## 5. Expose indoor Schema (Hosted Supabase)

For the REST API to access `indoor` tables, add `indoor` to exposed schemas:

- Dashboard → Project Settings → API → Exposed schemas (or similar)
- Or ensure `schemas` in `supabase/config.toml` includes `indoor` when using CLI

## 6. Verify

- Migration runs without errors
- Seed runs without errors
- You can query `indoor.venues` after adding yourself to the organization
