-- Routing graph: routing_nodes, routing_edges

CREATE TABLE indoor.routing_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES indoor.venues(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES indoor.buildings(id) ON DELETE CASCADE,
  level_id uuid REFERENCES indoor.levels(id) ON DELETE CASCADE,
  node_type text NOT NULL,
  ref_entity_type text,
  ref_entity_id uuid,
  geom geometry(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_routing_node_geom_valid CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))
);

CREATE TABLE indoor.routing_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES indoor.venues(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES indoor.buildings(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES indoor.routing_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES indoor.routing_nodes(id) ON DELETE CASCADE,
  edge_type text NOT NULL,
  cost numeric NOT NULL,
  reverse_cost numeric,
  accessible boolean NOT NULL DEFAULT true,
  constraints_json jsonb,
  geom geometry(LineString, 4326),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_routing_edge_nodes_different CHECK (from_node_id != to_node_id)
);

CREATE INDEX idx_routing_nodes_venue_id ON indoor.routing_nodes(venue_id);
CREATE INDEX idx_routing_nodes_building_id ON indoor.routing_nodes(building_id);
CREATE INDEX idx_routing_nodes_level_id ON indoor.routing_nodes(level_id);

CREATE INDEX idx_routing_edges_venue_id ON indoor.routing_edges(venue_id);
CREATE INDEX idx_routing_edges_building_id ON indoor.routing_edges(building_id);
CREATE INDEX idx_routing_edges_from_node ON indoor.routing_edges(from_node_id);
CREATE INDEX idx_routing_edges_to_node ON indoor.routing_edges(to_node_id);
