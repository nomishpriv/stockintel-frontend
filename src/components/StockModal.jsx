function StockModal({ stock, onClose }) {
  if (!stock) return null;

  const isPositive = stock.changePercent > 0;
  const color = isPositive ? '#22c55e' : stock.changePercent < 0 ? '#ef4444' : '#94a3b8';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{stock.symbol}</h2>
            <p className="modal-name">{stock.name}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-price" style={{ color }}>
          ₨ {stock.price?.toFixed(2)}
          <span className="modal-change">
            {isPositive ? '+' : ''}{stock.changePercent}% (₨ {stock.change?.toFixed(2)})
          </span>
        </div>

        <div className="modal-grid">
          <div className="modal-item">
            <span>Open</span>
            <strong>₨ {stock.open?.toFixed(2)}</strong>
          </div>
          <div className="modal-item">
            <span>High</span>
            <strong>₨ {stock.high?.toFixed(2)}</strong>
          </div>
          <div className="modal-item">
            <span>Low</span>
            <strong>₨ {stock.low?.toFixed(2)}</strong>
          </div>
          <div className="modal-item">
            <span>Prev Close</span>
            <strong>₨ {stock.prevClose?.toFixed(2)}</strong>
          </div>
          <div className="modal-item">
            <span>Volume</span>
            <strong>{(stock.volume / 1000).toFixed(0)}K</strong>
          </div>
          <div className="modal-item">
            <span>RSI</span>
            <strong style={{ color: stock.rsi < 30 ? '#22c55e' : stock.rsi > 70 ? '#ef4444' : '#f59e0b' }}>
              {stock.rsi?.toFixed(1)}
            </strong>
          </div>
        </div>

        <div className="modal-section">
          <h3>📊 Pivot Points</h3>
          <div className="pivot-grid">
            <div className="pivot-item"><span>R2</span><strong>₨ {stock.r2?.toFixed(2)}</strong></div>
            <div className="pivot-item"><span>R1</span><strong>₨ {stock.r1?.toFixed(2)}</strong></div>
            <div className="pivot-item pivot-main"><span>Pivot</span><strong>₨ {stock.pivot?.toFixed(2)}</strong></div>
            <div className="pivot-item"><span>S1</span><strong>₨ {stock.s1?.toFixed(2)}</strong></div>
            <div className="pivot-item"><span>S2</span><strong>₨ {stock.s2?.toFixed(2)}</strong></div>
          </div>
        </div>

        <div className="modal-section">
          <h3>📈 Performance</h3>
          <div className="perf-grid">
            <div className="perf-item"><span>1 Week</span><strong style={{ color: stock.perf1w > stock.price ? '#22c55e' : '#ef4444' }}>₨ {stock.perf1w?.toFixed(2)}</strong></div>
            <div className="perf-item"><span>1 Month</span><strong style={{ color: stock.perf1m > stock.price ? '#22c55e' : '#ef4444' }}>₨ {stock.perf1m?.toFixed(2)}</strong></div>
            <div className="perf-item"><span>3 Months</span><strong style={{ color: stock.perf3m > stock.price ? '#22c55e' : '#ef4444' }}>₨ {stock.perf3m?.toFixed(2)}</strong></div>
            <div className="perf-item"><span>1 Year</span><strong style={{ color: stock.perf1y > stock.price ? '#22c55e' : '#ef4444' }}>₨ {stock.perf1y?.toFixed(2)}</strong></div>
          </div>
        </div>

        <div className="modal-section">
          <h3>💰 Fundamentals</h3>
          <div className="modal-grid">
            <div className="modal-item"><span>EPS</span><strong>{stock.eps > 0 ? `₨ ${stock.eps.toFixed(2)}` : 'N/A'}</strong></div>
<div className="modal-item"><span>PE Ratio</span><strong>{stock.pe > 0 ? stock.pe.toFixed(2) : 'N/A'}</strong></div>
<div className="modal-item"><span>DPS</span><strong>{stock.dps > 0 ? `₨ ${stock.dps.toFixed(2)}` : 'N/A'}</strong></div>
<div className="modal-item"><span>Div Yield</span><strong>{stock.divYield > 0 ? `${stock.divYield.toFixed(2)}%` : 'N/A'}</strong></div>
          </div>
        </div>

        <div className="modal-section">
          <h3>🏷️ Circuit Breakers</h3>
          <div className="circuit-row">
            <span>Upper: <strong style={{ color: '#22c55e' }}>₨ {stock.upperCircuit?.toFixed(2)}</strong></span>
            <span>Lower: <strong style={{ color: '#ef4444' }}>₨ {stock.lowerCircuit?.toFixed(2)}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StockModal;