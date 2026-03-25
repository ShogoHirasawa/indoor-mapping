-- Enable RLS on all indoor tables
-- Policy: users can only access data for organizations they belong to

ALTER TABLE indoor.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.vertical_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.routing_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.routing_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.occupants ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor.export_jobs ENABLE ROW LEVEL SECURITY;

-- Helper function: get organization IDs the current user belongs to
CREATE OR REPLACE FUNCTION indoor.user_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id
  FROM indoor.organization_memberships
  WHERE user_id = auth.uid();
$$;

-- organizations: members can read/update their org; authenticated users can create
CREATE POLICY org_select ON indoor.organizations
  FOR SELECT USING (id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY org_insert ON indoor.organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY org_update ON indoor.organizations
  FOR UPDATE USING (id IN (SELECT indoor.user_organization_ids()));

-- organization_memberships: members can manage memberships of their orgs
CREATE POLICY om_select ON indoor.organization_memberships
  FOR SELECT USING (organization_id IN (SELECT indoor.user_organization_ids()));

-- Allow: (a) adding self as first member of new org, or (b) existing member adding others
CREATE POLICY om_insert ON indoor.organization_memberships
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      organization_id IN (SELECT indoor.user_organization_ids())
      OR NOT EXISTS (
        SELECT 1 FROM indoor.organization_memberships om2
        WHERE om2.organization_id = organization_id
      )
    )
  );

CREATE POLICY om_update ON indoor.organization_memberships
  FOR UPDATE USING (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY om_delete ON indoor.organization_memberships
  FOR DELETE USING (organization_id IN (SELECT indoor.user_organization_ids()));

-- source_records: no direct org link; restrict to authenticated users
CREATE POLICY sr_select ON indoor.source_records FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY sr_insert ON indoor.source_records FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY sr_update ON indoor.source_records FOR UPDATE USING (auth.uid() IS NOT NULL);

-- venues: org-scoped
CREATE POLICY venues_select ON indoor.venues
  FOR SELECT USING (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY venues_insert ON indoor.venues
  FOR INSERT WITH CHECK (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY venues_update ON indoor.venues
  FOR UPDATE USING (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY venues_delete ON indoor.venues
  FOR DELETE USING (organization_id IN (SELECT indoor.user_organization_ids()));

-- buildings: via venue -> organization
CREATE POLICY buildings_select ON indoor.buildings
  FOR SELECT USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY buildings_insert ON indoor.buildings
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY buildings_update ON indoor.buildings
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY buildings_delete ON indoor.buildings
  FOR DELETE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

-- levels: via building -> venue -> organization
CREATE POLICY levels_select ON indoor.levels
  FOR SELECT USING (
    building_id IN (
      SELECT b.id FROM indoor.buildings b
      JOIN indoor.venues v ON v.id = b.venue_id
      WHERE v.organization_id IN (SELECT indoor.user_organization_ids())
    )
  );

CREATE POLICY levels_insert ON indoor.levels
  FOR INSERT WITH CHECK (
    building_id IN (
      SELECT b.id FROM indoor.buildings b
      JOIN indoor.venues v ON v.id = b.venue_id
      WHERE v.organization_id IN (SELECT indoor.user_organization_ids())
    )
  );

CREATE POLICY levels_update ON indoor.levels
  FOR UPDATE USING (
    building_id IN (
      SELECT b.id FROM indoor.buildings b
      JOIN indoor.venues v ON v.id = b.venue_id
      WHERE v.organization_id IN (SELECT indoor.user_organization_ids())
    )
  );

CREATE POLICY levels_delete ON indoor.levels
  FOR DELETE USING (
    building_id IN (
      SELECT b.id FROM indoor.buildings b
      JOIN indoor.venues v ON v.id = b.venue_id
      WHERE v.organization_id IN (SELECT indoor.user_organization_ids())
    )
  );

-- spaces: via venue
CREATE POLICY spaces_select ON indoor.spaces
  FOR SELECT USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY spaces_insert ON indoor.spaces
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY spaces_update ON indoor.spaces
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY spaces_delete ON indoor.spaces
  FOR DELETE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

-- openings: via venue
CREATE POLICY openings_select ON indoor.openings
  FOR SELECT USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY openings_insert ON indoor.openings
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY openings_update ON indoor.openings
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY openings_delete ON indoor.openings
  FOR DELETE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

-- vertical_connectors: via venue
CREATE POLICY vc_select ON indoor.vertical_connectors
  FOR SELECT USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY vc_insert ON indoor.vertical_connectors
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY vc_update ON indoor.vertical_connectors
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY vc_delete ON indoor.vertical_connectors
  FOR DELETE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

-- routing_nodes: via venue
CREATE POLICY rn_select ON indoor.routing_nodes
  FOR SELECT USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY rn_insert ON indoor.routing_nodes
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY rn_update ON indoor.routing_nodes
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY rn_delete ON indoor.routing_nodes
  FOR DELETE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

-- routing_edges: via venue
CREATE POLICY re_select ON indoor.routing_edges
  FOR SELECT USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY re_insert ON indoor.routing_edges
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY re_update ON indoor.routing_edges
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY re_delete ON indoor.routing_edges
  FOR DELETE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

-- amenities: via venue
CREATE POLICY amenities_select ON indoor.amenities
  FOR SELECT USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY amenities_insert ON indoor.amenities
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY amenities_update ON indoor.amenities
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY amenities_delete ON indoor.amenities
  FOR DELETE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

-- occupants: via venue
CREATE POLICY occupants_select ON indoor.occupants
  FOR SELECT USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY occupants_insert ON indoor.occupants
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY occupants_update ON indoor.occupants
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

CREATE POLICY occupants_delete ON indoor.occupants
  FOR DELETE USING (
    venue_id IN (SELECT id FROM indoor.venues WHERE organization_id IN (SELECT indoor.user_organization_ids()))
  );

-- attachments: org-scoped
CREATE POLICY att_select ON indoor.attachments
  FOR SELECT USING (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY att_insert ON indoor.attachments
  FOR INSERT WITH CHECK (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY att_update ON indoor.attachments
  FOR UPDATE USING (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY att_delete ON indoor.attachments
  FOR DELETE USING (organization_id IN (SELECT indoor.user_organization_ids()));

-- change_requests: org-scoped
CREATE POLICY cr_select ON indoor.change_requests
  FOR SELECT USING (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY cr_insert ON indoor.change_requests
  FOR INSERT WITH CHECK (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY cr_update ON indoor.change_requests
  FOR UPDATE USING (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY cr_delete ON indoor.change_requests
  FOR DELETE USING (organization_id IN (SELECT indoor.user_organization_ids()));

-- import_jobs: org-scoped
CREATE POLICY ij_select ON indoor.import_jobs
  FOR SELECT USING (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY ij_insert ON indoor.import_jobs
  FOR INSERT WITH CHECK (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY ij_update ON indoor.import_jobs
  FOR UPDATE USING (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY ij_delete ON indoor.import_jobs
  FOR DELETE USING (organization_id IN (SELECT indoor.user_organization_ids()));

-- export_jobs: org-scoped
CREATE POLICY ej_select ON indoor.export_jobs
  FOR SELECT USING (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY ej_insert ON indoor.export_jobs
  FOR INSERT WITH CHECK (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY ej_update ON indoor.export_jobs
  FOR UPDATE USING (organization_id IN (SELECT indoor.user_organization_ids()));

CREATE POLICY ej_delete ON indoor.export_jobs
  FOR DELETE USING (organization_id IN (SELECT indoor.user_organization_ids()));
