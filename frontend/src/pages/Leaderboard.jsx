import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    try {
      setLoading(true);
      const data = await api.getLeaderboard(50);
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Format percentage for display
  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
  };

  // Get color classes for win rate
  const getWinRateColor = (winRate) => {
    if (winRate === null || winRate === undefined) return 'text-gray-600';
    const rate = parseFloat(winRate);
    if (rate >= 70) return 'text-green-600';
    if (rate >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get color for return percentage
  const getReturnColor = (returnPct) => {
    if (returnPct === null || returnPct === undefined) return 'text-gray-600';
    const ret = parseFloat(returnPct);
    if (ret > 0) return 'text-green-600';
    if (ret < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // Get medal emoji for top 3
  const getMedal = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expert Leaderboard</h1>
          <p className="text-gray-500 mt-1">
            Rankings based on win rate, returns, and recommendation volume
          </p>
        </div>
      </div>

      {/* Leaderboard explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">How Rankings Work</h3>
        <p className="text-sm text-blue-700">
          Experts are ranked using a composite score: <strong>50% Win Rate</strong> (targets hit vs total closed),
          <strong> 30% Avg Return</strong> (normalized return percentage), and
          <strong> 20% Volume Credibility</strong> (more recommendations = higher credibility).
        </p>
      </div>

      {/* Leaderboard table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {leaderboard.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg">No expert metrics available yet</p>
            <p className="text-sm mt-2">Metrics are calculated after recommendations are tracked and outcomes are detected.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expert</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Recommendations</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Closed</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Target Hits</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">SL Hits</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avg Return</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderboard.map((expert) => (
                  <tr key={expert.expert_name} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-center">
                      <span className="text-lg">
                        {getMedal(expert.rank_position) || (
                          <span className="text-gray-600 font-medium">#{expert.rank_position}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        to={`/experts/${encodeURIComponent(expert.expert_name)}`}
                        className="font-medium text-primary-600 hover:text-primary-800"
                      >
                        {expert.expert_name}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-center text-gray-900 font-medium">
                      {expert.total_recommendations}
                    </td>
                    <td className="px-4 py-4 text-center text-gray-600">
                      {expert.closed_recommendations}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-green-600 font-medium">{expert.target_hit_count}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-red-600 font-medium">{expert.sl_hit_count}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`font-semibold ${getWinRateColor(expert.overall_win_rate)}`}>
                        {expert.overall_win_rate ? `${parseFloat(expert.overall_win_rate).toFixed(1)}%` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`font-medium ${getReturnColor(expert.avg_return_pct)}`}>
                        {formatPercent(expert.avg_return_pct)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {parseFloat(expert.ranking_score).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Note about data */}
      {leaderboard.length > 0 && (
        <p className="text-sm text-gray-500 text-center">
          Last updated: {new Date(leaderboard[0].calculation_date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </p>
      )}
    </div>
  );
}

export default Leaderboard;
