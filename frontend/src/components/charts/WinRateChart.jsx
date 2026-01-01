import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function WinRateChart({ history = [], loading = false }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        <div className="text-center">
          <p>Performance tracking started recently</p>
          <p className="text-xs mt-1">Historical data will appear as metrics are calculated daily</p>
        </div>
      </div>
    );
  }

  // Format data for chart
  const chartData = history.map(h => ({
    date: formatDate(h.calculation_date),
    winRate: parseFloat(h.overall_win_rate) || 0,
    avgReturn: parseFloat(h.avg_return_pct) || 0,
    rank: h.rank_position,
    closed: h.closed_recommendations
  }));

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold text-gray-900">{label}</p>
          <p className={data.winRate >= 50 ? 'text-green-600' : 'text-red-600'}>
            Win Rate: {data.winRate.toFixed(1)}%
          </p>
          <p className={data.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
            Avg Return: {data.avgReturn >= 0 ? '+' : ''}{data.avgReturn.toFixed(2)}%
          </p>
          {data.rank && <p className="text-gray-600">Rank: #{data.rank}</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={50} stroke="#9CA3AF" strokeDasharray="3 3" label={{ value: '50%', position: 'right', fontSize: 10, fill: '#9CA3AF' }} />
        <Line
          type="monotone"
          dataKey="winRate"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={{ r: 3, fill: '#3B82F6' }}
          activeDot={{ r: 5, fill: '#3B82F6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default WinRateChart;
