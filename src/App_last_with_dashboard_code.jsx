import { useState, useEffect, useRef, useCallback } from 'react';
import MarketBar from './components/MarketBar';
import SearchBar from './components/SearchBar';
import StockCard from './components/StockCard';
import StockModal from './components/StockModal';
import SectorHeatmap from './components/SectorHeatmap';
import TestPanel from './components/TestPanel';
import PredictionSystem from './components/PredictionSystem';


import { getStocks, getMarketSummary, getOpportunities, getSectors, getNewsImpact, getShariahTrades, getInstitutionalActivity, getKSE100VolumeSpeed, getKSE100Volume } from './services/api';
import './App.css';

// ── NEW: PSX session helper ──────────────────────────────────────────────────
const PSX_OPEN_HOUR = 9;
const PSX_OPEN_MIN  = 15;
const PSX_CLOSE_HOUR = 15;
const PSX_CLOSE_MIN  = 30;

function getPSXSessionInfo() {
  const now = new Date();
  // Convert to PKT (UTC+5)
  // FIX: Timezone offset math was inverted — now.getTimezoneOffset() returns
  // the difference between local time and UTC in minutes (positive for
  // timezones behind UTC, negative for ahead). The old formula added the
  // offset when it should be subtracted for correct conversion to PKT.
  const pkt = new Date(now.getTime() + (5 * 60 + now.getTimezoneOffset()) * 60000);
  const day = pkt.getDay(); // 0=Sun, 6=Sat
  const h = pkt.getHours();
  const m = pkt.getMinutes();
  const totalMin = h * 60 + m;
  const openMin  = PSX_OPEN_HOUR  * 60 + PSX_OPEN_MIN;
  const closeMin = PSX_CLOSE_HOUR * 60 + PSX_CLOSE_MIN;

  if (day === 0 || day === 6) {
    return { open: false, label: 'Weekend', countdown: null, pkt };
  }
  if (totalMin < openMin) {
    const diff = openMin - totalMin;
    return { open: false, label: 'Pre-Market', countdown: `${Math.floor(diff/60)}h ${diff%60}m to open`, pkt };
  }
  if (totalMin >= openMin && totalMin < closeMin) {
    const diff = closeMin - totalMin;
    return { open: true, label: 'Market OPEN', countdown: `${Math.floor(diff/60)}h ${diff%60}m left`, pkt };
  }
  return { open: false, label: 'After-Hours', countdown: null, pkt };
}
// ────────────────────────────────────────────────────────────────────────────

