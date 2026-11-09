import type { Translator } from "@/lib/dictionaries";
import { compassPoint, metersToFeet, mpsToFeetPerMinute, mpsToKmh, mpsToKnots } from "@/lib/flights";

export const EMPTY_VALUE = "—";

export function formatNumber(value: number, locale: string, digits = 0): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatAltitude(
  meters: number | null,
  locale: string,
  t: Translator,
): string {
  if (meters === null || !Number.isFinite(meters)) return EMPTY_VALUE;
  return `${formatNumber(meters, locale)} ${t("flights.unit.meters")} · ${formatNumber(
    metersToFeet(meters),
    locale,
  )} ${t("flights.unit.feet")}`;
}

export function formatSpeed(
  mps: number | null,
  locale: string,
  t: Translator,
): string {
  if (mps === null || !Number.isFinite(mps)) return EMPTY_VALUE;
  return `${formatNumber(mpsToKmh(mps), locale)} ${t("flights.unit.kmh")} · ${formatNumber(
    mpsToKnots(mps),
    locale,
  )} ${t("flights.unit.knots")}`;
}

export function formatHeading(heading: number | null, locale: string): string {
  if (heading === null || !Number.isFinite(heading)) return EMPTY_VALUE;
  const normalised = ((heading % 360) + 360) % 360;
  return `${formatNumber(normalised, locale)}° ${compassPoint(normalised)}`;
}

export function formatVerticalRate(
  mps: number | null,
  locale: string,
  t: Translator,
): string {
  if (mps === null || !Number.isFinite(mps)) return EMPTY_VALUE;
  const arrow = mps > 0.2 ? "↑" : mps < -0.2 ? "↓" : "→";
  return `${arrow} ${formatNumber(Math.abs(mpsToFeetPerMinute(mps)), locale)} ${t(
    "flights.unit.fpm",
  )}`;
}

export function formatFlightTime(unixSeconds: number | null, locale: string): string {
  if (unixSeconds === null || !Number.isFinite(unixSeconds)) return EMPTY_VALUE;
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(unixSeconds * 1_000));
}

export function formatClock(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

export function positionSourceLabel(
  source: number | null,
  t: Translator,
): string {
  if (source === 0) return t("flights.detail.sourceAdsB");
  if (source === 2) return t("flights.detail.sourceMlat");
  if (source === 1) return t("flights.detail.sourceAsterix");
  if (source === 3) return t("flights.detail.sourceFlarm");
  return t("flights.detail.sourceOther");
}
