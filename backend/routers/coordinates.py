"""
GET  /api/em/coordinates/unmapped — locations in dim that have no coordinate entry
POST /api/em/coordinates          — upsert a coordinate mapping (admin only)
"""

from typing import Optional

from fastapi import APIRouter, Header

from backend.schemas.em import CoordinateUpsertRequest, CoordinateUpsertResponse, LocationMeta
from backend.utils.db import resolve_token, run_sql_async, sql_param, tbl

router = APIRouter()


@router.get("/coordinates/unmapped", response_model=list[LocationMeta])
async def list_unmapped(
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return SAP locations that exist in the dimension view but have no X/Y mapping."""
    token = resolve_token(x_forwarded_access_token, authorization)

    sql = f"""
        SELECT
            d.func_loc_id,
            d.func_loc_name,
            d.plant_id
        FROM {tbl('em_site_material_dim_mv')} d
        LEFT JOIN {tbl('em_location_coordinates')} c
            ON d.func_loc_id = c.func_loc_id
        WHERE c.func_loc_id IS NULL
        ORDER BY d.func_loc_id
    """
    rows = await run_sql_async(token, sql)

    return [
        LocationMeta(
            func_loc_id=r["func_loc_id"],
            func_loc_name=r.get("func_loc_name"),
            plant_id=r.get("plant_id", ""),
            floor_id=None,
            x_pos=None,
            y_pos=None,
            is_mapped=False,
        )
        for r in rows
    ]


@router.post("/coordinates", response_model=CoordinateUpsertResponse)
async def upsert_coordinate(
    body: CoordinateUpsertRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Insert or update the X/Y coordinates for a functional location."""
    token = resolve_token(x_forwarded_access_token, authorization)

    params = [
        sql_param("func_loc_id", body.func_loc_id),
        sql_param("floor_id", body.floor_id),
        sql_param("x_pos", body.x_pos),
        sql_param("y_pos", body.y_pos),
    ]

    # MERGE upserts into the Silver coordinate table
    sql = f"""
        MERGE INTO {tbl('em_location_coordinates')} AS target
        USING (
            SELECT
                :func_loc_id AS func_loc_id,
                :floor_id    AS floor_id,
                CAST(:x_pos AS DOUBLE) AS x_pos,
                CAST(:y_pos AS DOUBLE) AS y_pos
        ) AS source
        ON target.func_loc_id = source.func_loc_id
        WHEN MATCHED THEN UPDATE SET
            target.floor_id     = source.floor_id,
            target.x_pos        = source.x_pos,
            target.y_pos        = source.y_pos,
            target.updated_by   = CURRENT_USER(),
            target.updated_at   = CURRENT_TIMESTAMP()
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
