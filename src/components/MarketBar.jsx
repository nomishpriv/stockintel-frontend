function MarketBar({ summary, loading }) {
  if (loading) {
    return (
      <div className="market-bar">
        <span>📡 Loading market data...</span>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="market-bar">
      <span className="market-stat">
        📊 <strong>{summary.active}</strong> Active
      </span>
      <span className="market-stat gain">
        🟢 <strong>{summary.gainers}</strong> Gainers
      </span>
      <span className="market-stat loss">
        🔴 <strong>{summary.losers}</strong> Losers
      </span>
      <span className="market-stat">
        📈 Avg Change: <strong style={{ color: summary.avgChange > 0 ? '#22c55e' : '#ef4444' }}>
          {summary.avgChange > 0 ? '+' : ''}{summary.avgChange}%
        </strong>
      </span>
    </div>
  );
}

export default MarketBar;