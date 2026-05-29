import { useState, useEffect, useRef } from 'react';
import { getVolumeConfirmation, getTradeSignal, getVolumeSpike, getSMC, getAccuracy, getOrderFlow } from '../services/api';

function StockCard({ stock, onClick, isWatched, onToggleWatch }) {
  const isPositive = stock.changePercent > 0;
  const color = isPositive ? '#22c55e' : stock.changePercent < 0 ? '#ef4444' : '#94a3b8';
  const vol = getVolumeConfirmation(stock);
  const trade = getTradeSignal(stock);
  const spike = getVolumeSpike(stock);
  const [smc, setSmc] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  // FIX: Replaced plain object with useRef so the flag survives re-renders.
  // A plain object { current: false } gets recreated on every render, so
  // the IntersectionObserver fires multiple times per card if React
  // re-renders the parent (e.g., during auto-refresh or filter changes).
  const firedRef = useRef(false);
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

  // FIX: Guard against null / undefined / NaN values so .toFixed() doesn't
  // throw TypeError when the API omits a field. Also guards against NaN
  // produced by upstream 0-division or missing data.
  const safePrice = (stock.price != null && !Number.isNaN(stock.price)) ? stock.price.toFixed(2) : '---';
  const safeVolume = (stock.volume != null && !Number.isNaN(stock.volume)) ? (stock.volume / 1000).toFixed(0) : '0';
  const safeRSI = (stock.rsi != null && !Number.isNaN(stock.rsi)) ? stock.rsi.toFixed(0) : null;
  const safeName = stock.name ? stock.name.slice(0, 25) : stock.symbol;

  // FIX: Guard against null / undefined / NaN in trade levels so .toFixed()
  // doesn't crash when the API returns incomplete prediction data.
  const safeEntry = (trade?.entry != null && !Number.isNaN(trade.entry)) ? trade.entry.toFixed(2) : null;
  const safeTarget = (trade?.target != null && !Number.isNaN(trade.target)) ? trade.target.toFixed(2) : '---';
  const safeSL = (trade?.stopLoss != null && !Number.isNaN(trade.stopLoss)) ? trade.stopLoss.toFixed(2) : '---';

  // FIX: Guard against null / undefined / NaN in bid/ask display values so
  // .toLocaleString() and .toFixed() don't throw when the API omits them.
  const safeBidVol = (stock.bidVolume != null && !Number.isNaN(stock.bidVolume)) ? stock.bidVolume.toLocaleString() : '0';
  const safeAskVol = (stock.askVolume != null && !Number.isNaN(stock.askVolume)) ? stock.askVolume.toLocaleString() : '0';
  const safeSpread = (stock.spreadPct != null && !Number.isNaN(stock.spreadPct)) ? stock.spreadPct.toFixed(2) : '0.00';

  return (
    <div className="stock-card" id={`card-${stock.symbol}`} onClick={onClick}>
      <div className="card-top">
        <div className="card-symbol">
          <span
            className={`watch-star ${isWatched ? 'watched' : ''}`}
            onClick={onToggleWatch}
            title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {isWatched ? '⭐' : '☆'}
          </span>
          {stock.symbol}
        </div>
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

      {/* FIX: Changed condition from trade?.entry != null to safeEntry != null
           so the levels section only renders when the value is actually usable.
           Also guards all three fields with NaN checks. */}
      {safeEntry != null && (
        <div className="card-trade-levels">
          <div className="trade-level entry">Entry: ₨{safeEntry}</div>
          <div className="trade-level target">Target: ₨{safeTarget}</div>
          <div className="trade-level sl">SL: ₨{safeSL}</div>
        </div>
      )}

      <div className="card-volume">
        Vol: {safeVolume}K
        {safeRSI && <span style={{ marginLeft: 8, color: stock.rsi < 30 ? '#22c55e' : stock.rsi > 70 ? '#ef4444' : '#f59e0b' }}>RSI: {safeRSI}</span>}
      </div>

      {/* FIX: Guard against bidPrice being 0, null, undefined, or NaN so
           the bid/ask row only shows when genuine data exists. */}
      {(stock.bidPrice != null && !Number.isNaN(stock.bidPrice) && stock.bidPrice > 0) && (
        <div className="card-bidask">
          <span style={{ color: stock.bidAskRatio > 1.5 ? '#22c55e' : '#94a3b8' }}>
            B: {safeBidVol}
          </span>
          <span style={{ color: stock.spreadPct < 0.15 ? '#22c55e' : '#f59e0b' }}>
            {safeSpread}%
          </span>
          <span style={{ color: stock.bidAskRatio < 0.5 ? '#ef4444' : '#94a3b8' }}>
            A: {safeAskVol}
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

      {/* FIX: Guard against NaN in accuracy display so the card doesn't show
           "NaN% pivot | NaN% ATR" when the API returns null or incomplete data. */}
      {accuracy && accuracy.totalCompleted >= 3 && (
        <div className="card-accuracy">
          🎯 {(accuracy.pivotAccuracy != null && !Number.isNaN(accuracy.pivotAccuracy)) ? accuracy.pivotAccuracy + '% pivot' : '— pivot'}
          {' | '}
          {(accuracy.atrAccuracy != null && !Number.isNaN(accuracy.atrAccuracy)) ? accuracy.atrAccuracy + '% ATR' : '— ATR'}
          <br />Best: {accuracy.bestMethod || '—'}
        </div>
      )}
    </div>
  );
}

export default StockCard;