import axios from 'axios';

const api = axios.create({
 // baseURL: 'http://localhost:5001/api',
  baseURL: 'https://saddlebrown-scorpion-534823.hostingersite.com/api',
  timeout: 10000
});

export const getStocks = () => api.get('/stocks');
export const getStock = (symbol) => api.get(`/stocks/${symbol}`);
export const getMarketSummary = () => api.get('/market/summary');
export const searchStocks = (query) => api.get(`/search?q=${query}`);
export const getOpportunities = (limit = 10) => api.get(`/opportunities?limit=${limit}`);
export const getSectors = () => api.get('/sectors');
export const getSMC = (symbol) => api.get(`/smc/${symbol}`);
export const predictStock = (symbol) => api.get(`/predict/${symbol}`);
export const checkPrediction = (symbol) => api.get(`/predict/check/${symbol}`);
export const getAccuracy = (symbol) => api.get(`/predict/accuracy/${symbol}`);
export const getAllAccuracies = () => api.get('/predict/accuracy');
export const getNewsImpact = () => api.get('/news/impact');
export const getQuickSignal = () => api.get('/news/signal');
export const getOrderFlow = (symbol) => api.get(`/orderflow/${symbol}`);
export const getShariahTrades = () => api.get('/shariah/trades');
export const getInstitutionalActivity = () => api.get('/institutional');
export const getKSE100Volume = () => api.get('/kse100/volume');
export const getKSE100VolumeSpeed = () => api.get('/kse100/volume-speed');
// Predictions
export const getPredictions = () => api.get('/predict/accuracy');
export const createPrediction = (symbol) => api.get(`/predict/${symbol}`);

export const getTodayResults = () => api.get('/results/today');
export const getStockResult = (symbol) => api.get(`/results/${symbol}`);

// ========== INTRADAY HELPERS ==========

export function getVolumeConfirmation(stock) {
  // FIX: Guard against zero avgVol which would make ratio Infinity and crash
  // downstream formatting. Also guard against missing stock object.
  if (!stock || typeof stock !== 'object') {
    return { level: 'UNKNOWN', color: '#64748b', icon: '❓', message: 'No data' };
  }
  // FIX: Use > 0 check instead of || 1 fallback. The old code used || 1 which
  // makes ratio = volume when the average is genuinely 0 (missing data),
  // falsely showing every stock as having massive volume.
  const avgVol = stock.volAvg10d > 0 ? stock.volAvg10d : (stock.volAvg1w > 0 ? stock.volAvg1w : 0);
  if (avgVol <= 0) {
    return { level: 'NO_AVG', color: '#64748b', icon: '📊', message: 'No volume average available' };
  }
  const ratio = (stock.volume / avgVol) * 100;

  if (ratio >= 200) return { level: 'EXPLOSIVE', color: '#a855f7', icon: '💥', message: `${ratio.toFixed(0)}% of avg — massive volume` };
  if (ratio >= 150) return { level: 'HIGH', color: '#22c55e', icon: '🔥', message: `${ratio.toFixed(0)}% of avg — strong confirmation` };
  if (ratio >= 120) return { level: 'ABOVE_AVG', color: '#84cc16', icon: '📈', message: `${ratio.toFixed(0)}% of avg — above normal` };
  if (ratio >= 80) return { level: 'NORMAL', color: '#f59e0b', icon: '📊', message: `${ratio.toFixed(0)}% of avg — normal` };
  if (ratio >= 50) return { level: 'BELOW_AVG', color: '#f97316', icon: '📉', message: `${ratio.toFixed(0)}% of avg — low` };
  return { level: 'THIN', color: '#ef4444', icon: '⚠️', message: `${ratio.toFixed(0)}% of avg — avoid` };
}

