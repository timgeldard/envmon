"""
EM-specific runtime configuration — plant scope, inspection types, table helpers.
"""
import os
from backend.utils.db import TRACE_CATALOG

# Plant scope
PLANT_ID: str = os.environ.get("EM_PLANT_ID", "P225")

# SAP inspection types used for environmental monitoring
INSPECTION_TYPES: tuple[str, ...] = ("14", "Z14")

# Coordinate table lives in a separate schema (Silver by default, configurable)
_COORD_CATALOG: str = TRACE_CATALOG
_COORD_SCHEMA: str = os.environ.get("EM_COORD_SCHEMA", "gold")


def coord_tbl(name: str) -> str:
    """Fully-qualified backtick-quoted reference for the EM coordinate table."""
    return f"`{_COORD_CATALOG}`.`{_COORD_SCHEMA}`.`{name}`"


# Canonical Gold table names
LOT_TBL = f"`{TRACE_CATALOG}`.`gold`.`gold_inspection_lot`"
POINT_TBL = f"`{TRACE_CATALOG}`.`gold`.`gold_inspection_point`"
RESULT_TBL = f"`{TRACE_CATALOG}`.`gold`.`gold_batch_quality_result_v`"
COORD_TBL = coord_tbl("em_location_coordinates")

# Inspection type SQL fragment  — e.g. "IN ('14', 'Z14')"
INSP_TYPES_SQL = "(" + ", ".join(f"'{t}'" for t in INSPECTION_TYPES) + ")"
