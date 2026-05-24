import { useState, useEffect, useRef } from 'react';
import MarketBar from './components/MarketBar';
import SearchBar from './components/SearchBar';
import StockCard from './components/StockCard';
import StockModal from './components/StockModal';
import SectorHeatmap from './components/SectorHeatmap';
import TestPanel from './components/TestPanel';

import { getStocks, getMarketSummary, getOpportunities, getSectors, getNewsImpact, getShariahTrades, getInstitutionalActivity, getKSE100VolumeSpeed } from './services/api';
import './App.css';

function App() {
  const [stocks, setStocks] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [summary, setSummary] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');  // ← Add this line
  const [newsImpact, setNewsImpact] = useState(null);
  const [shariahTrades, setShariahTrades] = useState(null);
  const [instActivity, setInstActivity] = useState(null);
  const [kseSpeed, setKseSpeed] = useState(null);
  const KMI30_SYMBOLS = [
  'AIRLINK', 'ATRL', 'CNERGY', 'CPHL', 'DGKC', 'EFERT', 'ENGROH', 'FCCL',
  'FFC', 'FFL', 'GAL', 'GHNI', 'GLAXO', 'HUBC', 'LUCK', 'MARI', 'MEBL',
  'MLCF', 'MTL', 'NRL', 'OGDC', 'PAEL', 'PPL', 'PRL', 'PSO',
  'SAZEW', 'SEARL', 'SNGP', 'SSGC', 'SYS'
];
const filterRef = useRef('ALL');


  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

const loadData = async () => {
    try {
      const [stocksRes, summaryRes, oppRes, sectorRes, newsRes, shariahRes, instRes, speedRes] = await Promise.all([
  getStocks(), getMarketSummary(), getOpportunities(), getSectors(), getNewsImpact(), getShariahTrades(), getInstitutionalActivity(), getKSE100VolumeSpeed()
]);

      if (stocksRes.data?.success) {
        const allStocks = stocksRes.data.data;
        setStocks(allStocks);
        
        // Re-apply current filter using ref (always up-to-date)
        const currentFilter = filterRef.current;
        if (currentFilter === 'KMI30') {
          setFiltered(allStocks.filter(s => KMI30_SYMBOLS.includes(s.symbol)));
        } else if (currentFilter === 'BUY') {
          setFiltered(allStocks.filter(s => 
            s.signal === 'BUY' || (s.changePercent > 1 && s.volume > s.volAvg10d * 1.2)
          ));
        } else if (currentFilter === 'SELL') {
          setFiltered(allStocks.filter(s => 
            s.signal === 'SELL' || (s.changePercent < -1 && s.volume > s.volAvg10d * 1.2)
          ));
        } else if (currentFilter === 'VOL_SPIKE') {
          setFiltered(allStocks.filter(s => s.volume > s.volAvg10d * 2 && s.changePercent > 1));
        } else if (currentFilter === 'VOL_FALL') {
          setFiltered(allStocks.filter(s => s.volume > s.volAvg10d * 2 && s.changePercent < -1));
        } else if (currentFilter === 'CIRCUIT') {
          setFiltered(allStocks.filter(s => s.upperCircuit && s.lowerCircuit && ((s.upperCircuit - s.price) / s.price * 100 < 5 || (s.price - s.lowerCircuit) / s.price * 100 < 5)));
        } else if (currentFilter === 'ABNORMAL') {
          setFiltered(allStocks.filter(s => s.volume > s.volAvg10d * 3));
        } else {
          setFiltered(allStocks);
        }
      }
      if (summaryRes.data?.success) setSummary(summaryRes.data.data);
      if (oppRes.data?.success) setOpportunities(oppRes.data.data);
      if (sectorRes.data?.success) setSectors(sectorRes.data.data);
      if (newsRes.data?.success) setNewsImpact(newsRes.data);
      if (shariahRes.data?.success) setShariahTrades(shariahRes.data);
      if (instRes.data?.success) setInstActivity(instRes.data);
      if (speedRes.data?.success) setKseSpeed(speedRes.data);

    } catch (e) {
      console.error('Load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    setSearchTerm(query);
    applyFilters(stocks, query, filter);
  };

 const handleFilter = (type) => {
  setFilter(type);
  filterRef.current = type;
  applyFilters(stocks, searchTerm, type);
};

 const applyFilters = (stockList, search, filterType) => {
  let result = stockList;
  
  // KMI30 first
  if (filterType === 'KMI30') {
    result = result.filter(s => KMI30_SYMBOLS.includes(s.symbol));
  }
  
  // Volume Spike: volume > 2x average AND price up > 1%
  if (filterType === 'VOL_SPIKE') {
    result = result.filter(s => 
      s.volume > s.volAvg10d * 2 && s.changePercent > 1
    );
  }
  
  // Volume Fall: volume > 2x average AND price down < -1%
  if (filterType === 'VOL_FALL') {
    result = result.filter(s => 
      s.volume > s.volAvg10d * 2 && s.changePercent < -1
    );
  }
  
  // Near Circuit: price within 5% of upper or lower circuit
  if (filterType === 'CIRCUIT') {
    result = result.filter(s => 
      s.upperCircuit && s.lowerCircuit &&
      ((s.upperCircuit - s.price) / s.price * 100 < 5 ||
       (s.price - s.lowerCircuit) / s.price * 100 < 5)
    );
  }
  
  // Abnormal Volume: volume > 3x average (either direction)
  if (filterType === 'ABNORMAL') {
    result = result.filter(s => 
      s.volume > s.volAvg10d * 3
    );
  }
  
  // Search
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(s =>
      s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }
  
  // BUY/SELL
  if (filterType === 'BUY') {
    result = result.filter(s => 
      s.signal === 'BUY' || (s.changePercent > 1 && s.volume > s.volAvg10d * 1.2)
    );
  } else if (filterType === 'SELL') {
    result = result.filter(s => 
      s.signal === 'SELL' || (s.changePercent < -1 && s.volume > s.volAvg10d * 1.2)
    );
  }
  
  setFiltered(result);
};

  return (
    <div className="app">
      <MarketBar summary={summary} loading={loading} />
      {newsImpact?.aiAnalysis && (
  <div className={`news-bar ${newsImpact.aiAnalysis.sentiment === 'BULLISH' ? 'bullish' : newsImpact.aiAnalysis.sentiment === 'BEARISH' ? 'bearish' : ''}`}>
    <span className="news-signal-badge" style={{ background: newsImpact.signalMeta?.color || '#666' }}>
      {newsImpact.signalMeta?.emoji} {newsImpact.aiAnalysis.signal?.replace('_', ' ')}
    </span>
    <span className="news-summary">{newsImpact.aiAnalysis.summary}</span>
    <span className="news-action">{newsImpact.aiAnalysis.immediateAction}</span>
    {newsImpact.aiAnalysis.topTrades?.slice(0, 3).map((t, i) => (
      <span key={i} className="news-trade-chip" style={{ color: t.action === 'BUY' ? '#22c55e' : '#ef4444' }}>
        {t.ticker} {t.action}
      </span>
    ))}
  </div>
)}

  {shariahTrades?.recommendations?.length > 0 && (
  <div className="shariah-bar">
    <span className="shariah-title">🕌 Shariah Long Trades</span>
    {shariahTrades.recommendations.map((t, i) => (
      <span key={i} className="shariah-chip" style={{ borderColor: t.color, color: t.color }}>
        {t.symbol} ({t.score}) {t.recommendation}
      </span>
    ))}
    {shariahTrades.marketContext && (
      <span className="shariah-context">{shariahTrades.marketContext.summary?.slice(0, 60)}</span>
    )}
  </div>
)}
    {instActivity && (
  <div className="inst-bar" style={{ borderLeftColor: instActivity.color }}>
    <span>{instActivity.signal}</span>
    <span>Vol: {instActivity.today.volume?.toLocaleString()} | σ: {instActivity.volumeSigma}</span>
    {instActivity.bullishTrigger && <span>🟢 Institutions buying</span>}
    <span>{instActivity.recommendation}</span>
  </div>
)}

{kseSpeed && (
  <div className="speed-bar" style={{ borderLeftColor: kseSpeed.color }}>
    <span>⚡ KSE Vol Speed: {kseSpeed.trend}</span>
    <span>{kseSpeed.perMinute?.toLocaleString()}/min</span>
    <span>{kseSpeed.message}</span>
  </div>
)}
      <SectorHeatmap sectors={sectors} />

      {opportunities.length > 0 && (
        <div className="opportunities-bar">
          <span>🔥 Top Movers: </span>
          {opportunities.slice(0, 5).map(o => (
            <span
              key={o.symbol}
              className="opp-chip"
              style={{ color: o.changePercent > 0 ? '#22c55e' : '#ef4444' }}
              onClick={() => setSelected(o)}
            >
              {o.symbol} {o.changePercent > 0 ? '+' : ''}{o.changePercent}%
            </span>
          ))}
        </div>
      )}

      <div className="filter-bar">
        <button className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`} onClick={() => handleFilter('ALL')}>
          📋 All
        </button>
        <button className={`filter-btn buy ${filter === 'BUY' ? 'active' : ''}`} onClick={() => handleFilter('BUY')}>
          🟢 Buy Signals
        </button>
        <button className={`filter-btn sell ${filter === 'SELL' ? 'active' : ''}`} onClick={() => handleFilter('SELL')}>
          🔴 Sell Signals
        </button>
<button className={`filter-btn kmi ${filter === 'KMI30' ? 'active' : ''}`} onClick={() => handleFilter('KMI30')}>
  🏦 KMI-30
</button>

<button className={`filter-btn spike ${filter === 'VOL_SPIKE' ? 'active' : ''}`} onClick={() => handleFilter('VOL_SPIKE')}>
  🚀 Vol Spike
</button>
<button className={`filter-btn fall ${filter === 'VOL_FALL' ? 'active' : ''}`} onClick={() => handleFilter('VOL_FALL')}>
  📉 Vol Fall
</button>
<button className={`filter-btn circuit ${filter === 'CIRCUIT' ? 'active' : ''}`} onClick={() => handleFilter('CIRCUIT')}>
  ⚡ Near Circuit
</button>
<button className={`filter-btn abnormal ${filter === 'ABNORMAL' ? 'active' : ''}`} onClick={() => handleFilter('ABNORMAL')}>
  🔴 Abnormal Vol
</button>
      </div>
      <div className="filter-counts">
        <span style={{ color: '#22c55e' }}>
          🟢 {stocks.filter(s => s.signal === 'BUY' || (s.changePercent > 1 && s.volume > s.volAvg10d * 1.2)).length} Buys
        </span>
        <span style={{ color: '#ef4444' }}>
          🔴 {stocks.filter(s => s.signal === 'SELL' || (s.changePercent < -1 && s.volume > s.volAvg10d * 1.2)).length} Sells
        </span>
      </div>


      <SearchBar onSearch={handleSearch} />

      <div className="stats">
        {filtered.length} stocks | {summary?.gainers || 0} ↑ {summary?.losers || 0} ↓
      </div>

      <div className="stock-grid">
        {filtered.map(stock => (
          <StockCard key={stock.symbol} stock={stock} onClick={() => setSelected(stock)} />
        ))}
      </div>

      {selected && <StockModal stock={selected} onClose={() => setSelected(null)} />}
      <TestPanel />
    </div>
  );
}

export default App;