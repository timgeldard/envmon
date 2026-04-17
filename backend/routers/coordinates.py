"""
GET    /api/em/coordinates/unmapped      — functional locations with no X/Y entry
GET    /api/em/coordinates/mapped        — functional locations that have coordinates
POST   /api/em/coordinates              — upsert a coordinate mapping (admin)
DELETE /api/em/coordinates/{func_loc_id} — remove a coordinate mapping (admin)

Unmapped locations are derived by finding all DISTINCT FUNCTIONAL_LOCATION values
from the inspection point data (type-14 lots, P225) that have no corresponding
row in em_location_coordinates.
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from backend.schemas.em import CoordinateUpsertRequest, CoordinateUpsertResponse, LocationMeta, LocationSummary
from backend.utils.db import resolve_token, run_sql_async, sql_param
from backend.utils.em_config import (
    COORD_TBL,
    INSP_TYPES_SQL,
    LOT_TBL,
    PLANT_ID,
    POINT_TBL,
    RESULT_TBL,
)

router = APIRouter()


@router.get("/coordinates/unmapped", response_model=list[LocationMeta])
async def list_unmapped(
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Return functional locations that appear in type-14 inspection data for P225
    but have no entry in em_location_coordinates.

    These are candidates for the admin spatial authoring tool.
    """
    token = resolve_token(x_forwarded_access_token, authorization)

    params = [sql_param("plant_id", PLANT_ID)]

    sql = f"""
        WITH active_locs AS (
            SELECT DISTINCT ip.FUNCTIONAL_LOCATION AS func_loc_id
            FROM {LOT_TBL} lot
            JOIN {POINT_TBL} ip
                ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
            WHERE lot.PLANT_ID          = :plant_id
              AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
              AND ip.FUNCTIONAL_LOCATION IS NOT NULL
        )
        SELECT al.func_loc_id
        FROM active_locs al
        LEFT JOIN {COORD_TBL} c
            ON al.func_loc_id = c.func_loc_id
        WHERE c.func_loc_id IS NULL
        ORDER BY al.func_loc_id
    """
    rows = await run_sql_async(token, sql, params)

    return [
        LocationMeta(
            func_loc_id=r["func_loc_id"],
            func_loc_name=None,
            plant_id=PLANT_ID,
            floor_id=None,
            x_pos=None,
            y_pos=None,
            is_mapped=False,
        )
        for r in rows
    ]


