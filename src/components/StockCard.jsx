import { useState, useEffect } from 'react';
import { getVolumeConfirmation, getTradeSignal, getVolumeSpike, getSMC, getAccuracy } from '../services/api';


function StockCard({ stock, onClick }) {
  const isPositive = stock.changePercent > 0;
  const color = isPositive ? '#22c55e' : stock.changePercent < 0 ? '#ef4444' : '#94a3b8';
  const vol = getVolumeConfirmation(stock);
  const trade = getTradeSignal(stock);
  const spike = getVolumeSpike(stock);
  const [smc, setSmc] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const firedRef = { current: false };

  useEffect(() => {
    if (firedRef.current) return;

    const el = document.getElementById(`card-${stock.symbol}`);
    if (!el) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !firedRef.current) {
        firedRef.current = true;

        getSMC(stock.symbol).then(res => {
          if (res?.data?.success) setSmc(res.data);
        }).catch(() => { });

        getAccuracy(stock.symbol).then(res => {
          if (res?.data?.success) setAccuracy(res.data);
        }).catch(() => { });

        observer.disconnect();
      }
    }, { rootMargin: '200px' });

    observer.observe(el);
    return () => observer.disconnect();
  }, [stock.symbol]);

  const topSignal = smc?.choch?.length > 0 ? { type: 'CHOCH', color: '#a855f7', text: smc.choch[0].message } :
    smc?.bos?.length > 0 ? { type: 'BOS', color: smc.bos[0].type === 'BULLISH' ? '#22c55e' : '#ef4444', text: smc.bos[0].message } :
      smc?.fvg?.length > 0 ? { type: 'FVG', color: smc.fvg[0].type === 'BULLISH' ? '#22c55e' : '#ef4444', text: smc.fvg[0].message } :
        null;

  const safePrice = stock.price != null ? stock.price.toFixed(2) : '---';
  const safeVolume = stock.volume != null ? (stock.volume / 1000).toFixed(0) : '0';
  const safeRSI = stock.rsi != null ? stock.rsi.toFixed(0) : null;
  const safeName = stock.name ? stock.name.slice(0, 25) : stock.symbol;

  return (
    <div className="stock-card" id={`card-${stock.symbol}`} onClick={onClick}>
      <div className="card-top">
        <div className="card-symbol">{stock.symbol}</div>
        <div className="card-action" style={{ background: (trade?.color || '#94a3b8') + '20', color: trade?.color || '#94a3b8' }}>
          {trade?.action || '---'}
        </div>
      </div>
      <div className="card-name">{safeName}</div>
      <div className="card-price">₨ {safePrice}</div>
      <div className="card-change" style={{ color }}>
        {isPositive ? '+' : ''}{stock.changePercent}%
      </div>

      {topSignal && (
        <div className="card-smc" style={{ borderColor: topSignal.color, color: topSignal.color }}>
          {topSignal.type}: {topSignal.text.slice(0, 40)}
        </div>
      )}

      <div className="card-volume-row" style={{ color: vol?.color || '#94a3b8' }}>
        {vol?.icon || '📊'} Vol: {vol?.message?.split('—')[0] || 'N/A'}
      </div>

      {spike?.isSpike && (
        <div className="card-spike">{spike.message}</div>
      )}

      {trade?.entry != null && (
        <div className="card-trade-levels">
          <div className="trade-level entry">Entry: ₨{trade.entry.toFixed(2)}</div>
          <div className="trade-level target">Target: ₨{trade.target?.toFixed(2) || '---'}</div>
          <div className="trade-level sl">SL: ₨{trade.stopLoss?.toFixed(2) || '---'}</div>
        </div>
      )}

      <div className="card-volume">
        Vol: {safeVolume}K
        {safeRSI && <span style={{ marginLeft: 8, color: stock.rsi < 30 ? '#22c55e' : stock.rsi > 70 ? '#ef4444' : '#f59e0b' }}>RSI: {safeRSI}</span>}
      </div>
      {stock.bidPrice > 0 && (
  <div className="card-bidask">
    <span style={{ color: stock.bidAskRatio > 1.5 ? '#22c55e' : '#94a3b8' }}>
      B: {stock.bidVolume?.toLocaleString()}
    </span>
    <span style={{ color: stock.spreadPct < 0.15 ? '#22c55e' : '#f59e0b' }}>
      {stock.spreadPct}%
    </span>
    <span style={{ color: stock.bidAskRatio < 0.5 ? '#ef4444' : '#94a3b8' }}>
      A: {stock.askVolume?.toLocaleString()}
    </span>
  </div>
)}
      {accuracy && accuracy.totalCompleted >= 3 && (
        <div className="card-accuracy">
          🎯 {accuracy.pivotAccuracy}% pivot | {accuracy.atrAccuracy}% ATR
          <br />Best: {accuracy.bestMethod}
        </div>
      )}
    </div>
  );
}

export default StockCard;