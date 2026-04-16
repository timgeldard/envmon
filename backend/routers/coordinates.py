"""
GET    /api/em/coordinates/unmapped      — functional locations with no X/Y entry
GET    /api/em/coordinates/mapped        — functional locations that have coordinates
POST   /api/em/coordinates              — upsert a coordinate mapping (admin)
DELETE /api/em/coordinates/{func_loc_id} — remove a coordinate mapping (admin)

Unmapped locations are derived by finding all DISTINCT FUNCTIONAL_LOCATION values
from the inspection point data (type-14 lots, P225) that have no corresponding
row in em_location_coordinates.
"""

from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from backend.schemas.em import CoordinateUpsertRequest, CoordinateUpsertResponse, LocationMeta
from backend.utils.db import resolve_token, run_sql_async, sql_param
from backend.utils.em_config import (
    COORD_TBL,
    INSP_TYPES_SQL,
    LOT_TBL,
    PLANT_ID,
    POINT_TBL,
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
