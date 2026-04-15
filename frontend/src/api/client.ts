/**
 * React Query hooks for all EM API endpoints.
 * All fetches are unauthenticated from the frontend — the Databricks Apps
 * proxy injects the x-forwarded-access-token header on the backend.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  FloorInfo,
  LocationMeta,
  HeatmapResponse,
  HeatmapMode,
  TrendResponse,
  InspectionLot,
  LotDetailResponse,
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
    staleTime: 5 * 60_000,
  });
}

export function useLocations(floorId?: string, mappedOnly = false) {
  const params = new URLSearchParams();
  if (floorId) params.set('floor_id', floorId);
  if (mappedOnly) params.set('mapped_only', 'true');

  return useQuery<LocationMeta[]>({
    queryKey: ['locations', floorId, mappedOnly],
    queryFn: () => apiFetch(`/api/em/locations?${params}`),
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

export function useHeatmap(
  floorId: string,
  mode: HeatmapMode,
  timeWindowDays: number,
) {
  const params = new URLSearchParams({
    floor_id: floorId,
    mode,
    time_window_days: String(timeWindowDays),
  });

  return useQuery<HeatmapResponse>({
    queryKey: ['heatmap', floorId, mode, timeWindowDays],
    queryFn: () => apiFetch(`/api/em/heatmap?${params}`),
    staleTime: 5 * 60_000,
    enabled: Boolean(floorId),
  });
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

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
    staleTime: 5 * 60_000,
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
    staleTime: 5 * 60_000,
  });
}

export function useLotDetail(lotId: string | null) {
  return useQuery<LotDetailResponse>({
    queryKey: ['lot-detail', lotId],
    queryFn: () => apiFetch(`/api/em/lots/${lotId}`),
    enabled: Boolean(lotId),
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Coordinates (admin)
// ---------------------------------------------------------------------------

export function useUnmappedLocations() {
  return useQuery<LocationMeta[]>({
    queryKey: ['coordinates', 'unmapped'],
    queryFn: () => apiFetch('/api/em/coordinates/unmapped'),
    staleTime: 60_000,
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
