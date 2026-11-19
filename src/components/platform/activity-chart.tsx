"use client";

import { useMemo, useRef, useState } from "react";

export type ActivitySeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
  area?: boolean;
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

export function ActivityChart({
  labels,
  series,
  height = 280,
  formatValue,
  formatAxis,
}: {
  labels: string[];
  series: ActivitySeries[];
  height?: number;
  formatValue?: (value: number) => string;
  formatAxis?: (value: number) => string;
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const visible = series.filter((entry) => !hidden[entry.key]);
  const width = 860;
  const padding = { top: 16, right: 18, bottom: 28, left: 54 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const max = useMemo(() => {
    const values = visible.flatMap((entry) => entry.values);
    const highest = Math.max(1, ...values);
    const magnitude = Math.pow(10, Math.floor(Math.log10(highest)));
    return Math.max(magnitude, Math.ceil(highest / magnitude) * magnitude);
  }, [visible]);

  const x = (index: number) =>
    padding.left + (labels.length <= 1 ? innerWidth / 2 : (index / (labels.length - 1)) * innerWidth);
  const y = (value: number) =>
    padding.top + innerHeight - (Math.max(0, value) / max) * innerHeight;

  const labelIndexes = useMemo(() => {
    if (labels.length <= 7) return Array.from({ length: labels.length }, (_, index) => index);
    const count = 7;
    return Array.from({ length: count }, (_, index) =>
      Math.round((index / (count - 1)) * (labels.length - 1)),
    );
  }, [labels.length]);

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || labels.length === 0) return;
    const rect = container.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (labels.length - 1)));
  };

  const active = hover !== null ? hover : null;
  const format = formatValue ?? ((value: number) => new Intl.NumberFormat("en-NG").format(value));
  const formatY = formatAxis ?? format;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {series.map((entry) => {
          const off = hidden[entry.key];
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() =>
                setHidden((current) => ({ ...current, [entry.key]: !current[entry.key] }))
              }
              aria-pressed={!off}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-medium transition-colors ${
                off
                  ? "border-white/[0.06] bg-transparent text-slate-500"
                  : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: off ? "#475569" : entry.color }}
              />
              {entry.label}
            </button>
          );
        })}
      </div>

      <div
        ref={containerRef}
        className="relative w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full touch-none"
          style={{ height }}
          role="img"
          aria-label="Platform activity over time"
        >
          <defs>
            {visible.map((entry) => (
              <linearGradient key={entry.key} id={`fill-${entry.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={entry.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={entry.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const value = max * tick;
            const lineY = y(value);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={lineY}
                  y2={lineY}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={lineY + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#64748b"
                >
                  {formatY(value)}
                </text>
              </g>
            );
          })}

          {labelIndexes.map((index) => (
            <text
              key={index}
              x={x(index)}
              y={height - 6}
              textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
              fontSize="9"
              fill="#64748b"
            >
              {labels[index]}
            </text>
          ))}

          {visible.map((entry) => {
            const line = smoothPath(entry.values.map((value, index) => ({ x: x(index), y: y(value) })));
            if (!entry.area) {
              return (
                <path
                  key={entry.key}
                  d={line}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            }
            const area = `${line} L${x(entry.values.length - 1)},${padding.top + innerHeight} L${padding.left},${padding.top + innerHeight} Z`;
            return (
              <g key={entry.key}>
                <path d={area} fill={`url(#fill-${entry.key})`} />
                <path
                  d={line}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {active !== null && labels[active] && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={padding.top}
                y2={padding.top + innerHeight}
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="1"
              />
              {visible.map((entry) => (
                <circle
                  key={entry.key}
                  cx={x(active)}
                  cy={y(entry.values[active] ?? 0)}
                  r="3.2"
                  fill={entry.color}
                  stroke="#0b1220"
                  strokeWidth="1.6"
                />
              ))}
            </g>
          )}
        </svg>

        {active !== null && labels[active] && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[180px] rounded-lg border border-white/10 bg-[#0b1220]/95 p-3 text-[0.7rem] shadow-xl backdrop-blur"
            style={{
              left: `clamp(0px, calc(${(active / Math.max(1, labels.length - 1)) * 100}% - 90px), calc(100% - 195px))`,
            }}
          >
            <p className="mb-2 font-medium text-slate-200">{labels[active]}</p>
            <div className="space-y-1.5">
              {visible.map((entry) => (
                <p key={entry.key} className="flex items-center justify-between gap-4 text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    {entry.label}
                  </span>
                  <span className="font-medium tabular-nums text-slate-100">
                    {format(entry.values[active] ?? 0)}
                  </span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
