import { createClient } from "./supabase/client";
import type { UserSavedPc } from "../types/hardware";

export interface SavedPcSpec extends UserSavedPc {
  ramCount: number;
  ramDetailedInputEnabled: boolean;
  ramProductName: string;
  ssdDetailedInputEnabled: boolean;
  ssdProductName: string;
  mbBrand: string;
  mbSeries: string;
  mbDetail: string;
  psuWatt: string;
  hasCase: boolean;
  monitorCount: number;
  commandScanRawText: string;
}

interface PcSpecRow {
  id: string;
  cpu_id: string;
  gpu_id: string;
  ram_capacity: string;
  ram_count: number;
  ram_detail_enabled: boolean;
  ram_detail: string | null;
  ssd_capacity: string;
  ssd_detail_enabled: boolean;
  ssd_detail: string | null;
  mb_brand: string | null;
  mb_series: string | null;
  mb_detail: string | null;
  psu_watt: string | null;
  has_case: boolean;
  monitor_resolution: string;
  monitor_refresh_rate: number;
  monitor_count: number;
  command_scan_raw_text: string | null;
}

function mapRowToSavedPcSpec(row: PcSpecRow): SavedPcSpec {
  return {
    id: row.id,
    cpuId: row.cpu_id,
    gpuId: row.gpu_id,
    ramCapacity: row.ram_capacity,
    ramCount: row.ram_count,
    ramDetailedInputEnabled: row.ram_detail_enabled,
    ramProductName: row.ram_detail ?? "",
    ramDetail: row.ram_detail_enabled ? (row.ram_detail ?? undefined) : undefined,
    ssdCapacity: row.ssd_capacity,
    ssdDetailedInputEnabled: row.ssd_detail_enabled,
    ssdProductName: row.ssd_detail ?? "",
    ssdDetail: row.ssd_detail_enabled ? (row.ssd_detail ?? undefined) : undefined,
    mbBrand: row.mb_brand ?? "",
    mbSeries: row.mb_series ?? "",
    mbDetail: row.mb_detail ?? "",
    psuWatt: row.psu_watt ?? "",
    hasCase: row.has_case,
    monitorResolution: row.monitor_resolution as UserSavedPc["monitorResolution"],
    monitorRefreshRate: row.monitor_refresh_rate,
    monitorCount: row.monitor_count,
    commandScanRawText: row.command_scan_raw_text ?? "",
  };
}

export async function getSavedPcSpec(): Promise<SavedPcSpec | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("pc_specs").select("*").eq("user_id", user.id).maybeSingle();
  if (error || !data) return null;

  return mapRowToSavedPcSpec(data as PcSpecRow);
}

export interface UpsertSavedPcSpecInput {
  cpuId: string;
  gpuId: string;
  ramCapacity: string;
  ramCount: number;
  ramDetailedInputEnabled: boolean;
  ramProductName: string;
  ssdCapacity: string;
  ssdDetailedInputEnabled: boolean;
  ssdProductName: string;
  mbBrand: string;
  mbSeries: string;
  mbDetail: string;
  psuWatt: string;
  hasCase: boolean;
  monitorResolution: UserSavedPc["monitorResolution"];
  monitorRefreshRate: number;
  monitorCount: number;
  commandScanRawText: string;
}

export async function upsertSavedPcSpec(input: UpsertSavedPcSpecInput): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const { error } = await supabase.from("pc_specs").upsert(
    {
      user_id: user.id,
      cpu_id: input.cpuId,
      gpu_id: input.gpuId,
      ram_capacity: input.ramCapacity,
      ram_count: input.ramCount,
      ram_detail_enabled: input.ramDetailedInputEnabled,
      ram_detail: input.ramProductName,
      ssd_capacity: input.ssdCapacity,
      ssd_detail_enabled: input.ssdDetailedInputEnabled,
      ssd_detail: input.ssdProductName,
      mb_brand: input.mbBrand,
      mb_series: input.mbSeries,
      mb_detail: input.mbDetail,
      psu_watt: input.psuWatt,
      has_case: input.hasCase,
      monitor_resolution: input.monitorResolution,
      monitor_refresh_rate: input.monitorRefreshRate,
      monitor_count: input.monitorCount,
      command_scan_raw_text: input.commandScanRawText,
    },
    { onConflict: "user_id" }
  );

  return { error: error ? "저장에 실패했어요. 다시 시도해 주세요." : null };
}
