"""
GET /api/em/trends — MIC trend sparkline data for a specific location.
"""

from typing import Optional

from fastapi import APIRouter, Header, Query

from backend.schemas.em import TrendResponse, TrendPoint
from backend.utils.db import resolve_token, run_sql_async, sql_param, tbl

router = APIRouter()


@router.get("/trends", response_model=TrendResponse)
async def get_trends(
    func_loc_id: str,
    mic_name: str,
    window_days: int = Query(90, ge=1, le=365),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)

    from datetime import date, timedelta
    date_from = (date.today() - timedelta(days=window_days)).isoformat()

    params = [
        sql_param("func_loc_id", func_loc_id),
        sql_param("mic_name", mic_name),
        sql_param("date_from", date_from),
    ]

    sql = f"""
        SELECT
            u.inspection_date,
            u.mic_name,
            u.result_value,
            u.valuation,
            t.upper_limit,
            t.lower_limit
        FROM {tbl('em_unified_mic_views')} u
        LEFT JOIN {tbl('em_limit_thresholds_v')} t
            ON u.func_loc_id = t.func_loc_id
           AND u.mic_name = t.mic_name
        WHERE u.func_loc_id = :func_loc_id
          AND u.mic_name = :mic_name
          AND u.inspection_date >= :date_from
        ORDER BY u.inspection_date ASC
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
