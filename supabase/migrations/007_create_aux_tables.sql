-- Auxiliary tables: amenities, occupants, attachments, change_requests, import_jobs, export_jobs

CREATE TABLE indoor.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES indoor.organizations(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES indoor.venues(id) ON DELETE CASCADE,
  building_id uuid REFERENCES indoor.buildings(id) ON DELETE CASCADE,
  level_id uuid REFERENCES indoor.levels(id) ON DELETE CASCADE,
  attachment_type text NOT NULL,
  bucket_name text NOT NULL,
  object_path text NOT NULL,
  mime_type text,
  file_size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE indoor.amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES indoor.levels(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES indoor.buildings(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES indoor.venues(id) ON DELETE CASCADE,
  amenity_type text NOT NULL,
  name text,
  geom geometry(Point, 4326) NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_amenity_geom_valid CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))
);

CREATE TABLE indoor.occupants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES indoor.levels(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES indoor.buildings(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES indoor.venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  related_space_id uuid REFERENCES indoor.spaces(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE indoor.change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES indoor.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  requested_action text NOT NULL,
  request_status text NOT NULL CHECK (request_status IN ('open', 'approved', 'rejected', 'applied')),
  payload_json jsonb,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE indoor.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES indoor.organizations(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES indoor.venues(id) ON DELETE CASCADE,
  input_attachment_id uuid NOT NULL REFERENCES indoor.attachments(id) ON DELETE CASCADE,
  format_type text NOT NULL,
  job_status text NOT NULL CHECK (job_status IN ('pending', 'running', 'succeeded', 'failed')),
  result_summary_json jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE indoor.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES indoor.organizations(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES indoor.venues(id) ON DELETE CASCADE,
  format_type text NOT NULL,
  output_attachment_id uuid REFERENCES indoor.attachments(id) ON DELETE SET NULL,
  job_status text NOT NULL CHECK (job_status IN ('pending', 'running', 'succeeded', 'failed')),
  result_summary_json jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK from levels to attachments (attachments now exists)
ALTER TABLE indoor.levels
  ADD CONSTRAINT fk_levels_floorplan_attachment
  FOREIGN KEY (floorplan_attachment_id) REFERENCES indoor.attachments(id) ON DELETE SET NULL;

CREATE INDEX idx_attachments_organization_id ON indoor.attachments(organization_id);
CREATE INDEX idx_attachments_venue_id ON indoor.attachments(venue_id);
CREATE INDEX idx_attachments_building_id ON indoor.attachments(building_id);
CREATE INDEX idx_attachments_level_id ON indoor.attachments(level_id);

CREATE INDEX idx_amenities_level_id ON indoor.amenities(level_id);
CREATE INDEX idx_amenities_venue_id ON indoor.amenities(venue_id);

CREATE INDEX idx_occupants_level_id ON indoor.occupants(level_id);
CREATE INDEX idx_occupants_venue_id ON indoor.occupants(venue_id);
CREATE INDEX idx_occupants_related_space ON indoor.occupants(related_space_id);

CREATE INDEX idx_change_requests_organization_id ON indoor.change_requests(organization_id);

CREATE INDEX idx_import_jobs_organization_id ON indoor.import_jobs(organization_id);
CREATE INDEX idx_import_jobs_venue_id ON indoor.import_jobs(venue_id);

CREATE INDEX idx_export_jobs_organization_id ON indoor.export_jobs(organization_id);
CREATE INDEX idx_export_jobs_venue_id ON indoor.export_jobs(venue_id);
