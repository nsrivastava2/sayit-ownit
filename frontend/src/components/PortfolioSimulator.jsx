/**
 * Portfolio Simulator Component
 *
 * Allows users to simulate "What if I followed this expert with X capital?"
 * Shows returns, XIRR, trade log, and performance metrics.
 */

import { useState } from 'react';
import api from '../services/api';

function PortfolioSimulator({ expertId, expertName }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [showTradeLog, setShowTradeLog] = useState(false);

  // Form state
  const [capital, setCapital] = useState(100000);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [positionSizing, setPositionSizing] = useState('FIXED_AMOUNT');
  const [positionValue, setPositionValue] = useState(10000);
  const [maxPositions, setMaxPositions] = useState(10);

  async function runSimulation() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.runSimulation({
        expertId,
        initialCapital: capital,
        startDate,
        endDate,
        positionSizingMethod: positionSizing,
        positionSizeValue: positionValue,
        maxConcurrentPositions: maxPositions
      });

      setResults(response.simulation);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span>Portfolio Simulator</span>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Beta</span>
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          What if you followed {expertName}'s recommendations?
        </p>
      </div>

      <div className="p-6">
        {/* Configuration Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Capital
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rs.</span>
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(parseInt(e.target.value) || 0)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                min="1000"
                step="10000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Advanced Options */}
        <details className="mb-6">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
            Advanced Options
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position Sizing
              </label>
              <select
                value={positionSizing}
                onChange={(e) => setPositionSizing(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="FIXED_AMOUNT">Fixed Amount</option>
                <option value="EQUAL_WEIGHT">Equal Weight</option>
                <option value="PERCENTAGE">Percentage</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {positionSizing === 'PERCENTAGE' ? 'Position Size (%)' : 'Position Size (Rs.)'}
              </label>
              <input
                type="number"
                value={positionValue}
                onChange={(e) => setPositionValue(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                min={positionSizing === 'PERCENTAGE' ? 1 : 1000}
                max={positionSizing === 'PERCENTAGE' ? 100 : capital}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Concurrent Positions
              </label>
              <input
                type="number"
                value={maxPositions}
                onChange={(e) => setMaxPositions(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                min="1"
                max="50"
              />
            </div>
          </div>
        </details>

        {/* Run Button */}
        <button
          onClick={runSimulation}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin">&#8987;</span>
              Running Simulation...
            </>
          ) : (
            <>
              <span>&#9654;</span>
              Run Simulation
            </>
          )}
        </button>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="mt-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Initial Capital</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(results.initialCapital)}
                </p>
              </div>

              <div className={`rounded-lg p-4 text-center ${
                results.finalValue >= results.initialCapital
                  ? 'bg-green-50'
                  : 'bg-red-50'
              }`}>
                <p className="text-sm text-gray-500">Final Value</p>
                <p className={`text-lg font-bold ${
                  results.finalValue >= results.initialCapital
                    ? 'text-green-700'
                    : 'text-red-700'
                }`}>
                  {formatCurrency(results.finalValue)}
                </p>
              </div>

              <div className={`rounded-lg p-4 text-center ${
                results.totalReturnPct >= 0
                  ? 'bg-green-50'
                  : 'bg-red-50'
              }`}>
                <p className="text-sm text-gray-500">Total Return</p>
                <p className={`text-lg font-bold ${
                  results.totalReturnPct >= 0
                    ? 'text-green-700'
                    : 'text-red-700'
                }`}>
                  {formatPercent(results.totalReturnPct)}
                </p>
              </div>

              <div className={`rounded-lg p-4 text-center ${
                results.xirr && results.xirr >= 0
                  ? 'bg-indigo-50'
                  : results.xirr
                    ? 'bg-red-50'
                    : 'bg-gray-50'
              }`}>
                <p className="text-sm text-gray-500">XIRR (Annualized)</p>
                <p className={`text-lg font-bold ${
                  results.xirr && results.xirr >= 0
                    ? 'text-indigo-700'
                    : results.xirr
                      ? 'text-red-700'
                      : 'text-gray-500'
                }`}>
                  {results.xirr !== null ? formatPercent(results.xirr) : 'N/A'}
                </p>
              </div>
            </div>

            {/* Trade Statistics */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Trade Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{results.totalTrades}</p>
                  <p className="text-xs text-gray-500">Total Trades</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{results.winningTrades}</p>
                  <p className="text-xs text-gray-500">Winners</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{results.losingTrades}</p>
                  <p className="text-xs text-gray-500">Losers</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{results.activeTrades}</p>
                  <p className="text-xs text-gray-500">Active</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-indigo-600">
                    {results.winRate !== null ? `${results.winRate}%` : '-'}
                  </p>
                  <p className="text-xs text-gray-500">Win Rate</p>
                </div>
              </div>
            </div>

            {/* Active Positions */}
            {results.activePositions && results.activePositions.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <h3 className="font-medium text-yellow-800 mb-3 flex items-center gap-2">
                  <span>&#128200;</span>
                  Active Positions ({results.activePositions.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-yellow-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-yellow-800">Symbol</th>
                        <th className="px-3 py-2 text-right text-yellow-800">Shares</th>
                        <th className="px-3 py-2 text-left text-yellow-800">Entry Date</th>
                        <th className="px-3 py-2 text-right text-yellow-800">Entry Price</th>
                        <th className="px-3 py-2 text-right text-yellow-800">Current Price</th>
                        <th className="px-3 py-2 text-right text-yellow-800">Current Value</th>
                        <th className="px-3 py-2 text-right text-yellow-800">Unrealized P&L</th>
                        <th className="px-3 py-2 text-right text-yellow-800">Return</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-yellow-200">
                      {results.activePositions.map((pos, idx) => (
                        <tr key={idx} className="hover:bg-yellow-100">
                          <td className="px-3 py-2 font-medium text-gray-900">{pos.symbol}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{pos.shares}</td>
                          <td className="px-3 py-2 text-gray-600">{pos.entryDate}</td>
                          <td className="px-3 py-2 text-right text-gray-700">₹{pos.entryPrice}</td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            ₹{pos.currentPrice}
                            {pos.priceDate && (
                              <span className="text-xs text-gray-400 block">
                                as of {new Date(pos.priceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">
                            {formatCurrency(pos.currentValue)}
                          </td>
                          <td className={`px-3 py-2 text-right font-medium ${
                            pos.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {pos.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(pos.unrealizedPnL)}
                          </td>
                          <td className={`px-3 py-2 text-right font-medium ${
                            pos.unrealizedReturnPct >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatPercent(pos.unrealizedReturnPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-yellow-600 mt-2">
                  * These positions are still open. Current prices are from the latest available market data.
                </p>
              </div>
            )}

            {/* Trade Log Toggle */}
            {results.tradeLog && results.tradeLog.length > 0 && (
              <div>
                <button
                  onClick={() => setShowTradeLog(!showTradeLog)}
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
                >
                  <span>{showTradeLog ? '&#9660;' : '&#9654;'}</span>
                  {showTradeLog ? 'Hide' : 'Show'} Trade Log ({results.tradeLog.length} trades)
                </button>

                {showTradeLog && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left">Symbol</th>
                          <th className="px-3 py-2 text-left">Action</th>
                          <th className="px-3 py-2 text-left">Entry</th>
                          <th className="px-3 py-2 text-left">Exit</th>
                          <th className="px-3 py-2 text-right">Entry Price</th>
                          <th className="px-3 py-2 text-right">Exit Price</th>
                          <th className="px-3 py-2 text-right">P&L</th>
                          <th className="px-3 py-2 text-right">Return</th>
                          <th className="px-3 py-2 text-center">Outcome</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {results.tradeLog.map((trade, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{trade.symbol}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                trade.action === 'BUY'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {trade.action}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{trade.entryDate}</td>
                            <td className="px-3 py-2 text-gray-600">{trade.exitDate || '-'}</td>
                            <td className="px-3 py-2 text-right">Rs.{trade.entryPrice}</td>
                            <td className="px-3 py-2 text-right">
                              {trade.exitPrice ? `Rs.${trade.exitPrice}` : '-'}
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${
                              trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {trade.pnl >= 0 ? '+' : ''}Rs.{trade.pnl}
                            </td>
                            <td className={`px-3 py-2 text-right ${
                              trade.returnPct >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatPercent(trade.returnPct)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                trade.outcome === 'TARGET_HIT'
                                  ? 'bg-green-100 text-green-700'
                                  : trade.outcome === 'SL_HIT'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-600'
                              }`}>
                                {trade.outcome?.replace('_', ' ') || 'ACTIVE'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* No Trades Message */}
            {results.totalTrades === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No completed trades found in the selected date range.</p>
                <p className="text-sm mt-1">Try adjusting the date range or check if recommendations have outcomes.</p>
              </div>
            )}

            {/* Disclaimer */}
            <div className="text-xs text-gray-400 text-center">
              * This simulation is for educational purposes only. Past performance does not guarantee future results.
              Actual trading involves additional costs and risks not reflected here.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PortfolioSimulator;
