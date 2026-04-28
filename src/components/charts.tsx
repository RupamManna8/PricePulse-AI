import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function axisStyle() {
  return { fill: '#94A3B8', fontSize: 11 };
}

const tooltipStyle = {
  background: 'rgba(9, 11, 15, 0.96)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  color: '#F8FAFC'
};

export function PriceHistoryChart({ data }: { data: Array<{ day: string; competitor: number; yourStore: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="competitorFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#5B8CFF" stopOpacity={0.32} />
            <stop offset="95%" stopColor="#5B8CFF" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="yourFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#17C964" stopOpacity={0.26} />
            <stop offset="95%" stopColor="#17C964" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="day" tick={axisStyle()} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle()} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="competitor" stroke="#5B8CFF" fill="url(#competitorFill)" strokeWidth={2} />
        <Area type="monotone" dataKey="yourStore" stroke="#17C964" fill="url(#yourFill)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SentimentPieChart({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={72} outerRadius={108} paddingAngle={4}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CompetitorComparisonChart({ data }: { data: Array<{ name: string; price: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={axisStyle()} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle()} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="price" radius={[12, 12, 0, 0]} fill="#5B8CFF" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RatingTrendChart({ data }: { data: Array<{ week: string; rating: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="week" tick={axisStyle()} axisLine={false} tickLine={false} />
        <YAxis domain={[3.5, 5]} tick={axisStyle()} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="rating" stroke="#F5A524" strokeWidth={2.5} dot={{ r: 4, fill: '#F5A524' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CompactSeriesChart({ data, xKey, yKey, stroke = '#5B8CFF' }: { data: Array<Record<string, string | number>>; xKey: string; yKey: string; stroke?: string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data as Array<Record<string, string | number | undefined>>}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey={xKey} tick={axisStyle()} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle()} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey={yKey} stroke={stroke} strokeWidth={2.5} dot={{ r: 3, fill: stroke }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
