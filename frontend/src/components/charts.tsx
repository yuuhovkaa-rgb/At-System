import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { STATUS_COLORS } from '@/utils/format';
import { Counts } from '@/types';

const axis = { fontSize: 12, fill: '#94a3b8' };
const tip = { contentStyle: { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 } };

export function StatusPie({ counts }: { counts: Counts }) {
  const { t } = useTranslation();
  const data = (['present', 'late', 'absent', 'excused'] as const).map((k) => ({ name: t(`status.${k.toUpperCase()}`), value: counts[k], color: STATUS_COLORS[k.toUpperCase() as keyof typeof STATUS_COLORS] })).filter((d) => d.value > 0);
  if (!data.length) return <p className="py-10 text-center text-sm text-slate-400">{t('common.noData')}</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>{data.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart>
    </ResponsiveContainer>
  );
}

/** Stacked daily/monthly status counts. */
export function StackedTrend({ data, xKey }: { data: any[]; xKey: string }) {
  const { t } = useTranslation();
  if (!data.length) return <p className="py-10 text-center text-sm text-slate-400">{t('common.noData')}</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f044" /><XAxis dataKey={xKey} tick={axis} tickFormatter={(v) => String(v).slice(5)} /><YAxis tick={axis} allowDecimals={false} /><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="present" stackId="a" name={t('status.PRESENT')} fill={STATUS_COLORS.PRESENT} /><Bar dataKey="late" stackId="a" name={t('status.LATE')} fill={STATUS_COLORS.LATE} />
        <Bar dataKey="excused" stackId="a" name={t('status.EXCUSED')} fill={STATUS_COLORS.EXCUSED} /><Bar dataKey="absent" stackId="a" name={t('status.ABSENT')} fill={STATUS_COLORS.ABSENT} radius={[3, 3, 0, 0]} /></BarChart>
    </ResponsiveContainer>
  );
}

export function PercentLine({ data, xKey }: { data: any[]; xKey: string }) {
  const { t } = useTranslation();
  if (!data.length) return <p className="py-10 text-center text-sm text-slate-400">{t('common.noData')}</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f044" /><XAxis dataKey={xKey} tick={axis} /><YAxis domain={[0, 100]} tick={axis} unit="%" /><Tooltip {...tip} formatter={(v: number) => `${v}%`} />
        <Line type="monotone" dataKey="percentage" name={t('common.percentage')} stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart>
    </ResponsiveContainer>
  );
}

export function HBars({ data, nameKey, valueKey, color = '#2563eb', unit }: { data: any[]; nameKey: string; valueKey: string; color?: string; unit?: string }) {
  const { t } = useTranslation();
  if (!data.length) return <p className="py-10 text-center text-sm text-slate-400">{t('common.noData')}</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ left: 16 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f044" horizontal={false} /><XAxis type="number" tick={axis} unit={unit} allowDecimals={false} /><YAxis type="category" dataKey={nameKey} tick={axis} width={130} /><Tooltip {...tip} />
        <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} /></BarChart>
    </ResponsiveContainer>
  );
}
