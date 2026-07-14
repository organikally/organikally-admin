import type { ReactNode } from 'react';
import { LineChart as LineChartIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dateShort, moneyCompact, num } from '@/lib/format';

// Brand series palette (spec §4): oil-gold primary, warm-desaturated semantics.
const YELLOW = '#F0B61A';
const SUCCESS = '#1B5E20';
const INFO = '#2C7A7B';
const DANGER = '#9B2C2C';
const INK_FAINT = '#7A7262';
const GRID = '#EBE7DD';
const LINE = '#E6E0D3';

const PALETTE = [YELLOW, SUCCESS, INFO, INK_FAINT, DANGER];
const AXIS = { fontSize: 11, fill: INK_FAINT, fontVariantNumeric: 'tabular-nums' as const };

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${LINE}`,
  fontSize: 12,
  background: '#FAF9F5',
  boxShadow: '0 8px 24px -10px rgba(31,27,18,.14)',
  color: '#1C1912',
};

// An empty series is a real state, not a failure: a brand-new territory has no
// visits yet. Say so, at the chart's own height, instead of drawing an axis box
// around nothing (which reads as broken) or a zero line (which reads as a fact).
export function ChartEmpty({
  height = 260,
  title,
  hint,
  icon,
}: {
  height?: number;
  title: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-line px-6 text-center"
      style={{ height }}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-ink-faint">
        {icon ?? <LineChartIcon className="h-5 w-5" strokeWidth={1.5} />}
      </span>
      <div className="text-sm font-medium text-ink">{title}</div>
      {hint && <p className="max-w-[34ch] text-xs leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}

// "2026-07-04" -> "04". Keeps a month-to-date axis legible without crowding;
// the tooltip carries the full date.
function dayTick(iso: string): string {
  const day = iso?.slice(8, 10);
  return day || iso;
}

// Recharts injects these props into the element passed to <Tooltip content>.
interface TipProps<T> {
  active?: boolean;
  label?: string | number;
  payload?: { payload: T }[];
}

function TipShell({ date, children }: { date?: string | number; children: ReactNode }) {
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <div className="mb-0.5 text-[11px] font-semibold text-ink">
        {dateShort(typeof date === 'string' ? date : undefined)}
      </div>
      {children}
    </div>
  );
}

function CoverageTip({ active, payload, label }: TipProps<CoveragePointLike>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TipShell date={label}>
      <div className="tnum text-xs text-ink">{p.coverage_pct.toFixed(1)}% coverage</div>
      <div className="tnum text-[11px] text-ink-faint">
        {num(p.visited)} of {num(p.active_outlets)} outlets visited
      </div>
    </TipShell>
  );
}

function StrikeRateTip({ active, payload, label }: TipProps<StrikeRatePointLike>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TipShell date={label}>
      <div className="tnum text-xs text-ink">{p.strike_rate_pct.toFixed(1)}% strike rate</div>
      <div className="tnum text-[11px] text-ink-faint">
        {num(p.productive)} of {num(p.visits)} visits productive
      </div>
    </TipShell>
  );
}

interface CoveragePointLike {
  date: string;
  visited: number;
  active_outlets: number;
  coverage_pct: number;
}

interface StrikeRatePointLike {
  date: string;
  visits: number;
  productive: number;
  strike_rate_pct: number;
}

export function SalesBarChart({
  data,
  height = 300,
}: {
  data: { label: string; current: number; prior: number }[];
  height?: number;
}) {
  if (data.length === 0)
    return (
      <ChartEmpty
        height={height}
        title="No booked orders in this range"
        hint="Sales appear here as reps submit orders."
      />
    );
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: LINE }} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => moneyCompact(v as number)}
          width={64}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(31,27,18,0.04)' }} formatter={(v) => moneyCompact(v as number)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="prior" name="Prior period" fill={INK_FAINT} fillOpacity={0.4} radius={[4, 4, 0, 0]} />
        <Bar dataKey="current" name="Current" fill={YELLOW} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Month-to-date coverage trend. `coverage_pct` is cumulative, so the line climbs
// through the month; the dots stay small because a full month is 31 points.
export function CoverageLineChart({
  data,
  height = 260,
  emptyTitle = 'No visits yet this month',
  emptyHint = 'Coverage plots distinct outlets visited against active outlets. The trend starts as soon as reps check in.',
}: {
  data: CoveragePointLike[];
  height?: number;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  if (data.length === 0) return <ChartEmpty height={height} title={emptyTitle} hint={emptyHint} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: LINE }}
          tickFormatter={(v) => dayTick(v as string)}
          minTickGap={16}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CoverageTip />} cursor={{ stroke: LINE }} />
        <Line
          type="monotone"
          dataKey="coverage_pct"
          name="Coverage %"
          stroke={SUCCESS}
          strokeWidth={2.5}
          dot={data.length <= 14 ? { r: 3, fill: YELLOW } : false}
          activeDot={{ r: 4, fill: YELLOW, stroke: SUCCESS }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Daily strike rate (orders / visits that day). Not cumulative, so it moves both
// ways; a gap-free month-to-date axis keeps zero-visit days visible as zeroes.
export function StrikeRateLineChart({
  data,
  height = 260,
  emptyTitle = 'No visits yet this month',
  emptyHint = 'Strike rate is the share of visits that convert to an order. It appears once the first visit is logged.',
}: {
  data: StrikeRatePointLike[];
  height?: number;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  if (data.length === 0) return <ChartEmpty height={height} title={emptyTitle} hint={emptyHint} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: LINE }}
          tickFormatter={(v) => dayTick(v as string)}
          minTickGap={16}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<StrikeRateTip />} cursor={{ stroke: LINE }} />
        <Line
          type="monotone"
          dataKey="strike_rate_pct"
          name="Strike rate %"
          stroke={INFO}
          strokeWidth={2.5}
          dot={data.length <= 14 ? { r: 3, fill: YELLOW } : false}
          activeDot={{ r: 4, fill: YELLOW, stroke: INFO }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AgingPie({
  data,
  height = 240,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={56}
          outerRadius={88}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={[INFO, YELLOW, DANGER][i % 3]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => moneyCompact(v as number)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SimpleBar({
  data,
  color = YELLOW,
  height = 280,
  valueFormatter,
  emptyTitle = 'Nothing to plot yet',
  emptyHint,
  domain,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
  emptyTitle?: string;
  emptyHint?: string;
  domain?: [number, number];
}) {
  if (data.length === 0)
    return <ChartEmpty height={height} title={emptyTitle} hint={emptyHint} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          domain={domain}
          tickFormatter={valueFormatter ? (v) => valueFormatter(v as number) : undefined}
        />
        <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={120} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => (valueFormatter ? valueFormatter(v as number) : v)}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? color : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export { PALETTE };
