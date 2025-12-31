import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

function ExpertView() {
  const { name } = useParams();
  const [expert, setExpert] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadExpert();
  }, [name]);

  async function loadExpert() {
    try {
      setLoading(true);
      const data = await api.getExpert(name);
      setExpert(data.expert);
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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

  const actionColors = {
    BUY: 'bg-green-100 text-green-800',
    SELL: 'bg-red-100 text-red-800',
    HOLD: 'bg-yellow-100 text-yellow-800'
  };

  // Format timestamp as MM:SS or HH:MM:SS
  const formatTimestamp = (seconds) => {
    if (!seconds && seconds !== 0) return null;
    const secs = parseInt(seconds);
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/recommendations"
        className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
      >
        ← Back to Recommendations
      </Link>

      {/* Expert header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xl mr-4">
                {name.charAt(0)}
              </span>
              {name}
            </h1>
            <p className="text-gray-500 mt-2">Stock Market Analyst</p>
          </div>
        </div>

        {/* Stats */}
        {expert?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-500">Total Recommendations</p>
              <p className="text-2xl font-bold text-gray-900">{expert.stats.totalRecommendations}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">BUY Calls</p>
              <p className="text-2xl font-bold text-green-600">{expert.stats.buyCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">SELL Calls</p>
              <p className="text-2xl font-bold text-red-600">{expert.stats.sellCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">HOLD Calls</p>
              <p className="text-2xl font-bold text-yellow-600">{expert.stats.holdCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg. Confidence</p>
              <p className="text-2xl font-bold text-gray-900">{(expert.stats.avgConfidence * 100).toFixed(0)}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Recommendations</h2>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No recommendations found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stop Loss</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recommendations.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{rec.recommendation_date}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/shares/${encodeURIComponent(rec.nse_symbol || rec.share_name)}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-800"
                      >
                        {rec.share_name}
                        {rec.nse_symbol && (
                          <span className="text-xs text-gray-500 ml-1">({rec.nse_symbol})</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${actionColors[rec.action]}`}>
                        {rec.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rec.recommended_price ? `₹${rec.recommended_price}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rec.target_price ? `₹${rec.target_price}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rec.stop_loss ? `₹${rec.stop_loss}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={rec.reason}>
                      {rec.reason || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {rec.videos?.youtube_url ? (
                        <a
                          href={`${rec.videos.youtube_url}${rec.videos.youtube_url.includes('?') ? '&' : '?'}t=${rec.timestamp_in_video || 0}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-800 flex items-center whitespace-nowrap"
                          title={rec.videos.title}
                        >
                          <span className="mr-1">▶</span>
                          {formatTimestamp(rec.timestamp_in_video)}
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExpertView;