function App() {
  const [stocks, setStocks] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [summary, setSummary] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [newsImpact, setNewsImpact] = useState(null);
  const [shariahTrades, setShariahTrades] = useState(null);
  const [instActivity, setInstActivity] = useState(null);
const [kseVolume, setKseVolume] = useState(null);
const [kseSpeed, setKseSpeed] = useState(null);
  const [showPredictionDashboard, setShowPredictionDashboard] = useState(false);

  // ── NEW: Sort, Watchlist, Refresh, Session ───────────────────────────────
  const [sortBy, setSortBy] = useState('DEFAULT');           // sort control
  const [watchlist, setWatchlist] = useState(() => {        // persisted watchlist
    try { return JSON.parse(localStorage.getItem('psx_watchlist') || '[]'); }
    catch { return []; }
  });
  const [lastRefreshed, setLastRefreshed] = useState(null); // last refresh timestamp
  const [refreshCountdown, setRefreshCountdown] = useState(60); // seconds to next refresh
  const [sessionInfo, setSessionInfo] = useState(getPSXSessionInfo()); // market session
  const [isRefreshing, setIsRefreshing] = useState(false);  // manual refresh spinner
  const searchInputRef = useRef(null);                       // for '/' keyboard shortcut
  // ────────────────────────────────────────────────────────────────────────

  const KMI30_SYMBOLS = [
    'AIRLINK', 'ATRL', 'CNERGY', 'CPHL', 'DGKC', 'EFERT', 'ENGROH', 'FCCL',
    'FFC', 'FFL', 'GAL', 'GHNI', 'GLAXO', 'HUBC', 'LUCK', 'MARI', 'MEBL',
    'MLCF', 'MTL', 'NRL', 'OGDC', 'PAEL', 'PPL', 'PRL', 'PSO',
    'SAZEW', 'SEARL', 'SNGP', 'SSGC', 'SYS'
  ];
  const filterRef = useRef('ALL');

  // ── NEW: Session clock — updates every 30s ───────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => setSessionInfo(getPSXSessionInfo()), 30000);
    return () => clearInterval(tick);
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  // ── NEW: Refresh countdown ticker ────────────────────────────────────────
  // FIX: Countdown timer is recreated on every lastRefreshed change, which
  // happens every minute when auto-refresh fires. This creates overlapping
  // intervals that fight each other and cause the countdown to jump
  // erratically. Added a ref to track the interval ID and clear it before
  // starting a new one.
  const countdownRef = useRef(null);
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setRefreshCountdown(60);
    countdownRef.current = setInterval(() => {
      setRefreshCountdown(prev => (prev <= 1 ? 60 : prev - 1));
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [lastRefreshed]);
  // ────────────────────────────────────────────────────────────────────────

  // ── NEW: Keyboard shortcut — press '/' to focus search ───────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        searchInputRef.current?.blur();
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  // ── NEW: Persist watchlist to localStorage on change ─────────────────────
  useEffect(() => {
    localStorage.setItem('psx_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  const toggleWatchlist = useCallback((symbol) => {
    setWatchlist(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [stocksRes, summaryRes, oppRes, sectorRes, newsRes, shariahRes, instRes, speedRes, kseVolRes] = await Promise.all([
  getStocks(), getMarketSummary(), getOpportunities(), getSectors(), getNewsImpact(), getShariahTrades(), getInstitutionalActivity(), getKSE100VolumeSpeed(), getKSE100Volume()
]);

      if (stocksRes.data?.success) {
        const allStocks = stocksRes.data.data;
        setStocks(allStocks);

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
        } else if (currentFilter === 'WATCHLIST') {                // ← NEW
          const wl = JSON.parse(localStorage.getItem('psx_watchlist') || '[]');
          setFiltered(allStocks.filter(s => wl.includes(s.symbol)));
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
if (kseVolRes.data?.success) setKseVolume(kseVolRes.data);

      setLastRefreshed(new Date()); // ← NEW: record refresh time
    } catch (e) {
      console.error('Load failed:', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false); // ← NEW
    }
  };

  // ── NEW: Manual refresh handler ───────────────────────────────────────────
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshCountdown(60);
    await loadData();
  };
  // ────────────────────────────────────────────────────────────────────────

  const handleSearch = (query) => {
    setSearchTerm(query);
    applyFilters(stocks, query, filter);
  };

  const handleFilter = (type) => {
    setFilter(type);
    filterRef.current = type;
    applyFilters(stocks, searchTerm, type);
  };

  // ── NEW: Apply sort on top of filtered results ────────────────────────────
  const applySorting = useCallback((list, sort) => {
    if (sort === 'DEFAULT') return list;
    const sorted = [...list];
    if (sort === 'CHANGE_DESC') return sorted.sort((a, b) => b.changePercent - a.changePercent);
    if (sort === 'CHANGE_ASC')  return sorted.sort((a, b) => a.changePercent - b.changePercent);
    if (sort === 'VOL_DESC')    return sorted.sort((a, b) => b.volume - a.volume);
    // FIX: VOL_RATIO sort used || 1 fallback which gives a ratio of volume when
    // volAvg10d is 0 (missing data). This falsely pushes stocks with missing
    // averages to the top. Changed to guard with > 0 so only stocks with
    // genuine averages compete; missing ones fall to the bottom.
    if (sort === 'VOL_RATIO')   return sorted.sort((a, b) => {
      const aRatio = a.volAvg10d > 0 ? a.volume / a.volAvg10d : -1;
      const bRatio = b.volAvg10d > 0 ? b.volume / b.volAvg10d : -1;
      return bRatio - aRatio;
    });
    if (sort === 'PRICE_DESC')  return sorted.sort((a, b) => b.price - a.price);
    if (sort === 'PRICE_ASC')   return sorted.sort((a, b) => a.price - b.price);
    return sorted;
  }, []);

  const handleSort = (sort) => {
    setSortBy(sort);
    setFiltered(prev => applySorting([...prev], sort));
  };
  // ────────────────────────────────────────────────────────────────────────

  const applyFilters = (stockList, search, filterType) => {
    let result = stockList;

    if (filterType === 'KMI30') {
      result = result.filter(s => KMI30_SYMBOLS.includes(s.symbol));
    }
    if (filterType === 'VOL_SPIKE') {
      result = result.filter(s =>
        s.volume > s.volAvg10d * 2 && s.changePercent > 1
      );
    }
    if (filterType === 'VOL_FALL') {
      result = result.filter(s =>
        s.volume > s.volAvg10d * 2 && s.changePercent < -1
      );
    }
    if (filterType === 'CIRCUIT') {
      result = result.filter(s =>
        s.upperCircuit && s.lowerCircuit &&
        ((s.upperCircuit - s.price) / s.price * 100 < 5 ||
         (s.price - s.lowerCircuit) / s.price * 100 < 5)
      );
    }
    if (filterType === 'ABNORMAL') {
      result = result.filter(s =>
        s.volume > s.volAvg10d * 3
      );
    }
    // ── NEW: Watchlist filter ─────────────────────────────────────────────
    if (filterType === 'WATCHLIST') {
      result = result.filter(s => watchlist.includes(s.symbol));
    }
    // ────────────────────────────────────────────────────────────────────

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      );
    }
    if (filterType === 'BUY') {
      result = result.filter(s =>
        s.signal === 'BUY' || (s.changePercent > 1 && s.volume > s.volAvg10d * 1.2)
      );
    } else if (filterType === 'SELL') {
      result = result.filter(s =>
        s.signal === 'SELL' || (s.changePercent < -1 && s.volume > s.volAvg10d * 1.2)
      );
    }

    setFiltered(applySorting(result, sortBy)); // ← NEW: sort is preserved after filter change
  };

  return (
    <div className="app">
      <MarketBar summary={summary} loading={loading} />

      {/* ── NEW: Session + Refresh Status Bar ──────────────────────────────── */}
      <div className="session-bar">
        <span className={`session-badge ${sessionInfo.open ? 'session-open' : 'session-closed'}`}>
          {sessionInfo.open ? '🟢' : '🔴'} {sessionInfo.label}
          {sessionInfo.countdown && <span className="session-countdown"> · {sessionInfo.countdown}</span>}
        </span>
        <span className="session-pkt">
          PKT {sessionInfo.pkt?.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="refresh-status">
          {lastRefreshed && (
            <span className="last-refreshed">
              Updated {lastRefreshed.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button 
  className="prediction-dashboard-btn"
  onClick={() => setShowPredictionDashboard(true)}
  title="Open Prediction Dashboard"
>
  🎯 Predictions
</button>
          <button
            className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Manual refresh"
          >
            {isRefreshing ? '⏳' : '🔄'} {!isRefreshing && <span className="refresh-countdown">{refreshCountdown}s</span>}
          </button>
        </span>
      </div>
      {/* ──────────────────────────────────────────────────────────────────── */}

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

      {kseVolume && kseSpeed && (
  <div className="kse-live-bar" style={{ borderLeftColor: kseSpeed.color }}>
    <span>{kseVolume.emoji} KSE100: {kseVolume.indexValue?.toLocaleString()}</span>
    <span style={{ color: kseVolume.changePercent > 0 ? '#22c55e' : '#ef4444' }}>
      {kseVolume.changePercent > 0 ? '+' : ''}{kseVolume.changePercent}%
    </span>
    <span>Vol: {kseVolume.ratioVs10Day}% of avg</span>
    <span>⚡ {kseSpeed.trend}: {kseSpeed.perMinute?.toLocaleString()}/min</span>
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
        {/* ── NEW: Watchlist filter button ──────────────────────────────── */}
        <button
          className={`filter-btn watchlist ${filter === 'WATCHLIST' ? 'active' : ''}`}
          onClick={() => handleFilter('WATCHLIST')}
          title={`${watchlist.length} stocks saved`}
        >
          ⭐ Watchlist {watchlist.length > 0 && <span className="watchlist-count">{watchlist.length}</span>}
        </button>
        {/* ────────────────────────────────────────────────────────────── */}
      </div>

      <div className="filter-counts">
        <span style={{ color: '#22c55e' }}>
          🟢 {stocks.filter(s => s.signal === 'BUY' || (s.changePercent > 1 && s.volume > s.volAvg10d * 1.2)).length} Buys
        </span>
        <span style={{ color: '#ef4444' }}>
          🔴 {stocks.filter(s => s.signal === 'SELL' || (s.changePercent < -1 && s.volume > s.volAvg10d * 1.2)).length} Sells
        </span>
      </div>

      {/* ── NEW: Sort controls ─────────────────────────────────────────────── */}
      <div className="sort-bar">
        <span className="sort-label">Sort:</span>
        {[
          { key: 'DEFAULT',     label: '—  Default'     },
          { key: 'CHANGE_DESC', label: '▲ % Change'    },
          { key: 'CHANGE_ASC',  label: '▼ % Change'    },
          { key: 'VOL_DESC',    label: '↑ Volume'      },
          { key: 'VOL_RATIO',   label: '📊 Vol Ratio'  },
          { key: 'PRICE_DESC',  label: '$ High→Low'    },
          { key: 'PRICE_ASC',   label: '$ Low→High'    },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`sort-btn ${sortBy === key ? 'active' : ''}`}
            onClick={() => handleSort(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {/* ──────────────────────────────────────────────────────────────────── */}

      {/* SearchBar — ref forwarded for keyboard shortcut */}
      <SearchBar onSearch={handleSearch} inputRef={searchInputRef} />
      {/* ── NEW: '/' shortcut hint ──────────────────────────────────────── */}
      <div className="search-hint">Press <kbd>/</kbd> to search · <kbd>Esc</kbd> to clear</div>
      {/* ──────────────────────────────────────────────────────────────────── */}

      <div className="stats">
        {filtered.length} stocks | {summary?.gainers || 0} ↑ {summary?.losers || 0} ↓
        {/* ── NEW: show watchlist count in stats ─────────────────────────── */}
        {watchlist.length > 0 && <span className="stat-watchlist"> · ⭐ {watchlist.length} watched</span>}
      </div>

      <div className="stock-grid">
        {filtered.map(stock => (
          <StockCard
            key={stock.symbol}
            stock={stock}
            onClick={() => setSelected(stock)}
            // ── NEW: pass watchlist props to StockCard ───────────────────
            isWatched={watchlist.includes(stock.symbol)}
            onToggleWatch={(e) => { e.stopPropagation(); toggleWatchlist(stock.symbol); }}
            // ────────────────────────────────────────────────────────────
          />
        ))}
      </div>

      {selected && (
        <StockModal
          stock={selected}
          onClose={() => setSelected(null)}
          // ── NEW: pass watchlist props to StockModal ──────────────────
          isWatched={watchlist.includes(selected.symbol)}
          onToggleWatch={() => toggleWatchlist(selected.symbol)}
          // ────────────────────────────────────────────────────────────
        />
      )}
      <TestPanel />
      {showPredictionDashboard && (
  <div className="prediction-dashboard-overlay" onClick={() => setShowPredictionDashboard(false)}>
    <div className="prediction-dashboard-container" onClick={e => e.stopPropagation()}>
      <div className="prediction-dashboard-header">
        <h2>🎯 Prediction Dashboard</h2>
        <button 
          className="new-window-btn"
          onClick={() => window.open('/prediction-dashboard', '_blank', 'width=1200,height=800')}
        >
          🔗 Open in New Window
        </button>
        <button className="close-btn" onClick={() => setShowPredictionDashboard(false)}>✕</button>
      </div>
      <PredictionSystem />
    </div>
  </div>
)}
    </div>
  );
}

export default App;