export function getTradeSignal(stock) {
  // FIX: Guard against null/undefined stock object so the entire function
  // doesn't throw when called with bad data.
  if (!stock || typeof stock !== 'object') {
    return { action: 'WAIT', color: '#f59e0b', score: 50, entry: null, target: null, stopLoss: null, reason: 'No data', reasons: [] };
  }

  // FIX: Use > 0 guards instead of || 0 fallbacks for pivot levels. The old
  // code defaulted missing pivot data to 0, which made every stock appear
  // "above pivot" (price > 0) and falsely triggered support/resistance logic.
  const price = stock.price || 0;
  const pivot = stock.pivot > 0 ? stock.pivot : 0;
  const s1 = stock.s1 > 0 ? stock.s1 : 0;
  const s2 = stock.s2 > 0 ? stock.s2 : 0;
  const r1 = stock.r1 > 0 ? stock.r1 : 0;
  const r2 = stock.r2 > 0 ? stock.r2 : 0;
  // FIX: Guard against NaN/0 RSI. Missing RSI defaults to 0 upstream, which
  // would trigger the "RSI oversold" bonus falsely.
  const rsi = (stock.rsi > 0 && !Number.isNaN(stock.rsi)) ? stock.rsi : 50;
  const vol = getVolumeConfirmation(stock);
  const change = stock.changePercent || 0;
  const bidAskRatio = stock.bidAskRatio || 1;
  const spreadPct = stock.spreadPct || 0;

  let score = 50;
  const reasons = [];

  // 1. Price vs Pivots (0-25 points)
  // FIX: Only evaluate pivot logic when genuine pivot data exists (> 0).
  // Without this, price > 0 (always true) triggers "Above pivot" for every
  // stock when the API omits pivot levels.
  if (pivot > 0) {
    if (price > pivot) { score += 5; reasons.push('Above pivot'); }
    if (s1 > 0 && price <= s1 && price > s2) { score += 10; reasons.push('Near S1 support — good entry'); }
    if (s2 > 0 && price <= s2) { score += 15; reasons.push('Near S2 strong support — buy zone'); }
    if (r1 > 0 && price >= r1 && price < r2) { score -= 10; reasons.push('Near R1 resistance — take profit'); }
    if (r2 > 0 && price >= r2) { score -= 15; reasons.push('Near R2 — overbought zone'); }
  }

  // 2. Volume Confirmation (0-20 points)
  if (vol.level === 'EXPLOSIVE') { score += change > 0 ? 18 : -18; reasons.push('Explosive volume'); }
  else if (vol.level === 'HIGH') { score += change > 0 ? 12 : -12; reasons.push('High volume confirming'); }
  else if (vol.level === 'ABOVE_AVG') { score += change > 0 ? 6 : -6; reasons.push('Above avg volume'); }
  else if (vol.level === 'THIN' || vol.level === 'BELOW_AVG') { score -= 15; reasons.push('Volume too thin — avoid'); }

  // 3. RSI (0-15 points)
  // FIX: Only evaluate RSI logic when genuine RSI data exists (> 0).
  // Missing RSI (0) would falsely trigger "RSI oversold" bonus.
  if (stock.rsi > 0 && !Number.isNaN(stock.rsi)) {
    if (rsi < 30) { score += 12; reasons.push('RSI oversold — bounce likely'); }
    else if (rsi < 40) { score += 6; reasons.push('RSI near oversold'); }
    else if (rsi > 70) { score -= 12; reasons.push('RSI overbought — pullback likely'); }
    else if (rsi > 60) { score -= 6; reasons.push('RSI near overbought'); }
  }

  // 4. Bid/Ask Order Flow (0-15 points)
  if (bidAskRatio > 2) { score += 12; reasons.push('Strong bid wall — buying pressure'); }
  else if (bidAskRatio > 1.5) { score += 7; reasons.push('Bid pressure building'); }
  else if (bidAskRatio < 0.3) { score -= 12; reasons.push('Strong ask wall — selling pressure'); }
  else if (bidAskRatio < 0.5) { score -= 7; reasons.push('Ask pressure building'); }

  // 5. Spread / Liquidity (0-5 points)
  // FIX: Only evaluate spread when genuine data exists (> 0). Missing spread
  // (0) would falsely award "Tight spread" points.
  if (spreadPct > 0) {
    if (spreadPct < 0.1) { score += 5; reasons.push('Tight spread — liquid'); }
    else if (spreadPct > 0.5) { score -= 5; reasons.push('Wide spread — illiquid'); }
  }

  // 6. Momentum (0-10 points)
  if (change > 3) { score += 8; reasons.push('Strong momentum up'); }
  else if (change > 1) { score += 4; reasons.push('Positive momentum'); }
  else if (change < -3) { score -= 8; reasons.push('Strong momentum down'); }
  else if (change < -1) { score -= 4; reasons.push('Negative momentum'); }

  // 7. Volume + Price alignment bonus
  if (vol.level === 'HIGH' && change > 1) { score += 5; reasons.push('Volume confirms uptrend'); }
  else if (vol.level === 'HIGH' && change < -1) { score -= 5; reasons.push('Volume confirms downtrend'); }

  // Clamp score
  score = Math.min(100, Math.max(0, Math.round(score)));

  // Determine action
  let action, color;
  if (score >= 75) { action = 'STRONG_BUY'; color = '#10b981'; }
  else if (score >= 62) { action = 'BUY'; color = '#22c55e'; }
  else if (score >= 52) { action = 'WEAK_BUY'; color = '#84cc16'; }
  else if (score >= 48) { action = 'WAIT'; color = '#f59e0b'; }
  else if (score >= 38) { action = 'WEAK_SELL'; color = '#f97316'; }
  else if (score >= 25) { action = 'SELL'; color = '#ef4444'; }
  else { action = 'STRONG_SELL'; color = '#dc2626'; }

  // Entry/Target/SL based on action
  // FIX: Only compute levels when genuine pivot data exists and price > 0.
  // Without this, missing S1/R1 (0) produces entry=0, target=0, stopLoss=0.
  let entry = null, target = null, stopLoss = null;

  if (action.includes('BUY') && s1 > 0) {
    entry = price <= s1 ? s1 : price;
    target = r1 > price ? r1 : (r2 > price ? r2 : +(price * 1.02).toFixed(2));
    stopLoss = s2 > 0 ? s2 : (s1 > 0 ? s1 : +(price * 0.98).toFixed(2));
  } else if (action.includes('SELL') && r1 > 0) {
    entry = price >= r1 ? r1 : price;
    target = s1 < price ? s1 : (s2 < price ? s2 : +(price * 0.98).toFixed(2));
    stopLoss = r2 > 0 ? r2 : (r1 > 0 ? r1 : +(price * 1.02).toFixed(2));
  }

  return {
    action,
    color,
    score,
    entry,
    target,
    stopLoss,
    reason: reasons.slice(0, 4).join('; ') || 'No clear signal',
    reasons
  };
}

