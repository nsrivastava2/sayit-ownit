import { useState } from 'react';

// Human-readable messages for flag reasons
const FLAG_MESSAGES = {
  ILLOGICAL_SL_BUY: 'Stop loss is above entry price for a BUY recommendation',
  ILLOGICAL_SL_SELL: 'Stop loss is below entry price for a SELL recommendation',
  MISSING_ENTRY: 'Entry price is missing',
  MISSING_TARGET: 'Target price is missing',
  MISSING_SL: 'Stop loss is missing',
  HIGH_RISK_RATIO: 'Risk is more than 2x the potential reward',
  SL_EQUALS_ENTRY: 'Stop loss equals entry price',
  TARGET_WRONG_DIRECTION: 'Target price is in the wrong direction for this action'
};

/**
 * FlagIndicator - Shows a warning flag for recommendations with validation issues
 * On hover/click shows details about what might be wrong
 */
function FlagIndicator({ isFlagged, flagReasons }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isFlagged || !flagReasons || flagReasons.length === 0) {
    return null;
  }

  const messages = flagReasons.map(reason =>
    FLAG_MESSAGES[reason] || reason.replace(/_/g, ' ')
  );

  return (
    <div className="relative inline-block">
      <button
        className="text-amber-500 hover:text-amber-600 cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        title="This recommendation has potential issues - click for details"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path
            fillRule="evenodd"
            d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.77l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64">
          <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
            <div className="font-semibold mb-2 text-amber-400">
              Under Review
            </div>
            <ul className="space-y-1">
              {messages.map((msg, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="mr-1">•</span>
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400">
              This recommendation is being reviewed by moderators
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
              <div className="border-8 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlagIndicator;
