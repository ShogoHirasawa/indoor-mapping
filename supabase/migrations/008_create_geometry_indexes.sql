-- GiST indexes on all geometry columns for spatial queries

CREATE INDEX idx_buildings_footprint_geom ON indoor.buildings USING GIST (footprint_geom);
CREATE INDEX idx_spaces_geom ON indoor.spaces USING GIST (geom);
CREATE INDEX idx_openings_geom ON indoor.openings USING GIST (geom);
CREATE INDEX idx_vertical_connectors_geom ON indoor.vertical_connectors USING GIST (geom);
CREATE INDEX idx_routing_nodes_geom ON indoor.routing_nodes USING GIST (geom);
CREATE INDEX idx_routing_edges_geom ON indoor.routing_edges USING GIST (geom);
CREATE INDEX idx_amenities_geom ON indoor.amenities USING GIST (geom);
