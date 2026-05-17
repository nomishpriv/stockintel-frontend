import { useState, useEffect } from 'react';
import { getVolumeConfirmation, getTradeSignal, getVolumeSpike, getSMC } from '../services/api';

function StockCard({ stock, onClick }) {
  const isPositive = stock.changePercent > 0;
  const color = isPositive ? '#22c55e' : stock.changePercent < 0 ? '#ef4444' : '#94a3b8';
  const vol = getVolumeConfirmation(stock);
  const trade = getTradeSignal(stock);
  const spike = getVolumeSpike(stock);
  const [smc, setSmc] = useState(null);

  useEffect(() => {
    getSMC(stock.symbol).then(res => {
      if (res?.data?.success) setSmc(res.data);
    }).catch(() => {});
  }, [stock.symbol]);

  // Get top SMC signal
  const topSignal = smc?.choch?.length > 0 ? { type: 'CHOCH', color: '#a855f7', text: smc.choch[0].message } :
                    smc?.bos?.length > 0 ? { type: 'BOS', color: smc.bos[0].type === 'BULLISH' ? '#22c55e' : '#ef4444', text: smc.bos[0].message } :
                    smc?.fvg?.length > 0 ? { type: 'FVG', color: smc.fvg[0].type === 'BULLISH' ? '#22c55e' : '#ef4444', text: smc.fvg[0].message } :
                    null;

  return (
    <div className="stock-card" onClick={onClick}>
      <div className="card-top">
        <div className="card-symbol">{stock.symbol}</div>
        <div className="card-action" style={{ background: trade.color + '20', color: trade.color }}>
          {trade.action}
        </div>
      </div>
      <div className="card-name">{stock.name.slice(0, 25)}</div>
      <div className="card-price">₨ {stock.price?.toFixed(2)}</div>
      <div className="card-change" style={{ color }}>
        {isPositive ? '+' : ''}{stock.changePercent}%
      </div>

      {/* SMC Signal */}
      {topSignal && (
        <div className="card-smc" style={{ borderColor: topSignal.color, color: topSignal.color }}>
          {topSignal.type}: {topSignal.text.slice(0, 40)}
        </div>
      )}

      {/* Volume Confirmation */}
      <div className="card-volume-row" style={{ color: vol.color }}>
        {vol.icon} Vol: {vol.message.split('—')[0]}
      </div>

      {/* Volume Spike Alert */}
      {spike.isSpike && (
        <div className="card-spike">{spike.message}</div>
      )}

      {/* Entry / Target / SL */}
      {trade.entry && (
        <div className="card-trade-levels">
          <div className="trade-level entry">Entry: ₨{trade.entry.toFixed(2)}</div>
          <div className="trade-level target">Target: ₨{trade.target.toFixed(2)}</div>
          <div className="trade-level sl">SL: ₨{trade.stopLoss.toFixed(2)}</div>
        </div>
      )}

      <div className="card-volume">
        Vol: {(stock.volume / 1000).toFixed(0)}K
        {stock.rsi && <span style={{ marginLeft: 8, color: stock.rsi < 30 ? '#22c55e' : stock.rsi > 70 ? '#ef4444' : '#f59e0b' }}>RSI: {stock.rsi.toFixed(0)}</span>}
      </div>
    </div>
  );
}

export default StockCard;