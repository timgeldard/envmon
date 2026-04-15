"""
EM-specific runtime configuration — plant scope, inspection types, table helpers.

All tables (Gold SAP data + the app-managed coordinate table) live in the same
Unity Catalog schema: TRACE_CATALOG.TRACE_SCHEMA (connected_plant_uat.gold by default).
"""
import os
from backend.utils.db import TRACE_CATALOG, TRACE_SCHEMA

# Plant scope — Seville plant code
PLANT_ID: str = os.environ.get("EM_PLANT_ID", "P225")

# SAP inspection types used for environmental monitoring
INSPECTION_TYPES: tuple[str, ...] = ("14", "Z14")

# Canonical table references (fully-qualified, backtick-quoted)
LOT_TBL    = f"`{TRACE_CATALOG}`.`{TRACE_SCHEMA}`.`gold_inspection_lot`"
POINT_TBL  = f"`{TRACE_CATALOG}`.`{TRACE_SCHEMA}`.`gold_inspection_point`"
RESULT_TBL = f"`{TRACE_CATALOG}`.`{TRACE_SCHEMA}`.`gold_batch_quality_result_v`"
COORD_TBL  = f"`{TRACE_CATALOG}`.`{TRACE_SCHEMA}`.`em_location_coordinates`"

# SQL IN clause for inspection types — e.g. "('14', 'Z14')"
INSP_TYPES_SQL = "(" + ", ".join(f"'{t}'" for t in INSPECTION_TYPES) + ")"
