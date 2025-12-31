/**
 * OutcomeBadge Component
 * Displays recommendation outcome status with color coding
 */

const outcomeStyles = {
  TARGET_HIT: 'bg-green-100 text-green-800 border-green-200',
  SL_HIT: 'bg-red-100 text-red-800 border-red-200',
  EXPIRED: 'bg-gray-100 text-gray-600 border-gray-200',
  ACTIVE: 'bg-blue-100 text-blue-800 border-blue-200'
};

const outcomeLabels = {
  TARGET_HIT: 'Target Hit',
  SL_HIT: 'SL Hit',
  EXPIRED: 'Expired',
  ACTIVE: 'Active'
};

const outcomeIcons = {
  TARGET_HIT: '✓',
  SL_HIT: '✗',
  EXPIRED: '⏱',
  ACTIVE: '●'
};

function OutcomeBadge({ outcome, status, returnPct, showReturn = true }) {
  // Determine display type from outcome or status
  const outcomeType = outcome?.outcome_type || (status === 'CLOSED' ? null : 'ACTIVE');

  if (!outcomeType) return null;

  const style = outcomeStyles[outcomeType] || outcomeStyles.ACTIVE;
  const label = outcomeLabels[outcomeType] || outcomeType;
  const icon = outcomeIcons[outcomeType];

  // Format return percentage
  const returnDisplay = returnPct !== undefined && returnPct !== null
    ? `${parseFloat(returnPct) >= 0 ? '+' : ''}${parseFloat(returnPct).toFixed(1)}%`
    : null;

  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${style}`}>
        <span className="mr-1">{icon}</span>
        {label}
      </span>
      {showReturn && returnDisplay && outcomeType !== 'ACTIVE' && (
        <span className={`text-xs font-medium ${parseFloat(returnPct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {returnDisplay}
        </span>
      )}
    </div>
  );
}

export default OutcomeBadge;
