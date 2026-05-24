import { useState, useEffect } from 'react';
import { getVolumeConfirmation, getTradeSignal, getVolumeSpike, getSMC, getAccuracy, getOrderFlow } from '../services/api';


function StockCard({ stock, onClick }) {
  const isPositive = stock.changePercent > 0;
  const color = isPositive ? '#22c55e' : stock.changePercent < 0 ? '#ef4444' : '#94a3b8';
  const vol = getVolumeConfirmation(stock);
  const trade = getTradeSignal(stock);
  const spike = getVolumeSpike(stock);
  const [smc, setSmc] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const firedRef = { current: false };
  const [orderFlow, setOrderFlow] = useState(null);


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

        getOrderFlow(stock.symbol).then(res => {
          if (res?.data?.success && res.data.ready) setOrderFlow(res.data);
        }).catch(() => { });

        observer.disconnect();
      }
    }, { rootMargin: '200px' });

    observer.observe(el);
    return () => observer.disconnect();
  }, [stock.symbol]);

  const topSignal = smc?.choch?.length > 0 ? { type: 'CHOCH', color: '#a855f7', text: smc.choch[0].message } :
    smc?.bos?.length > 0 ? { type: 'BOS', color: smc.bos[0].type === 'BULLISH' ? '#22c55e' : '#ef4444', text: smc.bos[0].message } :
      smc?.fvg?.length > 0 ? { type: 'FVG', color: smc.fvg[0].type.includes('BULLISH') ? '#22c55e' : '#ef4444', text: smc.fvg[0].message } :
        smc?.liquiditySweeps?.length > 0 ? { type: 'SWEEP', color: smc.liquiditySweeps[0].type.includes('BULLISH') ? '#22c55e' : '#ef4444', text: smc.liquiditySweeps[0].message } :
          smc?.orderBlocks?.length > 0 ? { type: 'OB', color: smc.orderBlocks[0].type.includes('BULLISH') ? '#22c55e' : '#ef4444', text: smc.orderBlocks[0].message } :
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

      {/* SMC Compact Section */}
      {smc && (
        <div className="card-smc-compact">
          {topSignal && (
            <div className="smc-top" style={{ color: topSignal.color }}>
              {topSignal.type}: {topSignal.text.slice(0, 45)}
            </div>
          )}

          {smc.liquiditySweeps?.length > 0 && (
            <div className="smc-row">
              💧 {smc.liquiditySweeps[0].type.includes('BULLISH') ? '🟢' : '🔴'} {smc.liquiditySweeps[0].message.slice(0, 55)}
              {smc.liquiditySweeps.length > 1 && <span className="smc-more"> +{smc.liquiditySweeps.length - 1}</span>}
            </div>
          )}

          {smc.liquidityLevels?.length > 0 && (
            <div className="smc-row">
              🎯 {smc.liquidityLevels[0].type === 'EQUAL_HIGHS' ? '🔴' : '🟢'} {smc.liquidityLevels[0].message.slice(0, 55)}
              {smc.liquidityLevels.length > 1 && <span className="smc-more"> +{smc.liquidityLevels.length - 1}</span>}
            </div>
          )}

          {smc.orderBlocks?.length > 0 && (
            <div className="smc-row">
              🧱 {smc.orderBlocks[0].type.includes('BULLISH') ? '🟢' : '🔴'} {smc.orderBlocks[0].message.slice(0, 55)}
              {smc.orderBlocks.length > 1 && <span className="smc-more"> +{smc.orderBlocks.length - 1}</span>}
            </div>
          )}
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

      {orderFlow?.ready && (
        <div className="card-orderflow" style={{ borderLeftColor: orderFlow.color }}>
          <span style={{ color: orderFlow.color, fontSize: '10px' }}>
            {orderFlow.signal} ({orderFlow.windowMinutes}m)
          </span>
          <span style={{ fontSize: '9px', color: '#64748b' }}>
            Ratio: {orderFlow.overallRatio} | {orderFlow.snapshots} snaps
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