"""
GET /api/em/heatmap — heatmap data for a floor with advanced analytics.

Features:
- Deterministic/Continuous modes
- Time-travel historical view (as_of_date)
- MIC-specific filtering and dynamic decay tuning
- Early Warning via Statistical Process Control (SPC)
"""

import math
import os
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
    MIC_DECAY_RATES,
    PLANT_ID,
    POINT_TBL,
    RESULT_TBL,
)

router = APIRouter()

# Default decay constant yielding a ~7 day half-life (ln2/0.1 ≈ 6.93)
_DEFAULT_LAMBDA = float(os.environ.get("EM_DEFAULT_DECAY_LAMBDA", "0.1"))


def _risk_score(rows: list[dict], today: date, decay_lambda: float) -> float:
    """
    Calculate weighted intensity risk score.
    Now supports MIC-specific decay if available.
    """
    score = 0.0
    for r in rows:
        val = (r.get("valuation") or "").upper()
        mic_name = (r.get("mic_name") or "").upper().strip()
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

        # Use MIC-specific lambda if defined, else fallback to global
        lam = MIC_DECAY_RATES.get(mic_name, decay_lambda)
        score += f_i * math.exp(-lam * t_i)
    return score


def _check_spc_warning(rows: list[dict]) -> bool:
    """
    Apply lightweight SPC rules for Early Warning.
    Nelson Rule 1 variant: 3 consecutive rising quantitative swabs.
    """
    # Sort by date
    sorted_rows = sorted(
        [r for r in rows if r.get("result_value") is not None],
        key=lambda x: x["lot_date"]
    )
    if len(sorted_rows) < 3:
        return False

    last_3 = sorted_rows[-3:]
    v1, v2, v3 = last_3[0]["result_value"], last_3[1]["result_value"], last_3[2]["result_value"]

    # Strictly increasing?
    if v3 > v2 > v1:
        # approaching upper limit? (if limit exists)
        limit = last_3[2].get("upper_limit")
        if limit is not None and limit > 0:
            if v3 >= (limit * 0.5): # flag if > 50% of limit
                return True
        else:
            # no limit, just flag the trend if it's substantial (> 10% rise)
            if (v3 / v1) > 1.1:
                return True

    return False


@router.get("/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    floor_id: str,
    mode: Literal["deterministic", "continuous"] = Query("deterministic"),
    time_window_days: int = Query(90, ge=1, le=365),
    decay_lambda: Optional[float] = Query(None, ge=0.0, le=1.0),
    mics: Optional[list[str]] = Query(None),
    as_of_date: Optional[date] = Query(None),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)

    reference_date = as_of_date or date.today()
    date_from = (reference_date - timedelta(days=time_window_days)).isoformat()
    date_to = reference_date.isoformat()

    applied_lambda = decay_lambda if decay_lambda is not None else _DEFAULT_LAMBDA

    params = [
        sql_param("floor_id", floor_id),
        sql_param("plant_id", PLANT_ID),
        sql_param("date_from", date_from),
        sql_param("date_to", date_to),
    ]

    mic_filter = ""
    if mics:
        # Normalise input MICs for SQL
        norm_mics = [m.upper().strip() for m in mics]
        for idx, m in enumerate(norm_mics):
            pname = f"mic_{idx}"
            params.append(sql_param(pname, m))
        placeholders = ", ".join(f":mic_{idx}" for idx in range(len(norm_mics)))
        mic_filter = f"AND UPPER(TRIM(r.MIC_NAME)) IN ({placeholders})"

    sql = f"""
        SELECT
            c.func_loc_id,
            c.floor_id,
            c.x_pos,
            c.y_pos,
            lot.INSPECTION_LOT_ID       AS lot_id,
            lot.CREATED_DATE            AS lot_date,
            lot.INSPECTION_END_DATE     AS lot_end_date,
            UPPER(TRIM(r.MIC_NAME))     AS mic_name,
            r.QUANTITATIVE_RESULT       AS result_value,
            r.UPPER_TOLERANCE           AS upper_limit,
            r.INSPECTION_RESULT_VALUATION AS valuation
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
          {mic_filter}
    """
    rows = await run_sql_async(token, sql, params)

    # Coordinates for NO_DATA placeholders
    coord_sql = f"SELECT func_loc_id, floor_id, x_pos, y_pos FROM {COORD_TBL} WHERE floor_id = :floor_id"
    coord_rows = await run_sql_async(token, coord_sql, [sql_param("floor_id", floor_id)])
    coord_map = {r["func_loc_id"]: r for r in coord_rows}

    # Group results by func_loc_id
    loc_results = defaultdict(list)
    for r in rows:
        loc_results[r["func_loc_id"]].append(r)

    markers: list[MarkerData] = []

    for func_loc_id, meta in coord_map.items():
        results = loc_results.get(func_loc_id, [])
        total_lots = len(set(r["lot_id"] for r in results if r.get("lot_id")))
        fail_count = sum(1 for r in results if r.get("valuation") == "R")
        pass_count = sum(1 for r in results if r.get("valuation") == "A")
        pending_count = sum(1 for r in results if r.get("lot_id") and r.get("lot_end_date") is None)

        if mode == "deterministic":
            if total_lots == 0:
                status = "NO_DATA"
            elif fail_count > 0:
                status = "FAIL"
            elif _check_spc_warning(results):
                status = "WARNING"
            elif pending_count > 0:
                status = "PENDING"
            else:
                status = "PASS"
            risk_score = None
        else:
            risk_score = _risk_score(results, reference_date, applied_lambda)
            if total_lots == 0:
                status = "NO_DATA"
            elif fail_count > 0:
                status = "FAIL"
            elif _check_spc_warning(results):
                status = "WARNING"
            else:
                status = "PASS"

        markers.append(
            MarkerData(
                func_loc_id=func_loc_id,
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
        decay_lambda=applied_lambda,
        markers=markers,
    )
