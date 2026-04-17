// ---------------------------------------------------------------------------
// Shared domain types — mirror backend Pydantic schemas
// ---------------------------------------------------------------------------

export type HeatmapStatus = 'PASS' | 'FAIL' | 'PENDING' | 'NO_DATA';
export type HeatmapMode = 'deterministic' | 'continuous';
export type TimeWindow = 30 | 60 | 90 | 180 | 365;

export interface FloorInfo {
  floor_id: string;
  floor_name: string;
  location_count: number;
}

export interface LocationMeta {
  func_loc_id: string;
  func_loc_name: string | null;
  plant_id: string;
  floor_id: string | null;
  x_pos: number | null;
  y_pos: number | null;
  is_mapped: boolean;
}

export interface MarkerData {
  func_loc_id: string;
  func_loc_name: string | null;
  floor_id: string;
  x_pos: number;
  y_pos: number;
  status: HeatmapStatus;
  fail_count: number;
  pass_count: number;
  pending_count: number;
  total_count: number;
  risk_score: number | null;
}

export interface HeatmapResponse {
  floor_id: string;
  mode: HeatmapMode;
  time_window_days: number;
  markers: MarkerData[];
}

export interface TrendPoint {
  inspection_date: string;
  mic_name: string;
  result_value: number | null;
  valuation: string | null;
  upper_limit: number | null;
  lower_limit: number | null;
}

export interface TrendResponse {
  func_loc_id: string;
  mic_name: string;
  window_days: number;
  points: TrendPoint[];
}

export interface InspectionLot {
  lot_id: string;
  func_loc_id: string;
  inspection_start_date: string | null;
  inspection_end_date: string | null;
  valuation: string | null;
  status: HeatmapStatus;
}

export interface MicResult {
  lot_id: string;
  mic_id: string;
  mic_name: string;
  result_value: number | null;
  valuation: string | null;
  upper_limit: number | null;
  lower_limit: number | null;
}

export interface LotDetailResponse {
  lot_id: string;
  mic_results: MicResult[];
}

export interface LocationSummary {
  meta: LocationMeta;
  mics: string[];
  recent_lots: InspectionLot[];
}

export interface CoordinateUpsertRequest {
  func_loc_id: string;
  floor_id: string;
  x_pos: number;
  y_pos: number;
}
