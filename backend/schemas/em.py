"""Pydantic schemas for the EM API request/response models."""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared / primitives
# ---------------------------------------------------------------------------

class LocationCoordinate(BaseModel):
    func_loc_id: str
    floor_id: str
    x_pos: float = Field(ge=0.0, le=100.0, description="Relative X position as %")
    y_pos: float = Field(ge=0.0, le=100.0, description="Relative Y position as %")


# ---------------------------------------------------------------------------
# Heatmap
# ---------------------------------------------------------------------------

HeatmapStatus = Literal["PASS", "FAIL", "PENDING", "NO_DATA"]


class MarkerData(BaseModel):
    func_loc_id: str
    func_loc_name: Optional[str] = None
    floor_id: str
    x_pos: float
    y_pos: float
    status: HeatmapStatus
    # Deterministic mode
    fail_count: int = 0
    pass_count: int = 0
    pending_count: int = 0
    total_count: int = 0
    # Continuous mode
    risk_score: Optional[float] = None


class HeatmapResponse(BaseModel):
    floor_id: str
    mode: Literal["deterministic", "continuous"]
    time_window_days: int
    markers: list[MarkerData]


# ---------------------------------------------------------------------------
# Floors / locations
# ---------------------------------------------------------------------------

class FloorInfo(BaseModel):
    floor_id: str
    floor_name: str
    location_count: int


class LocationMeta(BaseModel):
    func_loc_id: str
    func_loc_name: Optional[str] = None
    plant_id: str
    floor_id: Optional[str] = None
    x_pos: Optional[float] = None
    y_pos: Optional[float] = None
    is_mapped: bool


class LocationSummary(BaseModel):
    meta: LocationMeta
    mics: list[str]
    recent_lots: list[InspectionLot]


# ---------------------------------------------------------------------------
# Trends
# ---------------------------------------------------------------------------

class TrendPoint(BaseModel):
    inspection_date: str
    mic_name: str
    result_value: Optional[float] = None
    valuation: Optional[str] = None
    upper_limit: Optional[float] = None
    lower_limit: Optional[float] = None


class TrendResponse(BaseModel):
    func_loc_id: str
    mic_name: str
    window_days: int
    points: list[TrendPoint]


# ---------------------------------------------------------------------------
# Inspection lots
# ---------------------------------------------------------------------------

class InspectionLot(BaseModel):
    lot_id: str
    func_loc_id: str
    inspection_start_date: Optional[str] = None
    inspection_end_date: Optional[str] = None
    valuation: Optional[str] = None
    status: HeatmapStatus


class MicResult(BaseModel):
    lot_id: str
    mic_id: str
    mic_name: str
    result_value: Optional[float] = None
    valuation: Optional[str] = None
    upper_limit: Optional[float] = None
    lower_limit: Optional[float] = None


class LotDetailResponse(BaseModel):
    lot_id: str
    mic_results: list[MicResult]


# ---------------------------------------------------------------------------
# Coordinate authoring
# ---------------------------------------------------------------------------

class CoordinateUpsertRequest(BaseModel):
    func_loc_id: str
    floor_id: str
    x_pos: float = Field(ge=0.0, le=100.0)
    y_pos: float = Field(ge=0.0, le=100.0)


class CoordinateUpsertResponse(BaseModel):
    func_loc_id: str
    floor_id: str
    x_pos: float
    y_pos: float
    saved: bool