export function getVolumeSpike(stock) {
  // FIX: Guard against null/undefined stock object.
  if (!stock || typeof stock !== 'object') {
    return { isSpike: false, isSurge: false, vsAvg: '0', vsPrevDay: '0', message: null };
  }
  // FIX: Use > 0 check instead of || 1 fallback. Missing volAvg10d (0)
  // would make ratio = volume/1 = volume, falsely showing every stock as
  // having a massive spike.
  const avgVol = stock.volAvg10d > 0 ? stock.volAvg10d : (stock.volAvg1w > 0 ? stock.volAvg1w : 0);
  if (avgVol <= 0) {
    return { isSpike: false, isSurge: false, vsAvg: '0', vsPrevDay: '0', message: null };
  }
  const ratio = (stock.volume / avgVol) * 100;
  // FIX: Guard against prevVolume being 0 or missing to avoid Infinity.
  const prevRatio = (stock.prevVolume > 0) ? (stock.volume / stock.prevVolume) * 100 : 100;

  return {
    isSpike: ratio > 200,
    isSurge: ratio > 150,
    vsAvg: ratio.toFixed(0),
    vsPrevDay: prevRatio.toFixed(0),
    message: ratio > 200 
      ? `🚨 Volume spike! ${ratio.toFixed(0)}% of avg` 
      : ratio > 150 
        ? `📈 High volume: ${ratio.toFixed(0)}% of avg`
        : null
  };
}

export default api;