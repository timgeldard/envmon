-- Migration 000: create em_location_coordinates
--
-- App-managed Silver table that stores the spatial coordinate mapping between
-- SAP functional locations (TPLNR) and their X/Y positions on the Kerry Seville
-- floor plan images.
--
-- Written by the Admin coordinate-authoring tool (POST /api/em/coordinates).
-- Read by the heatmap, floor, and location endpoints.
--
-- X/Y positions are stored as relative percentages (0.0–100.0) so that markers
-- remain anchored at the correct position regardless of browser viewport size.
--
-- Safe to run repeatedly — CREATE TABLE IF NOT EXISTS is idempotent.

CREATE TABLE IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_coordinates` (
    func_loc_id  STRING     NOT NULL  COMMENT 'SAP functional location code (TPLNR) e.g. Q225-0101-SEV3-Z0-72',
    floor_id     STRING     NOT NULL  COMMENT 'Application floor identifier: F1 | F2 | F3',
    x_pos        DOUBLE     NOT NULL  COMMENT 'Relative X position on the floor plan image (0.0–100.0 %)',
    y_pos        DOUBLE     NOT NULL  COMMENT 'Relative Y position on the floor plan image (0.0–100.0 %)',
    updated_by   STRING     NOT NULL  COMMENT 'Databricks identity who last saved these coordinates (CURRENT_USER())',
    updated_at   TIMESTAMP  NOT NULL  COMMENT 'Timestamp of last coordinate update (CURRENT_TIMESTAMP())'
)
USING DELTA
COMMENT 'EM App: SAP functional location → floor plan X/Y coordinate mapping for Kerry Seville'
TBLPROPERTIES (
    'delta.enableChangeDataFeed'           = 'false',
    'delta.autoOptimize.optimizeWrite'     = 'true',
    'delta.autoOptimize.autoCompact'       = 'true'
);
