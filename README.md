# Indoor Mapping Platform

Indoor space data management platform using IMDF as exchange format and Supabase as the canonical database.

## Features

- Venue, building, level, space, opening, and routing graph management
- Organization-based access control (RLS)
- Status workflow: draft / review / published / archived
- IMDF import/export (scripts)
- PostGIS for spatial data

## Quick Start

1. **Environment**: Copy `.env.example` to `.env.local` and set Supabase credentials.

2. **Database (CLI)**:
   ```bash
   npx supabase login   # Once: opens browser to authenticate
   npm run db:setup     # Link + push migrations + seed
   ```
   Or manually: `npm run db:link` then `npm run db:push` then `npm run db:seed`.

3. **Access**: Add yourself to the sample organization (requires auth context; run in Supabase Dashboard SQL Editor while logged in, or from your app):
   ```sql
   INSERT INTO indoor.organization_memberships (organization_id, user_id, role)
   SELECT id, auth.uid(), 'owner' FROM indoor.organizations WHERE name = 'Sample Organization' LIMIT 1;
   ```

## Documentation

- [Setup Guide](docs/setup.md)
- [Schema Reference](docs/schema.md)
- [API Overview](docs/api.md)

## Project Structure

```
supabase/
  migrations/     # SQL migrations (PostGIS, indoor schema, RLS)
  seed.sql        # Sample data
  config.toml     # Supabase config
scripts/
  imdf/           # Import/export scripts
docs/
  schema.md
  setup.md
  api.md
```

## Spec

Implementation follows [cursor_imdf_supabase_v_1_implementation_spec.md](cursor_imdf_supabase_v_1_implementation_spec.md).
