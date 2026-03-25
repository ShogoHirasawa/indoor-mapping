-- Spatial entities: spaces, openings, vertical_connectors

CREATE TABLE indoor.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES indoor.levels(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES indoor.buildings(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES indoor.venues(id) ON DELETE CASCADE,
  name text,
  space_type text NOT NULL,
  geom geometry(Geometry, 4326) NOT NULL,
  accessibility_type text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  source_record_id uuid REFERENCES indoor.source_records(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_space_geom_valid CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))
);

CREATE TABLE indoor.openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES indoor.levels(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES indoor.buildings(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES indoor.venues(id) ON DELETE CASCADE,
  name text,
  opening_type text NOT NULL,
  geom geometry(Geometry, 4326) NOT NULL,
  connected_space_id uuid REFERENCES indoor.spaces(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  source_record_id uuid REFERENCES indoor.source_records(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_opening_geom_valid CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))
);

CREATE TABLE indoor.vertical_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES indoor.buildings(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES indoor.venues(id) ON DELETE CASCADE,
  connector_group_id uuid NOT NULL,
  level_id uuid NOT NULL REFERENCES indoor.levels(id) ON DELETE CASCADE,
  connector_type text NOT NULL,
  directionality text,
  geom geometry(Point, 4326) NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  source_record_id uuid REFERENCES indoor.source_records(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_connector_geom_valid CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))
);

CREATE INDEX idx_spaces_level_id ON indoor.spaces(level_id);
CREATE INDEX idx_spaces_building_id ON indoor.spaces(building_id);
CREATE INDEX idx_spaces_venue_id ON indoor.spaces(venue_id);

CREATE INDEX idx_openings_level_id ON indoor.openings(level_id);
CREATE INDEX idx_openings_building_id ON indoor.openings(building_id);
CREATE INDEX idx_openings_venue_id ON indoor.openings(venue_id);

CREATE INDEX idx_vertical_connectors_building_id ON indoor.vertical_connectors(building_id);
CREATE INDEX idx_vertical_connectors_venue_id ON indoor.vertical_connectors(venue_id);
CREATE INDEX idx_vertical_connectors_level_id ON indoor.vertical_connectors(level_id);
CREATE INDEX idx_vertical_connectors_group_id ON indoor.vertical_connectors(connector_group_id);
