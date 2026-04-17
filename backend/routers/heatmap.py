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

def _get_default_lambda() -> float:
    raw = os.environ.get("EM_DEFAULT_DECAY_LAMBDA", "0.1").strip()
    try:
        val = float(raw)
        return min(max(val, 0.0), 1.0)
    except (ValueError, TypeError):
        return 0.1

_DEFAULT_LAMBDA = _get_default_lambda()


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
    Evaluated per mic_name.
    """
    # Group by MIC name
    mic_groups = defaultdict(list)
    for r in rows:
        if r.get("mic_name") and r.get("result_value") is not None:
            mic_groups[r["mic_name"]].append(r)

    for mic_name, group in mic_groups.items():
        # Sort by date
        sorted_group = sorted(group, key=lambda x: x["lot_date"])
        if len(sorted_group) < 3:
            continue

        last_3 = sorted_group[-3:]
        try:
            v1 = float(last_3[0]["result_value"])
            v2 = float(last_3[1]["result_value"])
            v3 = float(last_3[2]["result_value"])
        except (TypeError, ValueError):
            continue

        # Strictly increasing?
        if v3 > v2 > v1:
            # approaching upper limit? (if limit exists)
            raw_limit = last_3[2].get("upper_limit")
            try:
                limit = float(raw_limit) if raw_limit is not None else None
            except (TypeError, ValueError):
                limit = None
            if limit is not None and limit > 0:
                if v3 >= (limit * 0.5): # flag if > 50% of limit
                    return True
            else:
                # no limit, flag if rise is substantial
                # v1 might be 0, handle division by zero
                if v1 == 0:
                    if v3 >= 1.0: # arbitrary threshold for 0 baseline
                        return True
                elif (v3 / v1) > 1.1:
                    return True

    return False


@router.get("/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    floor_id: str,
    mode: Literal["deterministic", "continuous"] = Query("deterministic"),
    time_window_days: int = Query(365, ge=1, le=365),
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

    # Valuation ranking for worst-case collapse
    VAL_RANK = {"R": 2, "W": 1, "A": 0}

    for func_loc_id, meta in coord_map.items():
        results = loc_results.get(func_loc_id, [])
        
        # Collapse results to per-lot metrics
        lots_info = {}
        for r in results:
            lid = r["lot_id"]
            if lid not in lots_info:
                lots_info[lid] = {
                    "valuation": None,
                    "end_date": r.get("lot_end_date")
                }
            
            # Update worst valuation for this lot
            current_val = r.get("valuation")
            if current_val in VAL_RANK:
                existing_val = lots_info[lid]["valuation"]
                if existing_val is None or VAL_RANK[current_val] > VAL_RANK[existing_val]:
                    lots_info[lid]["valuation"] = current_val

        total_lots = len(lots_info)
        fail_count = sum(1 for info in lots_info.values() if info["valuation"] == "R")
        pass_count = sum(1 for info in lots_info.values() if info["valuation"] == "A")
        pending_count = sum(1 for info in lots_info.values() if info["end_date"] is None)

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
