"""
GET /api/em/lots         — inspection lots for a location
GET /api/em/lots/{lot_id} — MIC results for a specific lot
"""

from typing import Optional

from fastapi import APIRouter, Header, Query

from backend.schemas.em import InspectionLot, LotDetailResponse, MicResult
from backend.utils.db import resolve_token, run_sql_async, sql_param, tbl

router = APIRouter()


def _valuation_to_status(valuation: Optional[str], end_date: Optional[str]) -> str:
    if end_date is None:
        return "PENDING"
    v = (valuation or "").upper()
    if v == "R":
        return "FAIL"
    if v == "A":
        return "PASS"
    return "NO_DATA"


@router.get("/lots", response_model=list[InspectionLot])
async def list_lots(
    func_loc_id: str,
    time_window_days: int = Query(90, ge=1, le=365),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)

    from datetime import date, timedelta
    date_from = (date.today() - timedelta(days=time_window_days)).isoformat()

    params = [
        sql_param("func_loc_id", func_loc_id),
        sql_param("date_from", date_from),
    ]

    sql = f"""
        SELECT
            inspection_lot_id AS lot_id,
            func_loc_id,
            inspection_start_date,
            inspection_end_date,
            valuation
        FROM {tbl('em_quality_metrics_mv')}
        WHERE func_loc_id = :func_loc_id
          AND (inspection_start_date >= :date_from OR inspection_start_date IS NULL)
        ORDER BY inspection_start_date DESC
        LIMIT 200
    """
    rows = await run_sql_async(token, sql, params)

    return [
        InspectionLot(
            lot_id=r["lot_id"],
            func_loc_id=r["func_loc_id"],
            inspection_start_date=str(r["inspection_start_date"])[:10] if r.get("inspection_start_date") else None,
            inspection_end_date=str(r["inspection_end_date"])[:10] if r.get("inspection_end_date") else None,
            valuation=r.get("valuation"),
            status=_valuation_to_status(r.get("valuation"), r.get("inspection_end_date")),
        )
        for r in rows
    ]


@router.get("/lots/{lot_id}", response_model=LotDetailResponse)
async def get_lot_detail(
    lot_id: str,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)

    params = [sql_param("lot_id", lot_id)]

    sql = f"""
        SELECT
            q.inspection_lot_id AS lot_id,
            q.mic_id,
            q.mic_name,
            q.result_value,
            q.valuation,
            t.upper_limit,
            t.lower_limit
        FROM {tbl('em_quality_metrics_mv')} q
        LEFT JOIN {tbl('em_limit_thresholds_v')} t
            ON q.func_loc_id = t.func_loc_id
           AND q.mic_name = t.mic_name
        WHERE q.inspection_lot_id = :lot_id
        ORDER BY q.mic_name
    """
    rows = await run_sql_async(token, sql, params)

    mic_results = [
        MicResult(
            lot_id=r["lot_id"],
            mic_id=r.get("mic_id", ""),
            mic_name=r["mic_name"],
            result_value=float(r["result_value"]) if r.get("result_value") is not None else None,
            valuation=r.get("valuation"),
            upper_limit=float(r["upper_limit"]) if r.get("upper_limit") is not None else None,
            lower_limit=float(r["lower_limit"]) if r.get("lower_limit") is not None else None,
        )
        for r in rows
    ]

    return LotDetailResponse(lot_id=lot_id, mic_results=mic_results)
