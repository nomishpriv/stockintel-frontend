import { useState, useEffect } from 'react';
import MarketBar from './components/MarketBar';
import SearchBar from './components/SearchBar';
import StockCard from './components/StockCard';
import StockModal from './components/StockModal';
import SectorHeatmap from './components/SectorHeatmap';
import TestPanel from './components/TestPanel';
import { getStocks, getMarketSummary, getOpportunities, getSectors } from './services/api';
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

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
  try {
    const [stocksRes, summaryRes, oppRes, sectorRes] = await Promise.all([
  getStocks(), getMarketSummary(), getOpportunities(), getSectors()
]);

    if (stocksRes.data?.success) {
      setStocks(stocksRes.data.data);
      setFiltered(stocksRes.data.data);
      setSectors(sectorRes.data.data);
    }
    if (summaryRes.data?.success) setSummary(summaryRes.data.data);
    if (oppRes.data?.success) setOpportunities(oppRes.data.data);
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
  applyFilters(stocks, searchTerm, type);
};

const applyFilters = (stockList, search, filterType) => {
  let result = stockList;
  
  // Apply search
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(s =>
      s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }
  
  // Apply filter
  if (filterType === 'BUY') {
    result = result.filter(s => 
      s.signal === 'BUY' || 
      (s.changePercent > 1 && s.volume > s.volAvg10d * 1.2)
    );
  } else if (filterType === 'SELL') {
    result = result.filter(s => 
      s.signal === 'SELL' || 
      (s.changePercent < -1 && s.volume > s.volAvg10d * 1.2)
    );
  }
  
  setFiltered(result);
};

  return (
    <div className="app">
      <MarketBar summary={summary} loading={loading} />
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