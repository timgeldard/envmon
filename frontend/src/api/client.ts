/**
 * React Query hooks for all EM API endpoints.
 * All fetches are unauthenticated from the frontend — the Databricks Apps
 * proxy injects the x-forwarded-access-token header on the backend.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// staleTime tiers — queries differ in how fresh the data needs to be.
const STALE = {
  realtime: 30_000,       // heatmap: data driving the primary visual
  dynamic:  2 * 60_000,   // trends, lots, location summary: change with new inspections
  stable:   10 * 60_000,  // floors, locations, MIC list: rarely change within a session
  admin:    30_000,       // admin coord listings: must reflect recent mutations
} as const;
import type {
  FloorInfo,
  LocationMeta,
  HeatmapResponse,
  HeatmapMode,
  TrendResponse,
  InspectionLot,
  LotDetailResponse,
  LocationSummary,
  CoordinateUpsertRequest,
} from '~/types';

// ---------------------------------------------------------------------------
// Base fetch
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Floors
// ---------------------------------------------------------------------------

export function useFloors() {
  return useQuery<FloorInfo[]>({
    queryKey: ['floors'],
    queryFn: () => apiFetch('/api/em/floors'),
    staleTime: STALE.stable,
  });
}

export function useLocations(floorId?: string, mappedOnly = false) {
  const params = new URLSearchParams();
  if (floorId) params.set('floor_id', floorId);
  if (mappedOnly) params.set('mapped_only', 'true');

  return useQuery<LocationMeta[]>({
    queryKey: ['locations', floorId, mappedOnly],
    queryFn: () => apiFetch(`/api/em/locations?${params}`),
    staleTime: STALE.stable,
  });
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

export function useHeatmap(
  floorId: string,
  mode: HeatmapMode,
  timeWindowDays: number,
  asOfDate?: string | null,
  decayLambda?: number,
  mics?: string[],
) {
  const params = new URLSearchParams({
    floor_id: floorId,
    mode,
    time_window_days: String(timeWindowDays),
  });
  if (asOfDate) params.set('as_of_date', asOfDate);
  if (decayLambda !== undefined) params.set('decay_lambda', String(decayLambda));
  if (mics?.length) {
    mics.forEach((m) => params.append('mics', m));
  }

  return useQuery<HeatmapResponse>({
    queryKey: ['heatmap', floorId, mode, timeWindowDays, asOfDate, decayLambda, mics],
    queryFn: () => apiFetch(`/api/em/heatmap?${params}`),
    staleTime: STALE.realtime,
    enabled: Boolean(floorId),
  });
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export function useMics(funcLocId: string | null = null) {
  const params = new URLSearchParams();
  if (funcLocId) params.set('func_loc_id', funcLocId);

  return useQuery<string[]>({
    queryKey: ['mics', funcLocId],
    queryFn: () => apiFetch(`/api/em/mics?${params}`),
    staleTime: STALE.stable,
  });
}

export function useTrends(
  funcLocId: string | null,
  micName: string | null,
  windowDays: number,
) {
  const params = new URLSearchParams();
  if (funcLocId) params.set('func_loc_id', funcLocId);
  if (micName) params.set('mic_name', micName);
  params.set('window_days', String(windowDays));

  return useQuery<TrendResponse>({
    queryKey: ['trends', funcLocId, micName, windowDays],
    queryFn: () => apiFetch(`/api/em/trends?${params}`),
    enabled: Boolean(funcLocId && micName),
    staleTime: STALE.dynamic,
  });
}

// ---------------------------------------------------------------------------
// Lots
// ---------------------------------------------------------------------------

export function useLots(funcLocId: string | null, timeWindowDays: number) {
  const params = new URLSearchParams();
  if (funcLocId) params.set('func_loc_id', funcLocId);
  params.set('time_window_days', String(timeWindowDays));

  return useQuery<InspectionLot[]>({
    queryKey: ['lots', funcLocId, timeWindowDays],
    queryFn: () => apiFetch(`/api/em/lots?${params}`),
    enabled: Boolean(funcLocId),
    staleTime: STALE.dynamic,
  });
}

export function useLotDetail(lotId: string | null) {
  return useQuery<LotDetailResponse>({
    queryKey: ['lot-detail', lotId],
    queryFn: () => apiFetch(`/api/em/lots/${lotId}`),
    enabled: Boolean(lotId),
    staleTime: STALE.stable,
  });
}

export function useLocationSummary(funcLocId: string | null) {
  return useQuery<LocationSummary>({
    queryKey: ['location-summary', funcLocId],
    queryFn: () => apiFetch(`/api/em/locations/${encodeURIComponent(funcLocId!)}/summary`),
    enabled: Boolean(funcLocId),
    staleTime: STALE.dynamic,
  });
}

// ---------------------------------------------------------------------------
// Coordinates (admin)
// ---------------------------------------------------------------------------

export function useUnmappedLocations() {
  return useQuery<LocationMeta[]>({
    queryKey: ['coordinates', 'unmapped'],
    queryFn: () => apiFetch('/api/em/coordinates/unmapped'),
    staleTime: STALE.admin,
  });
}

export function useMappedLocations() {
  return useQuery<LocationMeta[]>({
    queryKey: ['coordinates', 'mapped'],
    queryFn: () => apiFetch('/api/em/coordinates/mapped'),
    staleTime: STALE.admin,
  });
}

export function useSaveCoordinate() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, CoordinateUpsertRequest>({
    mutationFn: (body) =>
      apiFetch('/api/em/coordinates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinates'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['heatmap'] });
    },
  });
}

export function useDeleteCoordinate() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string>({
    mutationFn: (funcLocId) =>
      apiFetch(`/api/em/coordinates/${encodeURIComponent(funcLocId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinates'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['heatmap'] });
    },
  });
}
