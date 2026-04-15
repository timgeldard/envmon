"""
GET /api/em/heatmap — heatmap data for a floor in deterministic or continuous mode.

Deterministic (worst-case):
  FAIL   → at least one R valuation in window
  PENDING → lot exists but Inspection_End_Date is NULL
  PASS   → all A valuations
  NO_DATA → no lots in window

Continuous (weighted intensity):
  S = sum(F_i * exp(-lambda * t_i))
  F_i: 1=fail, 0.2=warning
  lambda: 0.1 (≈14-day half-life)
"""

import math
from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Header, Query

from backend.schemas.em import HeatmapResponse, MarkerData
from backend.utils.db import resolve_token, run_sql_async, sql_param, tbl

router = APIRouter()

_LAMBDA = 0.1  # decay constant


def _compute_risk_score(rows: list[dict], today: date) -> float:
    score = 0.0
    for r in rows:
        valuation = (r.get("valuation") or "").upper()
        end_date_str = r.get("inspection_end_date")
        if not end_date_str:
            continue
        try:
            end_date = date.fromisoformat(str(end_date_str)[:10])
        except ValueError:
            continue
        t_i = (today - end_date).days
        if valuation == "R":
            f_i = 1.0
        elif valuation == "W":
            f_i = 0.2
        else:
            continue
        score += f_i * math.exp(-_LAMBDA * t_i)
    return score


@router.get("/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    floor_id: str,
    mode: Literal["deterministic", "continuous"] = Query("deterministic"),
    time_window_days: int = Query(90, ge=1, le=365),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)

    date_from = (date.today() - timedelta(days=time_window_days)).isoformat()
    params = [
        sql_param("floor_id", floor_id),
        sql_param("date_from", date_from),
    ]

    sql = f"""
        SELECT
            c.func_loc_id,
            d.func_loc_name,
            c.floor_id,
            c.x_pos,
            c.y_pos,
            q.inspection_end_date,
            q.valuation
        FROM {tbl('em_location_coordinates')} c
        LEFT JOIN {tbl('em_site_material_dim_mv')} d
            ON c.func_loc_id = d.func_loc_id
        LEFT JOIN {tbl('em_quality_metrics_mv')} q
            ON c.func_loc_id = q.func_loc_id
           AND (q.inspection_start_date >= :date_from OR q.inspection_start_date IS NULL)
        WHERE c.floor_id = :floor_id
        ORDER BY c.func_loc_id
    """
    rows = await run_sql_async(token, sql, params)

    # Group rows by location
    from collections import defaultdict
    loc_rows: dict[str, list[dict]] = defaultdict(list)
    loc_meta: dict[str, dict] = {}
    for r in rows:
        fid = r["func_loc_id"]
        loc_meta[fid] = r
        if r.get("valuation") is not None or r.get("inspection_end_date") is not None:
            loc_rows[fid].append(r)

    today = date.today()
    markers: list[MarkerData] = []

    for fid, meta in loc_meta.items():
        lot_rows = loc_rows.get(fid, [])
        fail_count = sum(1 for r in lot_rows if (r.get("valuation") or "").upper() == "R")
        pass_count = sum(1 for r in lot_rows if (r.get("valuation") or "").upper() == "A")
        pending_count = sum(1 for r in lot_rows if r.get("inspection_end_date") is None and r.get("valuation") is None)
        total = len(lot_rows)

        if mode == "deterministic":
            if total == 0:
                status = "NO_DATA"
            elif fail_count > 0:
                status = "FAIL"
            elif pending_count > 0:
                status = "PENDING"
            else:
                status = "PASS"
            risk_score = None
        else:
            risk_score = _compute_risk_score(lot_rows, today)
            status = "FAIL" if fail_count > 0 else ("PASS" if total > 0 else "NO_DATA")

        markers.append(
            MarkerData(
                func_loc_id=fid,
                func_loc_name=meta.get("func_loc_name"),
                floor_id=meta["floor_id"],
                x_pos=float(meta["x_pos"]),
                y_pos=float(meta["y_pos"]),
                status=status,
                fail_count=fail_count,
                pass_count=pass_count,
                pending_count=pending_count,
                total_count=total,
                risk_score=risk_score,
            )
        )

    return HeatmapResponse(
        floor_id=floor_id,
        mode=mode,
        time_window_days=time_window_days,
        markers=markers,
    )
