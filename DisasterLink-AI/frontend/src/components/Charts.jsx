import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export const PALETTE = ['#2563eb', '#06b6d4', '#1e3a6e', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#64748b']
const axis = { fontSize: 11, fill: '#64748b' }
const tip = { contentStyle: { borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(16,24,40,.08)' } }

export function Bars({ data, x, bars, height = 240, horizontal, stacked, colors }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: horizontal ? 8 : -12, bottom: 0 }}>
        <CartesianGrid stroke="#f1f5f9" vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? <><XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} /><YAxis type="category" dataKey={x} tick={axis} width={100} axisLine={false} tickLine={false} /></>
          : <><XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} interval={0} /><YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} /></>}
        <Tooltip {...tip} cursor={{ fill: '#f8fafc' }} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name || b.key} stackId={stacked ? 's' : undefined} fill={b.color || (colors ? undefined : PALETTE[i])}
            radius={stacked ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36}>
            {colors && data.map((d, j) => <Cell key={j} fill={colors(d, j)} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Donut({ data, nameKey, valueKey, height = 220, colors }) {
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0)
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="none">
            {data.map((d, i) => <Cell key={i} fill={colors ? colors(d, i) : PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-0 bottom-[36px] flex flex-col items-center justify-center">
        <span className="text-xl font-semibold text-navy-800">{total}</span><span className="text-[11px] text-slate-500">total</span>
      </div>
    </div>
  )
}

export function Timeline({ data, x, areas, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <defs>{areas.map((a, i) => (
          <linearGradient key={a.key} id={`g-${a.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={a.color || PALETTE[i]} stopOpacity={0.25} /><stop offset="100%" stopColor={a.color || PALETTE[i]} stopOpacity={0} />
          </linearGradient>))}
        </defs>
        <CartesianGrid stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        {areas.map((a, i) => <Area key={a.key} type="monotone" dataKey={a.key} name={a.name} stroke={a.color || PALETTE[i]} strokeWidth={2} fill={`url(#g-${a.key})`} />)}
      </AreaChart>
    </ResponsiveContainer>
  )
}
