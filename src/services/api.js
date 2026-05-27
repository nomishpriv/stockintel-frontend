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
  const avgVol = stock.volAvg10d || stock.volAvg1w || 1;
  const ratio = (stock.volume / avgVol) * 100;
  
  if (ratio >= 200) return { level: 'EXPLOSIVE', color: '#a855f7', icon: '💥', message: `${ratio.toFixed(0)}% of avg — massive volume` };
  if (ratio >= 150) return { level: 'HIGH', color: '#22c55e', icon: '🔥', message: `${ratio.toFixed(0)}% of avg — strong confirmation` };
  if (ratio >= 120) return { level: 'ABOVE_AVG', color: '#84cc16', icon: '📈', message: `${ratio.toFixed(0)}% of avg — above normal` };
  if (ratio >= 80) return { level: 'NORMAL', color: '#f59e0b', icon: '📊', message: `${ratio.toFixed(0)}% of avg — normal` };
  if (ratio >= 50) return { level: 'BELOW_AVG', color: '#f97316', icon: '📉', message: `${ratio.toFixed(0)}% of avg — low` };
  return { level: 'THIN', color: '#ef4444', icon: '⚠️', message: `${ratio.toFixed(0)}% of avg — avoid` };
}

export function getTradeSignal(stock) {
  const price = stock.price;
  const pivot = stock.pivot;
  const s1 = stock.s1;
  const s2 = stock.s2;
  const r1 = stock.r1;
  const r2 = stock.r2;
  const rsi = stock.rsi;
  const vol = getVolumeConfirmation(stock);
  const change = stock.changePercent;

  // Entry near support
  if (price <= s1 && vol.level !== 'THIN' && rsi < 50) {
    return {
      action: 'BUY',
      entry: s1,
      target: r1,
      stopLoss: s2,
      reason: 'Price near S1 support + volume OK',
      color: '#22c55e'
    };
  }
  
  // Entry near S2 (stronger support)
  if (price <= s2 && vol.level !== 'THIN') {
    return {
      action: 'STRONG_BUY',
      entry: s2,
      target: pivot,
      stopLoss: stock.lowerCircuit,
      reason: 'Price at S2 strong support',
      color: '#10b981'
    };
  }

  // Exit near resistance
  if (price >= r1 && change > 0 && rsi > 60) {
    return {
      action: 'SELL',
      entry: r1,
      target: pivot,
      stopLoss: r2,
      reason: 'Price at R1 resistance — take profit',
      color: '#ef4444'
    };
  }

  // High volume breakout
  if (vol.level === 'EXPLOSIVE' && change > 0 && price > pivot) {
    return {
      action: 'BREAKOUT_BUY',
      entry: price,
      target: r2,
      stopLoss: pivot,
      reason: 'High volume breakout above pivot',
      color: '#22c55e'
    };
  }

  // High volume breakdown
  if (vol.level === 'EXPLOSIVE' && change < 0 && price < pivot) {
    return {
      action: 'BREAKOUT_SELL',
      entry: price,
      target: s2,
      stopLoss: pivot,
      reason: 'High volume breakdown below pivot',
      color: '#ef4444'
    };
  }

  // Low volume — avoid
  if (vol.level === 'THIN' || vol.level === 'BELOW_AVG') {
    return {
      action: 'AVOID',
      entry: null,
      target: null,
      stopLoss: null,
      reason: `Volume too low (${vol.message})`,
      color: '#6b7280'
    };
  }


  return {
    action: 'WAIT',
    entry: null,
    target: null,
    stopLoss: null,
    reason: 'No clear setup — wait for entry near pivot levels',
    color: '#f59e0b'
  };
}

export function getVolumeSpike(stock) {
  const avgVol = stock.volAvg10d || stock.volAvg1w || 1;
  const ratio = (stock.volume / avgVol) * 100;
  const prevRatio = stock.prevVolume ? (stock.volume / stock.prevVolume) * 100 : 100;
  
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