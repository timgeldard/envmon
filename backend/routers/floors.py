"""
GET /api/em/floors    — list floors with mapped location counts
GET /api/em/locations — all functional locations for a floor (mapped + unmapped)
"""

import json
import logging
import os
from functools import lru_cache
from typing import Optional

from fastapi import APIRouter, Header

from backend.schemas.em import FloorInfo, LocationMeta
from backend.utils.db import resolve_token, run_sql_async, sql_param
from backend.utils.em_config import (
    COORD_TBL,
    INSP_TYPES_SQL,
    LOT_TBL,
    PLANT_ID,
    POINT_TBL,
)

router = APIRouter()

# Default floors for Seville (P225) if no config provided
_DEFAULT_FLOORS = [
    {"floor_id": "F1", "floor_name": "Floor 1", "svg_url": "/assets/floor1.svg", "svg_width": 1021.6, "svg_height": 722.48},
    {"floor_id": "F2", "floor_name": "Floor 2", "svg_url": "/assets/floor2.svg", "svg_width": 1021.6, "svg_height": 722.48},
    {"floor_id": "F3", "floor_name": "Floor 3", "svg_url": "/assets/floor3.svg", "svg_width": 1021.6, "svg_height": 722.48},
]

@lru_cache(maxsize=1)
def _get_floors_config() -> list[dict]:
    raw = os.environ.get("EM_FLOOR_CONFIG")
    if not raw:
        return _DEFAULT_FLOORS

    try:
        config = json.loads(raw)
        if not isinstance(config, list):
            raise ValueError("Floor config must be a list of dicts.")

        # Basic validation of required keys
        for idx, f in enumerate(config):
            if "floor_id" not in f or "floor_name" not in f:
                raise ValueError(f"Floor at index {idx} missing floor_id or floor_name.")

        return config
    except (json.JSONDecodeError, ValueError) as exc:
        logging.warning(f"Failed to parse EM_FLOOR_CONFIG, falling back to defaults. Error: {exc}")
        return _DEFAULT_FLOORS


@router.get("/floors", response_model=list[FloorInfo])
async def list_floors(
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)

    sql = f"""
        SELECT
            floor_id,
            COUNT(DISTINCT func_loc_id) AS location_count
        FROM {COORD_TBL}
        GROUP BY floor_id
    """
    try:
        rows = await run_sql_async(token, sql)
        count_map = {r["floor_id"]: int(r["location_count"] or 0) for r in rows}
    except Exception:
        logging.getLogger(__name__).warning("floors: location count query failed, returning defaults")
        count_map = {}

    floors_config = _get_floors_config()
    return [
        FloorInfo(
            floor_id=f["floor_id"],
            floor_name=f["floor_name"],
            location_count=count_map.get(f["floor_id"], 0),
            svg_url=f.get("svg_url"),
            svg_width=f.get("svg_width"),
            svg_height=f.get("svg_height"),
        )
        for f in floors_config
    ]


@router.get("/locations", response_model=list[LocationMeta])
async def list_locations(
    floor_id: Optional[str] = None,
    mapped_only: bool = False,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Returns all functional locations known from inspection point data,
    annotated with their X/Y coordinates where mapped.

    - Mapped locations come from em_location_coordinates joined to gold_inspection_point.
    - Unmapped locations are functional locations that appear in inspection data
      for P225 type-14 lots but have no coordinate entry yet.
    """
    token = resolve_token(x_forwarded_access_token, authorization)

    params = [sql_param("plant_id", PLANT_ID)]
    floor_filter = ""
    if floor_id:
        params.append(sql_param("floor_id", floor_id))
        floor_filter = "AND c.floor_id = :floor_id"

    mapped_filter = "WHERE c.func_loc_id IS NOT NULL" if mapped_only else ""

    sql = f"""
        WITH known_locs AS (
            SELECT DISTINCT ip.FUNCTIONAL_LOCATION AS func_loc_id
            FROM {LOT_TBL} lot
            JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
            WHERE lot.PLANT_ID = :plant_id
              AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
              AND ip.FUNCTIONAL_LOCATION IS NOT NULL
        )
        SELECT
            kl.func_loc_id,
            c.floor_id,
            c.x_pos,
            c.y_pos,
            CASE WHEN c.func_loc_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_mapped
        FROM known_locs kl
        LEFT JOIN {COORD_TBL} c
            ON kl.func_loc_id = c.func_loc_id
           {floor_filter}
        {mapped_filter}
        ORDER BY kl.func_loc_id
    """
    rows = await run_sql_async(token, sql, params)

    return [
        LocationMeta(
            func_loc_id=r["func_loc_id"],
            func_loc_name=None,  # functional location code is self-descriptive
            plant_id=PLANT_ID,
            floor_id=r.get("floor_id"),
            x_pos=float(r["x_pos"]) if r.get("x_pos") is not None else None,
            y_pos=float(r["y_pos"]) if r.get("y_pos") is not None else None,
            is_mapped=bool(r.get("is_mapped", False)),
        )
        for r in rows
    ]
