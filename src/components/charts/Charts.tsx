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
import { moneyCompact } from '@/lib/format';

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

export function SalesBarChart({
  data,
  height = 300,
}: {
  data: { label: string; current: number; prior: number }[];
  height?: number;
}) {
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

export function CoverageLineChart({
  data,
  height = 260,
}: {
  data: { date: string; coverage_pct: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: LINE }} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${(v as number).toFixed(1)}%`} />
        <Line
          type="monotone"
          dataKey="coverage_pct"
          name="Coverage %"
          stroke={SUCCESS}
          strokeWidth={2.5}
          dot={{ r: 3, fill: YELLOW }}
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
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
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
