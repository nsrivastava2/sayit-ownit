import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

function MonthlyReturnsChart({ monthlyReturns = [], loading = false }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!monthlyReturns || monthlyReturns.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        No monthly return data available yet
      </div>
    );
  }

  // Format month labels (YYYY-MM -> MMM 'YY)
  const chartData = monthlyReturns.map(m => ({
    month: formatMonth(m.month),
    avgReturn: parseFloat(m.avg_return) || 0,
    totalReturn: parseFloat(m.total_return) || 0,
    wins: parseInt(m.wins) || 0,
    losses: parseInt(m.losses) || 0,
    total: parseInt(m.total_closed) || 0
  }));

  function formatMonth(monthStr) {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold text-gray-900">{label}</p>
          <p className={data.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
            Avg Return: {data.avgReturn >= 0 ? '+' : ''}{data.avgReturn.toFixed(2)}%
          </p>
          <p className="text-gray-600">
            {data.wins}W / {data.losses}L ({data.total} closed)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" />
        <Bar dataKey="avgReturn" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.avgReturn >= 0 ? '#10B981' : '#EF4444'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default MonthlyReturnsChart;
