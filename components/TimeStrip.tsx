// The signature element (brief file 03 §5): makes "is this test still good"
// visible. Drawn, not charted — a thin axis, a sand band for the window a
// test counts in, and a dot per checkout test.

"use client";

import { formatEtWeekdayTime } from "@/lib/format/time";
import styles from "./TimeStrip.module.css";

export interface TimeStripDot {
  label: string; // "Sl", "Sa", "P"
  time: string; // ISO
  usable: boolean;
  faded?: boolean; // the replaced test, once a new one has landed
}

export interface TimeStripProps {
  saleStart: string;
  emailSend: string;
  now: string;
  bandStart: string;
  bandEnd: string;
  dots: TimeStripDot[];
  bracket?: { from: string; to: string; label: string };
}

function minutesSince(iso: string, anchor: string): number {
  return (new Date(iso).getTime() - new Date(anchor).getTime()) / 60000;
}

const VIEW_WIDTH = 760;
const VIEW_HEIGHT = 108;
const AXIS_Y = 56;
const MARGIN_X = 24;

export default function TimeStrip({
  saleStart,
  emailSend,
  now,
  bandStart,
  bandEnd,
  dots,
  bracket,
}: TimeStripProps) {
  // Anchor the axis half an hour either side of the action, rounded to a
  // clean 10-minute tick, matching the brief's own 8:30–9:30 example.
  const anchor = saleStart;
  const allTimes = [saleStart, emailSend, now, bandStart, bandEnd, ...dots.map((d) => d.time)];
  if (bracket) allTimes.push(bracket.from, bracket.to);
  const minTime = Math.min(...allTimes.map((t) => minutesSince(t, anchor)));
  const maxTime = Math.max(...allTimes.map((t) => minutesSince(t, anchor)));

  const axisStart = Math.floor((minTime - 10) / 10) * 10;
  const axisEnd = Math.ceil((maxTime + 10) / 10) * 10;
  const usableWidth = VIEW_WIDTH - MARGIN_X * 2;

  const xFor = (iso: string) => {
    const m = minutesSince(iso, anchor);
    return MARGIN_X + ((m - axisStart) / (axisEnd - axisStart)) * usableWidth;
  };

  const ticks: number[] = [];
  for (let m = axisStart; m <= axisEnd; m += 10) ticks.push(m);

  const bandX1 = xFor(bandStart);
  const bandX2 = xFor(bandEnd);

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className={styles.svg} role="img" aria-hidden="true">
        {/* the "still counts" band */}
        <rect x={bandX1} y={AXIS_Y - 14} width={bandX2 - bandX1} height="28" fill="var(--sand)" opacity="0.35" />

        {/* axis ticks */}
        {ticks.map((m) => {
          const iso = new Date(new Date(anchor).getTime() + m * 60000).toISOString();
          const x = xFor(iso);
          return (
            <g key={m}>
              <line x1={x} y1={AXIS_Y - 4} x2={x} y2={AXIS_Y + 4} stroke="var(--line)" strokeWidth="1" />
              <text x={x} y={AXIS_Y + 22} textAnchor="middle" className={styles.tickLabel}>
                {formatEtWeekdayTime(iso).split(" ").slice(1).join(" ")}
              </text>
            </g>
          );
        })}

        {/* axis line */}
        <line x1={MARGIN_X} y1={AXIS_Y} x2={VIEW_WIDTH - MARGIN_X} y2={AXIS_Y} stroke="var(--line)" strokeWidth="1" />

        {/* sale start */}
        <line x1={xFor(saleStart)} y1={AXIS_Y - 20} x2={xFor(saleStart)} y2={AXIS_Y + 6} stroke="var(--slate)" strokeWidth="1.5" />
        <text x={xFor(saleStart)} y={AXIS_Y - 26} textAnchor="middle" className={styles.markerLabel}>
          Code goes live
        </text>

        {/* email send */}
        <line x1={xFor(emailSend)} y1={AXIS_Y - 20} x2={xFor(emailSend)} y2={AXIS_Y + 6} stroke="var(--slate-soft)" strokeWidth="1.5" strokeDasharray="2 2" />
        <text x={xFor(emailSend)} y={AXIS_Y - 26} textAnchor="middle" className={styles.markerLabel}>
          Email goes out
        </text>

        {/* now */}
        <line x1={xFor(now)} y1={AXIS_Y - 20} x2={xFor(now)} y2={AXIS_Y + 6} stroke="var(--ink)" strokeWidth="1.5" />
        <text x={xFor(now)} y={AXIS_Y + 44} textAnchor="middle" className={styles.markerLabel}>
          Now
        </text>

        {/* short-on-time bracket */}
        {bracket && (
          <g>
            <line x1={xFor(bracket.from)} y1={AXIS_Y + 14} x2={xFor(bracket.to)} y2={AXIS_Y + 14} stroke="var(--donotsend-fg)" strokeWidth="1.5" />
            <line x1={xFor(bracket.from)} y1={AXIS_Y + 10} x2={xFor(bracket.from)} y2={AXIS_Y + 18} stroke="var(--donotsend-fg)" strokeWidth="1.5" />
            <line x1={xFor(bracket.to)} y1={AXIS_Y + 10} x2={xFor(bracket.to)} y2={AXIS_Y + 18} stroke="var(--donotsend-fg)" strokeWidth="1.5" />
            <text x={(xFor(bracket.from) + xFor(bracket.to)) / 2} y={AXIS_Y + 34} textAnchor="middle" className={styles.bracketLabel}>
              {bracket.label}
            </text>
          </g>
        )}

        {/* checkout test dots */}
        {dots.map((dot, i) => {
          const x = xFor(dot.time);
          const y = AXIS_Y;
          return (
            <g key={i} opacity={dot.faded ? 0.4 : 1}>
              <circle
                cx={x}
                cy={y}
                r="10"
                fill={dot.usable ? "var(--slate)" : "var(--card)"}
                stroke={dot.usable ? "var(--slate)" : "var(--donotsend-fg)"}
                strokeWidth="1.5"
              />
              <text
                x={x}
                y={y + 3.5}
                textAnchor="middle"
                className={styles.dotLabel}
                fill={dot.usable ? "var(--card)" : "var(--donotsend-fg)"}
              >
                {dot.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* plain-text equivalent for screen readers (file 02 §10) */}
      <p className="visually-hidden">
        Code goes live {formatEtWeekdayTime(saleStart)}. Email goes out {formatEtWeekdayTime(emailSend)}. Now{" "}
        {formatEtWeekdayTime(now)}.{" "}
        {dots
          .map((d) => `${d.label} test taken ${formatEtWeekdayTime(d.time)}, ${d.usable ? "still good" : "not usable"}`)
          .join(". ")}
      </p>
    </div>
  );
}