@router.get("/coordinates/mapped", response_model=list[LocationMeta])
async def list_mapped(
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Return all functional locations that have an entry in em_location_coordinates.
    Used by the admin mapper to display and reposition existing markers.
    """
    token = resolve_token(x_forwarded_access_token, authorization)

    sql = f"""
        SELECT
            func_loc_id,
            floor_id,
            x_pos,
            y_pos
        FROM {COORD_TBL}
        ORDER BY floor_id, func_loc_id
    """
    rows = await run_sql_async(token, sql)

    return [
        LocationMeta(
            func_loc_id=r["func_loc_id"],
            func_loc_name=None,
            plant_id=PLANT_ID,
            floor_id=r["floor_id"],
            x_pos=float(r["x_pos"]),
            y_pos=float(r["y_pos"]),
            is_mapped=True,
        )
        for r in rows
    ]


@router.get("/locations/hierarchy")
async def get_hierarchy(
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Return a structured hierarchy of unmapped functional locations.
    Enables cascading filters (L1 -> L2 -> L3 -> L4) in the admin UI.
    """
    token = resolve_token(x_forwarded_access_token, authorization)

    params = [sql_param("plant_id", PLANT_ID)]
    sql = f"""
        WITH active_locs AS (
            SELECT DISTINCT ip.FUNCTIONAL_LOCATION AS func_loc_id
            FROM {LOT_TBL} lot
            JOIN {POINT_TBL} ip
                ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
            WHERE lot.PLANT_ID          = :plant_id
              AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
              AND ip.FUNCTIONAL_LOCATION IS NOT NULL
        )
        SELECT al.func_loc_id
        FROM active_locs al
        LEFT JOIN {COORD_TBL} c
            ON al.func_loc_id = c.func_loc_id
        WHERE c.func_loc_id IS NULL
        ORDER BY al.func_loc_id
    """
    rows = await run_sql_async(token, sql, params)

    hierarchy = {}
    for r in rows:
        flid = r["func_loc_id"]
        parts = flid.split("-")
        if len(parts) < 5:
            # Skip functional locations that don't follow the 5-level format (L1-L2-L3-L4-L5)
            continue

        l1, l2, l3, l4 = parts[0], parts[1], parts[2], parts[3]

        l1_dict = hierarchy.setdefault(l1, {})
        l2_dict = l1_dict.setdefault(l2, {})
        l3_dict = l2_dict.setdefault(l3, {})
        l4_list = l3_dict.setdefault(l4, [])
        l4_list.append(flid)

    return hierarchy


@router.get("/locations/{func_loc_id}/summary", response_model=LocationSummary)
async def get_location_summary(
    func_loc_id: str,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Returns an aggregated summary for a functional location including
    metadata, available MICs, and recent inspection lots.
    """
    token = resolve_token(x_forwarded_access_token, authorization)

    # 1. Fetch metadata
    meta_params = [sql_param("func_loc_id", func_loc_id)]
    meta_sql = f"""
        SELECT func_loc_id, floor_id, x_pos, y_pos
        FROM {COORD_TBL}
        WHERE func_loc_id = :func_loc_id
    """
    meta_rows = await run_sql_async(token, meta_sql, meta_params)
    meta = None
    if meta_rows:
        r = meta_rows[0]
        meta = LocationMeta(
            func_loc_id=r["func_loc_id"],
            plant_id=PLANT_ID,
            floor_id=r["floor_id"],
            x_pos=float(r["x_pos"]),
            y_pos=float(r["y_pos"]),
            is_mapped=True,
        )
    else:
        meta = LocationMeta(
            func_loc_id=func_loc_id,
            plant_id=PLANT_ID,
            is_mapped=False,
        )

    # 2. Fetch MICs (last 180 days to avoid unbounded scans)
    date_from = (date.today() - timedelta(days=180)).isoformat()
    mic_params = [
        sql_param("func_loc_id", func_loc_id),
        sql_param("plant_id", PLANT_ID),
        sql_param("date_from", date_from),
    ]
    mic_sql = f"""
        SELECT DISTINCT UPPER(TRIM(r.MIC_NAME)) AS mic_name
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        JOIN {RESULT_TBL} r ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
        WHERE lot.PLANT_ID = :plant_id
          AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION = :func_loc_id
          AND lot.CREATED_DATE >= :date_from
    """
    mic_rows = await run_sql_async(token, mic_sql, mic_params)
    mics = [r["mic_name"] for r in mic_rows if r.get("mic_name")]

    # 3. Fetch recent lots (last 5)
    from backend.routers.lots import _lot_status
    lot_sql = f"""
        SELECT
            lot.INSPECTION_LOT_ID                       AS lot_id,
            ip.FUNCTIONAL_LOCATION                      AS func_loc_id,
            lot.CREATED_DATE                            AS inspection_start_date,
            lot.INSPECTION_END_DATE                     AS inspection_end_date,
            MAX(CASE r.INSPECTION_RESULT_VALUATION WHEN 'R' THEN 'R' WHEN 'W' THEN 'W' WHEN 'A' THEN 'A' ELSE NULL END) AS valuation
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        LEFT JOIN {RESULT_TBL} r ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
        WHERE lot.PLANT_ID = :plant_id
          AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION = :func_loc_id
          AND lot.CREATED_DATE >= :date_from
        GROUP BY 1, 2, 3, 4 ORDER BY 3 DESC LIMIT 5
    """
    lot_rows = await run_sql_async(token, lot_sql, mic_params)
    recent_lots = [
        {
            "lot_id": r["lot_id"],
            "func_loc_id": r["func_loc_id"],
            "inspection_start_date": str(r["inspection_start_date"])[:10] if r.get("inspection_start_date") else None,
            "inspection_end_date": str(r["inspection_end_date"])[:10] if r.get("inspection_end_date") else None,
            "valuation": r["valuation"],
            "status": _lot_status(r["valuation"], r.get("inspection_end_date")),
        }
        for r in lot_rows
    ]

    return LocationSummary(meta=meta, mics=mics, recent_lots=recent_lots)


@router.delete("/coordinates/{func_loc_id}", status_code=204)
async def delete_coordinate(
    func_loc_id: str,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Remove the coordinate mapping for a functional location.
    The location will reappear in the unmapped list after deletion.
    """
    token = resolve_token(x_forwarded_access_token, authorization)

    params = [sql_param("func_loc_id", func_loc_id)]

    sql = f"""
        DELETE FROM {COORD_TBL}
        WHERE func_loc_id = :func_loc_id
    """
    await run_sql_async(token, sql, params)


@router.post("/coordinates", response_model=CoordinateUpsertResponse)
async def upsert_coordinate(
    body: CoordinateUpsertRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Insert or update the X/Y floor-plan coordinates for a functional location.

    Coordinates are stored as relative % values (0–100) so they remain
    responsive across different browser viewport sizes.

    Uses a MERGE statement so repeated saves are idempotent.
    """
    token = resolve_token(x_forwarded_access_token, authorization)

    params = [
        sql_param("func_loc_id", body.func_loc_id),
        sql_param("floor_id", body.floor_id),
        sql_param("x_pos", body.x_pos),
        sql_param("y_pos", body.y_pos),
    ]

    sql = f"""
        MERGE INTO {COORD_TBL} AS target
        USING (
            SELECT
                :func_loc_id            AS func_loc_id,
                :floor_id               AS floor_id,
                CAST(:x_pos AS DOUBLE)  AS x_pos,
                CAST(:y_pos AS DOUBLE)  AS y_pos
        ) AS source
        ON target.func_loc_id = source.func_loc_id
        WHEN MATCHED THEN UPDATE SET
            target.floor_id   = source.floor_id,
            target.x_pos      = source.x_pos,
            target.y_pos      = source.y_pos,
            target.updated_by = CURRENT_USER(),
            target.updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (
            func_loc_id, floor_id, x_pos, y_pos, updated_by, updated_at
        ) VALUES (
            source.func_loc_id,
            source.floor_id,
            source.x_pos,
            source.y_pos,
            CURRENT_USER(),
            CURRENT_TIMESTAMP()
        )
    """
    await run_sql_async(token, sql, params)

    return CoordinateUpsertResponse(
        func_loc_id=body.func_loc_id,
        floor_id=body.floor_id,
        x_pos=body.x_pos,
        y_pos=body.y_pos,
        saved=True,
    )
