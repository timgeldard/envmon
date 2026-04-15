"""
GET /api/em/floors        — list all floors with location counts
GET /api/em/locations     — all locations with optional floor filter and mapped/unmapped status
"""

from typing import Optional

from fastapi import APIRouter, Header

from backend.schemas.em import FloorInfo, LocationMeta
from backend.utils.db import resolve_token, run_sql_async, sql_param, tbl

router = APIRouter()

_FLOORS = [
    {"floor_id": "F1", "floor_name": "Floor 1"},
    {"floor_id": "F2", "floor_name": "Floor 2"},
    {"floor_id": "F3", "floor_name": "Floor 3"},
]


@router.get("/floors", response_model=list[FloorInfo])
async def list_floors(
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)

    # Count mapped locations per floor
    sql = f"""
        SELECT
            c.floor_id,
            COUNT(DISTINCT c.func_loc_id) AS location_count
        FROM {tbl('em_location_coordinates')} c
        GROUP BY c.floor_id
    """
    rows = await run_sql_async(token, sql)
    count_map = {r["floor_id"]: int(r["location_count"] or 0) for r in rows}

    return [
        FloorInfo(
            floor_id=f["floor_id"],
            floor_name=f["floor_name"],
            location_count=count_map.get(f["floor_id"], 0),
        )
        for f in _FLOORS
    ]


@router.get("/locations", response_model=list[LocationMeta])
async def list_locations(
    floor_id: Optional[str] = None,
    mapped_only: bool = False,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)

    params = []
    floor_filter = ""
    if floor_id:
        params.append(sql_param("floor_id", floor_id))
        floor_filter = "AND c.floor_id = :floor_id"

    mapped_filter = "AND c.func_loc_id IS NOT NULL" if mapped_only else ""

    sql = f"""
        SELECT
            d.func_loc_id,
            d.func_loc_name,
            d.plant_id,
            c.floor_id,
            c.x_pos,
            c.y_pos,
            CASE WHEN c.func_loc_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_mapped
        FROM {tbl('em_site_material_dim_mv')} d
        LEFT JOIN {tbl('em_location_coordinates')} c
            ON d.func_loc_id = c.func_loc_id
        WHERE 1=1
          {floor_filter}
          {mapped_filter}
        ORDER BY d.func_loc_id
    """
    rows = await run_sql_async(token, sql, params or None)

    return [
        LocationMeta(
            func_loc_id=r["func_loc_id"],
            func_loc_name=r.get("func_loc_name"),
            plant_id=r.get("plant_id", ""),
            floor_id=r.get("floor_id"),
            x_pos=float(r["x_pos"]) if r.get("x_pos") is not None else None,
            y_pos=float(r["y_pos"]) if r.get("y_pos") is not None else None,
            is_mapped=bool(r.get("is_mapped", False)),
        )
        for r in rows
    ]
