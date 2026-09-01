import type { PartialDate } from "@/domain/value-objects/partial-date";

export function formatPartialDate(date: PartialDate | undefined): string {
  if (!date) return "—";
  return date.value;
}

export function formatMeasurements(measurements: {
  bustCm?: number;
  waistCm?: number;
  hipCm?: number;
  cup?: string;
} | undefined): string {
  if (!measurements) return "—";

  const values = [
    measurements.bustCm !== undefined ? `B${measurements.bustCm}` : undefined,
    measurements.waistCm !== undefined ? `W${measurements.waistCm}` : undefined,
    measurements.hipCm !== undefined ? `H${measurements.hipCm}` : undefined,
  ].filter(Boolean);

  const base = values.join(" / ");
  return measurements.cup ? `${base} · ${measurements.cup} cup` : base || "—";
}
