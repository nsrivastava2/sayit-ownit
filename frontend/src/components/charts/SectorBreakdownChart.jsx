import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#A4DE6C',
  '#D0ED57', '#FAD000', '#F66D44', '#FEAE65', '#E6F69D'
];

function SectorBreakdownChart({ sectors = [], loading = false }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!sectors || sectors.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        No sector data available
      </div>
    );
  }

  // Prepare data for pie chart - top 8 sectors, rest as "Others"
  const topSectors = sectors.slice(0, 8);
  const otherSectors = sectors.slice(8);

  let chartData = topSectors.map(s => ({
    name: s.sector,
    value: parseInt(s.total_recommendations),
    wins: parseInt(s.wins || 0),
    losses: parseInt(s.losses || 0),
    winRate: s.win_rate ? parseFloat(s.win_rate) : null
  }));

  if (otherSectors.length > 0) {
    const otherTotal = otherSectors.reduce((sum, s) => sum + parseInt(s.total_recommendations), 0);
    const otherWins = otherSectors.reduce((sum, s) => sum + parseInt(s.wins || 0), 0);
    const otherLosses = otherSectors.reduce((sum, s) => sum + parseInt(s.losses || 0), 0);
    chartData.push({
      name: 'Others',
      value: otherTotal,
      wins: otherWins,
      losses: otherLosses,
      winRate: (otherWins + otherLosses) > 0 ? Math.round(otherWins * 100 / (otherWins + otherLosses)) : null
    });
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-gray-600">{data.value} recommendations</p>
          {data.winRate !== null && (
            <p className={data.winRate >= 50 ? 'text-green-600' : 'text-red-600'}>
              {data.winRate}% win rate ({data.wins}W / {data.losses}L)
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={false}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default SectorBreakdownChart;
