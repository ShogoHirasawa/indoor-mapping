-- Seed data for indoor mapping verification
-- Run after migrations. To access data, add yourself to the organization:
--   INSERT INTO indoor.organization_memberships (organization_id, user_id, role)
--   SELECT id, auth.uid(), 'owner' FROM indoor.organizations WHERE name = 'Sample Organization' LIMIT 1;

-- 1. Organization
INSERT INTO indoor.organizations (id, name)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Sample Organization')
ON CONFLICT (id) DO NOTHING;

-- 2. Venue
INSERT INTO indoor.venues (id, organization_id, name, category, address, status)
VALUES (
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Sample Mall',
  'mall',
  'Tokyo, Japan',
  'published'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Building
INSERT INTO indoor.buildings (id, venue_id, name, status, footprint_geom)
VALUES (
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Main Building',
  'published',
  ST_SetSRID(ST_GeomFromText('MULTIPOLYGON(((139.75 35.68, 139.751 35.68, 139.751 35.681, 139.75 35.681, 139.75 35.68)))'), 4326)
)
ON CONFLICT (id) DO NOTHING;

-- 4. Levels (2 floors)
INSERT INTO indoor.levels (id, building_id, name, ordinal, short_name, status)
VALUES
  ('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '1F', 1, '1F', 'published'),
  ('d4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2F', 2, '2F', 'published')
ON CONFLICT (id) DO NOTHING;

-- 5. Spaces (1F: corridor + 2 rooms)
INSERT INTO indoor.spaces (id, level_id, building_id, venue_id, name, space_type, geom, status)
VALUES
  (
    'e5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Main Corridor',
    'corridor',
    ST_SetSRID(ST_GeomFromText('POLYGON((139.7501 35.6801, 139.7509 35.6801, 139.7509 35.6805, 139.7501 35.6805, 139.7501 35.6801))'), 4326),
    'published'
  ),
  (
    'e6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Room A',
    'room',
    ST_SetSRID(ST_GeomFromText('POLYGON((139.7501 35.6801, 139.7505 35.6801, 139.7505 35.6803, 139.7501 35.6803, 139.7501 35.6801))'), 4326),
    'published'
  ),
  (
    'e7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Room B',
    'room',
    ST_SetSRID(ST_GeomFromText('POLYGON((139.7505 35.6801, 139.7509 35.6801, 139.7509 35.6803, 139.7505 35.6803, 139.7505 35.6801))'), 4326),
    'published'
  )
ON CONFLICT (id) DO NOTHING;

-- 6. Openings (doors)
INSERT INTO indoor.openings (id, level_id, building_id, venue_id, name, opening_type, geom, connected_space_id, status)
VALUES
  (
    'f8eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Door to Room A',
    'door',
    ST_SetSRID(ST_MakePoint(139.7503, 35.6802), 4326),
    'e6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'published'
  )
ON CONFLICT (id) DO NOTHING;

-- 7. Vertical connector (stairs between 1F and 2F)
INSERT INTO indoor.vertical_connectors (id, building_id, venue_id, connector_group_id, level_id, connector_type, directionality, geom, status)
VALUES
  (
    '09eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a9eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'stairs',
    'bidirectional',
    ST_SetSRID(ST_MakePoint(139.7507, 35.6804), 4326),
    'published'
  ),
  (
    '0feebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a9eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'stairs',
    'bidirectional',
    ST_SetSRID(ST_MakePoint(139.7507, 35.6804), 4326),
    'published'
  )
ON CONFLICT (id) DO NOTHING;

-- 8. Routing nodes
INSERT INTO indoor.routing_nodes (id, venue_id, building_id, level_id, node_type, geom)
VALUES
  ('11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'corridor_point', ST_SetSRID(ST_MakePoint(139.7503, 35.6803), 4326)),
  ('12eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'opening', ST_SetSRID(ST_MakePoint(139.7503, 35.6802), 4326)),
  ('13eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'connector', ST_SetSRID(ST_MakePoint(139.7507, 35.6804), 4326))
ON CONFLICT (id) DO NOTHING;

-- 9. Routing edges
INSERT INTO indoor.routing_edges (id, venue_id, building_id, from_node_id, to_node_id, edge_type, cost, reverse_cost, accessible, geom)
VALUES
  (
    '14eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '12eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'walk',
    10,
    10,
    true,
    ST_SetSRID(ST_MakeLine(ST_MakePoint(139.7503, 35.6803), ST_MakePoint(139.7503, 35.6802)), 4326)
  ),
  (
    '15eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '13eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'walk',
    15,
    15,
    true,
    ST_SetSRID(ST_MakeLine(ST_MakePoint(139.7503, 35.6803), ST_MakePoint(139.7507, 35.6804)), 4326)
  )
ON CONFLICT (id) DO NOTHING;

-- 10. Amenity (restroom)
INSERT INTO indoor.amenities (id, level_id, building_id, venue_id, amenity_type, name, geom, status)
VALUES
  (
    '16eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'restroom',
    '1F Restroom',
    ST_SetSRID(ST_MakePoint(139.7508, 35.6802), 4326),
    'published'
  )
ON CONFLICT (id) DO NOTHING;

-- 11. Occupant (sample tenant)
INSERT INTO indoor.occupants (id, level_id, building_id, venue_id, name, category, related_space_id, status)
VALUES
  (
    '17eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Sample Shop',
    'retail',
    'e6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'published'
  )
ON CONFLICT (id) DO NOTHING;
