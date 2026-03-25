# Indoor Mapping API Overview

## Scope (ver1.0)

- **CRUD**: Next.js API routes (`/api/indoor/:resource`) and/or Supabase client directly (RLS applies).
- **Import/Export**: Scripts in `scripts/imdf/` (service role, run outside browser).

## CRUD Targets

All of these support create / read / update / archive (or delete):

- venues, buildings, levels, spaces, openings, vertical_connectors, routing_nodes, routing_edges, amenities, occupants

---

## Next.js CRUD API (`/api/indoor/...`)

Requires **authenticated user** (session). RLS restricts data to organizations the user belongs to.

Base path: **`/api/indoor/:resource`** where `:resource` is one of:  
`venues`, `buildings`, `levels`, `spaces`, `openings`, `vertical_connectors`, `routing_nodes`, `routing_edges`, `amenities`, `occupants`.

### List (GET)

| Resource | Required query | Example |
|----------|----------------|---------|
| venues | `organization_id` | `GET /api/indoor/venues?organization_id=xxx` |
| buildings | `venue_id` | `GET /api/indoor/buildings?venue_id=xxx` |
| levels | `building_id` | `GET /api/indoor/levels?building_id=xxx` |
| spaces | `level_id` (or `building_id`, `venue_id`) | `GET /api/indoor/spaces?level_id=xxx` |
| openings | `level_id` | `GET /api/indoor/openings?level_id=xxx` |
| vertical_connectors | `building_id` | `GET /api/indoor/vertical_connectors?building_id=xxx` |
| routing_nodes | `building_id` | `GET /api/indoor/routing_nodes?building_id=xxx` |
| routing_edges | `building_id` | `GET /api/indoor/routing_edges?building_id=xxx` |
| amenities | `level_id` | `GET /api/indoor/amenities?level_id=xxx` |
| occupants | `level_id` | `GET /api/indoor/occupants?level_id=xxx` |

### Single (GET)

- `GET /api/indoor/:resource/:id` — returns one row or 404.

### Create (POST)

- `POST /api/indoor/:resource` — body: JSON with required columns (e.g. `organization_id`, `name` for venues). `created_by` / `updated_by` are set server-side. Returns 201 + created row.
- For tables with geometry (`spaces`, `openings`, `amenities`, `vertical_connectors`, `routing_nodes`, `routing_edges`), send `geom` as **WKT** (e.g. `SRID=4326;POINT(139.75 35.68)`, `SRID=4326;POLYGON((...))`).

### Update (PATCH)

- `PATCH /api/indoor/:resource/:id` — body: JSON with fields to update. Returns updated row.

### Delete / Archive (DELETE)

- For **venues, buildings, levels, spaces, openings, vertical_connectors, amenities, occupants**: DELETE sets `status = 'archived'` (soft-delete).
- For **routing_nodes, routing_edges**: DELETE performs hard delete.

---

## Supabase Client (alternative)

You can also use the Supabase client with `.schema('indoor')`; RLS applies the same. Example:

```typescript
const { data } = await supabase
  .schema('indoor')
  .from('venues')
  .select('*')
  .eq('organization_id', orgId);

const { data: levels } = await supabase
  .schema('indoor')
  .from('levels')
  .select('*')
  .eq('building_id', buildingId)
  .order('ordinal');
```

## Schema Prefix

Tables live in the `indoor` schema. When using the Next.js API, the schema is applied server-side. When using the Supabase client directly, use `.schema('indoor')` or configure `schemas` in the project so `indoor` is exposed.

## Import/Export

IMDF import and export are implemented as scripts (see `scripts/imdf/`). They run outside the browser and use the service role for bulk operations.
