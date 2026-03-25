# Indoor Mapping Database Schema

## Overview

The indoor mapping platform uses a custom schema `indoor` in Supabase/PostgreSQL with PostGIS for spatial data. IMDF is used as an exchange format; the database holds the canonical data.

## Schema: `indoor`

### Entity Relationship

```
organizations
    ├── organization_memberships (user_id → auth.users)
    ├── venues
    │   ├── buildings
    │   │   ├── levels
    │   │   │   ├── spaces
    │   │   │   ├── openings
    │   │   │   ├── vertical_connectors
    │   │   │   ├── amenities
    │   │   │   └── occupants
    │   │   └── routing_nodes
    │   │       └── routing_edges
    ├── attachments
    ├── change_requests
    ├── import_jobs
    └── export_jobs

source_records (referenced by venues, buildings, spaces, etc.)
```

### Tables

| Table | Description |
|-------|-------------|
| organizations | Organization (facility owner). Includes "Global" org for OSM-style shared map |
| audit_logs | Who edited what when (create/update/delete on venues, buildings, spaces, etc.) |
| organization_memberships | User-organization link (role: owner/editor/viewer) |
| source_records | Data source metadata (floorplan, imdf_import, etc.) |
| venues | Facility (mall, hospital, etc.) |
| buildings | Building within a venue |
| levels | Floor/level within a building |
| spaces | Room, corridor, lobby (Polygon/MultiPolygon) |
| openings | Door, entrance, gate (Point/LineString) |
| vertical_connectors | Stairs, elevator, escalator |
| routing_nodes | Routing graph nodes |
| routing_edges | Routing graph edges |
| amenities | Restroom, ATM, info desk |
| occupants | Tenant, shop |
| attachments | Storage file metadata |
| change_requests | Publish/change requests |
| import_jobs | IMDF import job records |
| export_jobs | IMDF export job records |

### Status Values

All status-bearing entities use: `draft`, `review`, `published`, `archived`.

### Geometry

- SRID: 4326 (WGS84)
- Spaces: Polygon or MultiPolygon
- Openings: Point or LineString
- Vertical connectors: Point
- Routing nodes: Point
- Routing edges: LineString (nullable)

### RLS

All tables have Row Level Security. Users access only data for organizations they belong to via `organization_memberships`.

### Audit Logs (OSM-style)

`audit_logs` records who created/updated/deleted what. Triggers on venues, buildings, levels, spaces, openings, vertical_connectors, routing_nodes, routing_edges, amenities, occupants. Columns: entity_type, entity_id, action, user_id, old_values, new_values, created_at.
