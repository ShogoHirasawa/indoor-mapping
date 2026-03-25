-- Venue hierarchy: venues, buildings, levels

CREATE TABLE indoor.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES indoor.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  address text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  source_record_id uuid REFERENCES indoor.source_records(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE indoor.buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES indoor.venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  external_id text,
  footprint_geom geometry(MultiPolygon, 4326),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  source_record_id uuid REFERENCES indoor.source_records(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE indoor.levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES indoor.buildings(id) ON DELETE CASCADE,
  name text NOT NULL,
  ordinal integer NOT NULL,
  short_name text,
  floorplan_attachment_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- floorplan_attachment_id FK added in 007 (attachments table)
-- Unique ordinal per building
CREATE UNIQUE INDEX idx_levels_building_ordinal ON indoor.levels(building_id, ordinal);

CREATE INDEX idx_venues_organization_id ON indoor.venues(organization_id);
CREATE INDEX idx_buildings_venue_id ON indoor.buildings(venue_id);
CREATE INDEX idx_levels_building_id ON indoor.levels(building_id);
