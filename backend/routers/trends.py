"""
GET /api/em/trends — MIC time-series for a specific functional location.

Uses the three-table join:
  gold_inspection_lot → gold_inspection_point → gold_batch_quality_result_v

MIC name matching uses UPPER(TRIM()) to handle the historical naming inconsistencies
documented in the data reference (e.g. 'Chronobacter Swab' vs 'Chronobacter swab').

Also exposes:
GET /api/em/mics?func_loc_id=... — distinct normalised MIC names for a location
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Header, Query

from backend.schemas.em import TrendPoint, TrendResponse
from backend.utils.db import resolve_token, run_sql_async, sql_param
from backend.utils.em_config import (
    INSP_TYPES_SQL,
    LOT_TBL,
    PLANT_ID,
    POINT_TBL,
    RESULT_TBL,
)

router = APIRouter()


@router.get("/mics", response_model=list[str])
async def list_mics(
    func_loc_id: str,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return distinct normalised MIC names available for a functional location."""
    token = resolve_token(x_forwarded_access_token, authorization)

    params = [
        sql_param("func_loc_id", func_loc_id),
        sql_param("plant_id", PLANT_ID),
    ]

    sql = f"""
        SELECT DISTINCT UPPER(TRIM(r.MIC_NAME)) AS mic_name
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip
            ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID           = :plant_id
          AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION = :func_loc_id
          AND r.MIC_NAME IS NOT NULL
        ORDER BY mic_name
    """
    rows = await run_sql_async(token, sql, params)
    return [r["mic_name"] for r in rows if r.get("mic_name")]


@router.get("/trends", response_model=TrendResponse)
async def get_trends(
    func_loc_id: str,
    mic_name: str,
    window_days: int = Query(90, ge=1, le=365),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Returns a time-series of MIC results for the given functional location.

    mic_name is matched case-insensitively (UPPER TRIM) to handle historical
    naming inconsistencies across the SAP data.
    """
    token = resolve_token(x_forwarded_access_token, authorization)

    date_from = (date.today() - timedelta(days=window_days)).isoformat()
    params = [
        sql_param("func_loc_id", func_loc_id),
        sql_param("mic_name", mic_name.upper().strip()),
        sql_param("plant_id", PLANT_ID),
        sql_param("date_from", date_from),
    ]

    sql = f"""
        SELECT
            lot.CREATED_DATE                        AS inspection_date,
            UPPER(TRIM(r.MIC_NAME))                 AS mic_name,
            r.QUANTITATIVE_RESULT                   AS result_value,
            r.INSPECTION_RESULT_VALUATION           AS valuation,
            r.UPPER_TOLERANCE                       AS upper_limit,
            r.LOWER_TOLERANCE                       AS lower_limit,
            r.UNIT_OF_MEASURE                       AS unit,
            r.ATTRIBUTE                             AS attribute
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip
            ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID              = :plant_id
          AND lot.INSPECTION_TYPE   IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION    = :func_loc_id
          AND UPPER(TRIM(r.MIC_NAME))   = :mic_name
          AND lot.CREATED_DATE         >= :date_from
        ORDER BY lot.CREATED_DATE ASC
    """
    rows = await run_sql_async(token, sql, params)

    points = [
        TrendPoint(
            inspection_date=str(r["inspection_date"])[:10],
            mic_name=r["mic_name"],
            result_value=float(r["result_value"]) if r.get("result_value") is not None else None,
            valuation=r.get("valuation"),
            upper_limit=float(r["upper_limit"]) if r.get("upper_limit") is not None else None,
            lower_limit=float(r["lower_limit"]) if r.get("lower_limit") is not None else None,
        )
        for r in rows
    ]

    return TrendResponse(
        func_loc_id=func_loc_id,
        mic_name=mic_name,
        window_days=window_days,
        points=points,
    )
