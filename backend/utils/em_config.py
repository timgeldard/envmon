"""
EM-specific runtime configuration — plant scope, inspection types, table helpers.

All tables (Gold SAP data + the app-managed coordinate table) live in the same
Unity Catalog schema: TRACE_CATALOG.TRACE_SCHEMA (connected_plant_uat.gold by default).
"""
import os
from backend.utils.db import TRACE_CATALOG, TRACE_SCHEMA

# Plant scope — Seville plant code (P225)
PLANT_ID: str = os.environ.get("EM_PLANT_ID", "P225")

# SAP inspection types used for environmental monitoring (e.g. "14,Z14")
INSPECTION_TYPES_RAW = os.environ.get("EM_INSPECTION_TYPES", "14,Z14")
INSPECTION_TYPES: tuple[str, ...] = tuple(t.strip() for t in INSPECTION_TYPES_RAW.split(",") if t.strip())

# Canonical table names (catalog.schema.table)
LOT_TBL_NAME    = os.environ.get("EM_LOT_TABLE", f"{TRACE_CATALOG}.{TRACE_SCHEMA}.gold_inspection_lot")
POINT_TBL_NAME  = os.environ.get("EM_POINT_TABLE", f"{TRACE_CATALOG}.{TRACE_SCHEMA}.gold_inspection_point")
RESULT_TBL_NAME = os.environ.get("EM_RESULT_TABLE", f"{TRACE_CATALOG}.{TRACE_SCHEMA}.gold_batch_quality_result_v")
COORD_TBL_NAME  = os.environ.get("EM_COORD_TABLE", f"{TRACE_CATALOG}.{TRACE_SCHEMA}.em_location_coordinates")

# Fully-qualified, backtick-quoted references
def _quote(tbl: str) -> str:
    parts = tbl.replace("`", "").split(".")
    if len(parts) != 3:
        raise ValueError(
            f"Invalid table identifier '{tbl}'. Expected format: catalog.schema.table"
        )
    return ".".join(f"`{p}`" for p in parts)

LOT_TBL    = _quote(LOT_TBL_NAME)
POINT_TBL  = _quote(POINT_TBL_NAME)
RESULT_TBL = _quote(RESULT_TBL_NAME)
COORD_TBL  = _quote(COORD_TBL_NAME)

# SAP inspection types used for environmental monitoring (e.g. "14,Z14")
INSPECTION_TYPES_RAW = os.environ.get("EM_INSPECTION_TYPES", "14,Z14").strip()
_parsed_types = tuple(t.strip() for t in INSPECTION_TYPES_RAW.split(",") if t.strip())
INSPECTION_TYPES: tuple[str, ...] = _parsed_types if _parsed_types else ("14", "Z14")

# SQL IN clause for inspection types — e.g. "('14', 'Z14')"
INSP_TYPES_SQL = "(" + ", ".join(f"'{t}'" for t in INSPECTION_TYPES) + ")"

# MIC-specific decay lambdas (lower lambda = longer half-life)
# Override via EM_MIC_DECAY_<NORMALIZED_NAME> environment variables.
def _get_mic_decay(name: str, default: float = 0.1) -> float:
    env_key = f"EM_MIC_DECAY_{name.upper().replace(' ', '_')}"
    return float(os.environ.get(env_key, str(default)))

# Common defaults for critical organisms
MIC_DECAY_RATES = {
    "LISTERIA":   _get_mic_decay("LISTERIA", 0.05),   # ~14 day half-life
    "SALMONELLA": _get_mic_decay("SALMONELLA", 0.05),
    "ATP":        _get_mic_decay("ATP", 0.3),        # ~2.3 day half-life
    "APC":        _get_mic_decay("APC", 0.2),        # ~3.5 day half-life
}
