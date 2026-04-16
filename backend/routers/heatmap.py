"""
GET /api/em/heatmap — heatmap data for a floor in deterministic or continuous mode.

Data source: three-table join
  gold_inspection_lot → gold_inspection_point → gold_batch_quality_result_v
filtered to PLANT_ID = P225 and INSPECTION_TYPE IN ('14', 'Z14').

Deterministic (worst-case per location in window):
  FAIL    → at least one lot has INSPECTION_RESULT_VALUATION = 'R'
  PENDING → lot exists but INSPECTION_END_DATE IS NULL
  PASS    → all lots have INSPECTION_RESULT_VALUATION = 'A'
  NO_DATA → no lots in window

Continuous (weighted intensity):
  S = sum(F_i * exp(-lambda * t_i))
  F_i: 1.0 for fail ('R'), 0.2 for warning ('W')
  t_i: days since lot CREATED_DATE
  lambda: 0.1 (≈ 14-day effective half-life at ln2/lambda ≈ 6.9 days)
"""

import math
from collections import defaultdict
from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Header, Query

from backend.schemas.em import HeatmapResponse, MarkerData
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

_LAMBDA = 0.1


def _risk_score(lot_rows: list[dict], today: date) -> float:
    score = 0.0
    for r in lot_rows:
        val = (r.get("lot_valuation") or "").upper()
        created_str = r.get("lot_date")
        if not created_str:
            continue
        try:
            created = date.fromisoformat(str(created_str)[:10])
        except ValueError:
            continue
        t_i = (today - created).days
        if val == "R":
            f_i = 1.0
        elif val == "W":
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
    as_of_date: Optional[str] = Query(None, description="ISO date to view heatmap as of"),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)

    reference_date = date.fromisoformat(as_of_date) if as_of_date else date.today()
    date_from = (reference_date - timedelta(days=time_window_days)).isoformat()
    date_to = reference_date.isoformat()

    params = [
        sql_param("floor_id", floor_id),
        sql_param("plant_id", PLANT_ID),
        sql_param("date_from", date_from),
        sql_param("date_to", date_to),
    ]

    # One row per (functional_location, lot) — worst valuation per lot aggregated in SQL.
    # Python then computes the deterministic status and continuous risk score per location.
    sql = f"""
        SELECT
            c.func_loc_id,
            c.floor_id,
            c.x_pos,
            c.y_pos,
            lot.INSPECTION_LOT_ID       AS lot_id,
            lot.CREATED_DATE            AS lot_date,
            lot.INSPECTION_END_DATE     AS lot_end_date,
            MAX(
                CASE r.INSPECTION_RESULT_VALUATION
                    WHEN 'R' THEN 2
                    WHEN 'W' THEN 1
                    WHEN 'A' THEN 0
                    ELSE -1
                END
            )                           AS worst_val_rank,
            MAX(
                CASE r.INSPECTION_RESULT_VALUATION
                    WHEN 'R' THEN 'R'
                    WHEN 'W' THEN 'W'
                    WHEN 'A' THEN 'A'
                    ELSE NULL
                END
            )                           AS lot_valuation
        FROM {COORD_TBL} c
        JOIN {POINT_TBL} ip
            ON c.func_loc_id = ip.FUNCTIONAL_LOCATION
        JOIN {LOT_TBL} lot
            ON ip.INSPECTION_LOT_ID = lot.INSPECTION_LOT_ID
           AND lot.PLANT_ID = :plant_id
           AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
           AND lot.CREATED_DATE >= :date_from
           AND lot.CREATED_DATE <= :date_to
        LEFT JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE c.floor_id = :floor_id
        GROUP BY
            c.func_loc_id, c.floor_id, c.x_pos, c.y_pos,
            lot.INSPECTION_LOT_ID, lot.CREATED_DATE, lot.INSPECTION_END_DATE
    """
    rows = await run_sql_async(token, sql, params)

    # Also fetch coordinates for locations with NO lots (NO_DATA markers)
    coord_sql = f"""
        SELECT func_loc_id, floor_id, x_pos, y_pos
        FROM {COORD_TBL}
        WHERE floor_id = :floor_id
    """
    coord_rows = await run_sql_async(token, coord_sql, [sql_param("floor_id", floor_id)])

    # Build a coordinate map
    coord_map: dict[str, dict] = {r["func_loc_id"]: r for r in coord_rows}

    # Group lot-level rows by func_loc_id
    loc_lots: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        loc_lots[r["func_loc_id"]].append(r)

    today = date.today()
    markers: list[MarkerData] = []

    for func_loc_id, meta in coord_map.items():
        lots = loc_lots.get(func_loc_id, [])
        total_lots = len(lots)
        fail_count = sum(1 for r in lots if r.get("lot_valuation") == "R")
        pass_count = sum(1 for r in lots if r.get("lot_valuation") == "A")
        pending_count = sum(1 for r in lots if r.get("lot_end_date") is None)

        if mode == "deterministic":
            if total_lots == 0:
                status = "NO_DATA"
            elif fail_count > 0:
                status = "FAIL"
            elif pending_count > 0:
                status = "PENDING"
            else:
                status = "PASS"
            risk_score = None
        else:
            risk_score = _risk_score(lots, reference_date)
            if total_lots == 0:
                status = "NO_DATA"
            elif fail_count > 0:
                status = "FAIL"
            else:
                status = "PASS"

        markers.append(
            MarkerData(
                func_loc_id=func_loc_id,
                func_loc_name=None,
                floor_id=meta["floor_id"],
                x_pos=float(meta["x_pos"]),
                y_pos=float(meta["y_pos"]),
                status=status,
                fail_count=fail_count,
                pass_count=pass_count,
                pending_count=pending_count,
                total_count=total_lots,
                risk_score=risk_score,
            )
        )

    return HeatmapResponse(
        floor_id=floor_id,
        mode=mode,
        time_window_days=time_window_days,
        markers=markers,
    )
