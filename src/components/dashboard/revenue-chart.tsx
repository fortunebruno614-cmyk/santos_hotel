"use client";

import { useMemo, useRef, useState } from "react";
import type { ChartPoint } from "@/server/console/analytics";
import { formatMoney } from "./ui";

const COLORS = {
  revenue: "#047857",
  expenses: "#dc2626",
  net: "#18181b",
  previous: "#a1a1aa",
  grid: "#f1f1f3",
  axis: "#a1a1aa",
};

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const control = (current.x + next.x) / 2;
    path += ` C${control.toFixed(2)},${current.y.toFixed(2)} ${control.toFixed(2)},${next.y.toFixed(2)} ${next.x.toFixed(2)},${next.y.toFixed(2)}`;
  }
  return path;
}

export function RevenueChart({
  data,
  currency,
}: {
  data: ChartPoint[];
  currency: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const width = 760;
  const height = 250;
  const padding = { top: 14, right: 16, bottom: 26, left: 56 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const max = useMemo(() => {
    const values = data.flatMap((point) => [point.revenue, point.expenses, point.net, point.previousRevenue]);
    const highest = Math.max(1, ...values);
    const magnitude = Math.pow(10, Math.floor(Math.log10(highest)));
    return Math.ceil(highest / magnitude) * magnitude;
  }, [data]);

  const x = (index: number) =>
    padding.left + (data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
  const y = (value: number) => padding.top + innerHeight - (Math.max(0, value) / max) * innerHeight;

  const line = (key: "revenue" | "expenses" | "net" | "previousRevenue") =>
    smoothPath(data.map((point, index) => ({ x: x(index), y: y(point[key]) })));

  const area = `${line("revenue")} L${x(data.length - 1)},${padding.top + innerHeight} L${padding.left},${padding.top + innerHeight} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelIndexes = useMemo(() => {
    if (data.length <= 6) return data.map((_, index) => index);
    const count = data.length > 40 ? 6 : 7;
    return Array.from({ length: count }, (_, index) =>
      Math.round((index / (count - 1)) * (data.length - 1)),
    );
  }, [data]);

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || data.length === 0) return;
    const rect = container.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (data.length - 1)));
  };

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-500">
        <Legend color={COLORS.revenue} label="Revenue" />
        <Legend color={COLORS.expenses} label="Expenses" />
        <Legend color={COLORS.net} label="Net profit" />
        <Legend color={COLORS.previous} label="Previous period" dashed />
      </div>
      <div
        ref={containerRef}
        className="relative w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[250px] w-full touch-none"
          role="img"
          aria-label="Revenue, expenses and net profit over time"
        >
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.revenue} stopOpacity="0.12" />
              <stop offset="100%" stopColor={COLORS.revenue} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((tick) => {
            const value = max * tick;
            const lineY = y(value);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={lineY}
                  y2={lineY}
                  stroke={COLORS.grid}
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={lineY + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill={COLORS.axis}
                >
                  {compact(value, currency)}
                </text>
              </g>
            );
          })}
          {labelIndexes.map((index) => (
            <text
              key={index}
              x={x(index)}
              y={height - 6}
              textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
              fontSize="9"
              fill={COLORS.axis}
            >
              {data[index]?.label}
            </text>
          ))}
          <path d={area} fill="url(#revenue-fill)" />
          <path
            d={line("previousRevenue")}
            fill="none"
            stroke={COLORS.previous}
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />
          <path d={line("revenue")} fill="none" stroke={COLORS.revenue} strokeWidth="1.8" />
          <path d={line("expenses")} fill="none" stroke={COLORS.expenses} strokeWidth="1.5" />
          <path d={line("net")} fill="none" stroke={COLORS.net} strokeWidth="1.2" strokeOpacity="0.75" />
          {hover !== null && data[hover] && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={padding.top}
                y2={padding.top + innerHeight}
                stroke="#d4d4d8"
                strokeWidth="1"
              />
              <circle cx={x(hover)} cy={y(data[hover].revenue)} r="3" fill={COLORS.revenue} stroke="white" strokeWidth="1.5" />
              <circle cx={x(hover)} cy={y(data[hover].expenses)} r="3" fill={COLORS.expenses} stroke="white" strokeWidth="1.5" />
            </g>
          )}
        </svg>

        {active && hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[170px] rounded-md border border-zinc-200 bg-white p-2.5 text-[11px] shadow-lg"
            style={{
              left: `clamp(0px, calc(${(hover / Math.max(1, data.length - 1)) * 100}% - 85px), calc(100% - 180px))`,
            }}
          >
            <p className="mb-1.5 font-medium text-zinc-900">{active.label}</p>
            <TooltipRow label="Revenue" value={formatMoney(active.revenue, currency)} color={COLORS.revenue} />
            <TooltipRow label="Expenses" value={formatMoney(active.expenses, currency)} color={COLORS.expenses} />
            <TooltipRow label="Net profit" value={formatMoney(active.net, currency)} color={COLORS.net} />
            {active.previousRevenue > 0 && (
              <TooltipRow
                label="Previous period"
                value={formatMoney(active.previousRevenue, currency)}
                color={COLORS.previous}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-[2px] w-3 rounded"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          backgroundImage: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)`
            : undefined,
        }}
      />
      {label}
    </span>
  );
}

function TooltipRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <p className="flex items-center justify-between gap-3 text-zinc-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-medium text-zinc-900">{value}</span>
    </p>
  );
}

function compact(value: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
