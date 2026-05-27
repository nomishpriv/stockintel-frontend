import { useState, useEffect, useRef, useCallback } from 'react';
import MarketBar from './components/MarketBar';
import SearchBar from './components/SearchBar';
import StockCard from './components/StockCard';
import StockModal from './components/StockModal';
import SectorHeatmap from './components/SectorHeatmap';
import TestPanel from './components/TestPanel';
import PredictionSystem from './components/PredictionSystem';

import {
  getStocks, getMarketSummary, getOpportunities, getSectors,
  getNewsImpact, getShariahTrades, getInstitutionalActivity,
  getKSE100VolumeSpeed, getKSE100Volume
} from './services/api';
import './App.css';

// ── PSX session helper ──────────────────────────────────────────────────────
const PSX_OPEN_HOUR  = 9,  PSX_OPEN_MIN  = 15;
const PSX_CLOSE_HOUR = 15, PSX_CLOSE_MIN = 30;

function getPSXSessionInfo() {
  const now = new Date();
  const pkt = new Date(now.getTime() + (5 * 60 + now.getTimezoneOffset()) * 60000);
  const day = pkt.getDay();
  const totalMin  = pkt.getHours() * 60 + pkt.getMinutes();
  const openMin   = PSX_OPEN_HOUR  * 60 + PSX_OPEN_MIN;
  const closeMin  = PSX_CLOSE_HOUR * 60 + PSX_CLOSE_MIN;

  if (day === 0 || day === 6)
    return { open: false, label: 'Weekend', countdown: null, pkt };
  if (totalMin < openMin) {
    const diff = openMin - totalMin;
    return { open: false, label: 'Pre-Market', countdown: `${Math.floor(diff/60)}h ${diff%60}m to open`, pkt };
  }
  if (totalMin >= openMin && totalMin < closeMin) {
    const diff = closeMin - totalMin;
    return { open: true,  label: 'Market OPEN', countdown: `${Math.floor(diff/60)}h ${diff%60}m left`, pkt };
  }
  return { open: false, label: 'After-Hours', countdown: null, pkt };
}
// ───────────────────────────────────────────────────────────────────────────

function App() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [stocks,       setStocks]       = useState([]);
  const [filtered,     setFiltered]     = useState([]);
  const [summary,      setSummary]      = useState(null);
  const [opportunities,setOpportunities]= useState([]);
  const [sectors,      setSectors]      = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('ALL');
  const [searchTerm,   setSearchTerm]   = useState('');
  const [newsImpact,   setNewsImpact]   = useState(null);
  const [shariahTrades,setShariahTrades]= useState(null);
  const [instActivity, setInstActivity] = useState(null);
  const [kseVolume,    setKseVolume]    = useState(null);
  const [kseSpeed,     setKseSpeed]     = useState(null);
  const [showPredictionDashboard, setShowPredictionDashboard] = useState(false);

  const [sortBy,    setSortBy]    = useState('DEFAULT');
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('psx_watchlist') || '[]'); }
    catch { return []; }
  });
  const [lastRefreshed,    setLastRefreshed]    = useState(null);
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const [sessionInfo,      setSessionInfo]      = useState(getPSXSessionInfo());
  const [isRefreshing,     setIsRefreshing]     = useState(false);
  const searchInputRef = useRef(null);
  // ─────────────────────────────────────────────────────────────────────────

  const KMI30_SYMBOLS = [
    'AIRLINK','ATRL','CNERGY','CPHL','DGKC','EFERT','ENGROH','FCCL',
    'FFC','FFL','GAL','GHNI','GLAXO','HUBC','LUCK','MARI','MEBL',
    'MLCF','MTL','NRL','OGDC','PAEL','PPL','PRL','PSO',
    'SAZEW','SEARL','SNGP','SSGC','SYS'
  ];
  const filterRef    = useRef('ALL');
  const countdownRef = useRef(null);

  // Session clock ticks every 30s
  useEffect(() => {
    const t = setInterval(() => setSessionInfo(getPSXSessionInfo()), 30000);
    return () => clearInterval(t);
  }, []);

  // Countdown resets after each refresh
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setRefreshCountdown(60);
    countdownRef.current = setInterval(() =>
      setRefreshCountdown(prev => (prev <= 1 ? 60 : prev - 1)), 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [lastRefreshed]);

  // '/' focuses search, Esc clears
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') { searchInputRef.current?.blur(); setSelected(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Persist watchlist
  useEffect(() => {
    localStorage.setItem('psx_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  const toggleWatchlist = useCallback((symbol) => {
    setWatchlist(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [stocksRes, summaryRes, oppRes, sectorRes, newsRes, shariahRes, instRes, speedRes, kseVolRes] =
        await Promise.all([
          getStocks(), getMarketSummary(), getOpportunities(), getSectors(),
          getNewsImpact(), getShariahTrades(), getInstitutionalActivity(),
          getKSE100VolumeSpeed(), getKSE100Volume()
        ]);

      if (stocksRes.data?.success) {
        const allStocks = stocksRes.data.data;
        setStocks(allStocks);
        const cf = filterRef.current;
        if      (cf === 'KMI30')    setFiltered(allStocks.filter(s => KMI30_SYMBOLS.includes(s.symbol)));
        else if (cf === 'BUY')      setFiltered(allStocks.filter(s => s.signal === 'BUY' || (s.changePercent > 1 && s.volume > s.volAvg10d * 1.2)));
        else if (cf === 'SELL')     setFiltered(allStocks.filter(s => s.signal === 'SELL' || (s.changePercent < -1 && s.volume > s.volAvg10d * 1.2)));
        else if (cf === 'VOL_SPIKE')setFiltered(allStocks.filter(s => s.volume > s.volAvg10d * 2 && s.changePercent > 1));
        else if (cf === 'VOL_FALL') setFiltered(allStocks.filter(s => s.volume > s.volAvg10d * 2 && s.changePercent < -1));
        else if (cf === 'CIRCUIT')  setFiltered(allStocks.filter(s => s.upperCircuit && s.lowerCircuit && ((s.upperCircuit - s.price) / s.price * 100 < 5 || (s.price - s.lowerCircuit) / s.price * 100 < 5)));
        else if (cf === 'ABNORMAL') setFiltered(allStocks.filter(s => s.volume > s.volAvg10d * 3));
        else if (cf === 'WATCHLIST') {
          const wl = JSON.parse(localStorage.getItem('psx_watchlist') || '[]');
          setFiltered(allStocks.filter(s => wl.includes(s.symbol)));
        } else setFiltered(allStocks);
      }
      if (summaryRes.data?.success) setSummary(summaryRes.data.data);
      if (oppRes.data?.success)     setOpportunities(oppRes.data.data);
      if (sectorRes.data?.success)  setSectors(sectorRes.data.data);
      if (newsRes.data?.success)    setNewsImpact(newsRes.data);
      if (shariahRes.data?.success) setShariahTrades(shariahRes.data);
      if (instRes.data?.success)    setInstActivity(instRes.data);
      if (speedRes.data?.success)   setKseSpeed(speedRes.data);
      if (kseVolRes.data?.success)  setKseVolume(kseVolRes.data);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error('Load failed:', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshCountdown(60);
    await loadData();
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

  const applySorting = useCallback((list, sort) => {
    if (sort === 'DEFAULT') return list;
    const s = [...list];
    if (sort === 'CHANGE_DESC') return s.sort((a, b) => b.changePercent - a.changePercent);
    if (sort === 'CHANGE_ASC')  return s.sort((a, b) => a.changePercent - b.changePercent);
    if (sort === 'VOL_DESC')    return s.sort((a, b) => b.volume - a.volume);
    if (sort === 'VOL_RATIO')   return s.sort((a, b) => {
      const ar = a.volAvg10d > 0 ? a.volume / a.volAvg10d : -1;
      const br = b.volAvg10d > 0 ? b.volume / b.volAvg10d : -1;
      return br - ar;
    });
    if (sort === 'PRICE_DESC')  return s.sort((a, b) => b.price - a.price);
    if (sort === 'PRICE_ASC')   return s.sort((a, b) => a.price - b.price);
    return s;
  }, []);

  const handleSort = (sort) => {
    setSortBy(sort);
    setFiltered(prev => applySorting([...prev], sort));
  };

  const applyFilters = (stockList, search, filterType) => {
    let result = stockList;
    if (filterType === 'KMI30')     result = result.filter(s => KMI30_SYMBOLS.includes(s.symbol));
    if (filterType === 'VOL_SPIKE') result = result.filter(s => s.volume > s.volAvg10d * 2 && s.changePercent > 1);
    if (filterType === 'VOL_FALL')  result = result.filter(s => s.volume > s.volAvg10d * 2 && s.changePercent < -1);
    if (filterType === 'CIRCUIT')   result = result.filter(s => s.upperCircuit && s.lowerCircuit && ((s.upperCircuit - s.price) / s.price * 100 < 5 || (s.price - s.lowerCircuit) / s.price * 100 < 5));
    if (filterType === 'ABNORMAL')  result = result.filter(s => s.volume > s.volAvg10d * 3);
    if (filterType === 'WATCHLIST') result = result.filter(s => watchlist.includes(s.symbol));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    if (filterType === 'BUY')       result = result.filter(s => s.signal === 'BUY' || (s.changePercent > 1 && s.volume > s.volAvg10d * 1.2));
    else if (filterType === 'SELL') result = result.filter(s => s.signal === 'SELL' || (s.changePercent < -1 && s.volume > s.volAvg10d * 1.2));
    setFiltered(applySorting(result, sortBy));
  };

  // Derived counts for header badges
  const buyCount  = stocks.filter(s => s.signal === 'BUY'  || (s.changePercent > 1  && s.volume > s.volAvg10d * 1.2)).length;
  const sellCount = stocks.filter(s => s.signal === 'SELL' || (s.changePercent < -1 && s.volume > s.volAvg10d * 1.2)).length;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* ════════════════════════════════════════════════════════════════════
          ZONE A — STICKY HEADER: Market Ticker + Session Status + Actions
          ════════════════════════════════════════════════════════════════════ */}
      <header className="app-header">

        {/* Market index ticker strip */}
        <MarketBar summary={summary} loading={loading} />

        {/* Session & refresh control row */}
        <div className="session-bar">

          {/* Left: market open/closed indicator */}
          <div className="session-left">
            <span className={`session-badge ${sessionInfo.open ? 'session-open' : 'session-closed'}`}>
              {sessionInfo.open ? '🟢' : '🔴'} {sessionInfo.label}
              {sessionInfo.countdown &&
                <span className="session-countdown"> · {sessionInfo.countdown}</span>
              }
            </span>
            <span className="session-pkt">
              🕐 PKT {sessionInfo.pkt?.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Right: refresh + prediction controls */}
          <div className="session-right">
            {lastRefreshed && (
              <span className="last-refreshed" title="Last data refresh time">
                ✓ {lastRefreshed.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
              title="Refresh market data now"
            >
              {isRefreshing ? '⏳ Refreshing…' : `🔄 Refresh`}
              {!isRefreshing && <span className="refresh-countdown"> ({refreshCountdown}s)</span>}
            </button>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════════
          ZONE B — LIVE INTELLIGENCE PANEL: KSE stats, News, Shariah, Inst.
          ════════════════════════════════════════════════════════════════════ */}
      <section className="intelligence-panel">
        <div className="panel-section-label">📡 Live Market Intelligence</div>

        {/* KSE-100 Live Volume & Speed */}
        {kseVolume && kseSpeed && (
          <div className="intel-card kse-live-bar" style={{ borderLeftColor: kseSpeed.color }}>
            <span className="intel-tag">KSE-100 LIVE</span>
            <span className="intel-main">
              {kseVolume.emoji} <strong>{kseVolume.indexValue?.toLocaleString()}</strong>
              <span
                className="intel-change"
                style={{ color: kseVolume.changePercent > 0 ? '#22c55e' : '#ef4444' }}
              >
                {kseVolume.changePercent > 0 ? '+' : ''}{kseVolume.changePercent}%
              </span>
            </span>
            <span className="intel-detail">Vol: {kseVolume.ratioVs10Day}% of avg</span>
            <span className="intel-detail">⚡ {kseSpeed.trend}: {kseSpeed.perMinute?.toLocaleString()}/min</span>
            <span className="intel-note">{kseSpeed.message}</span>
          </div>
        )}

        {/* AI News Sentiment */}
        {newsImpact?.aiAnalysis && (
          <div className={`intel-card news-bar ${newsImpact.aiAnalysis.sentiment === 'BULLISH' ? 'bullish' : newsImpact.aiAnalysis.sentiment === 'BEARISH' ? 'bearish' : ''}`}>
            <span className="intel-tag">AI NEWS</span>
            <span
              className="news-signal-badge"
              style={{ background: newsImpact.signalMeta?.color || '#666' }}
            >
              {newsImpact.signalMeta?.emoji} {newsImpact.aiAnalysis.signal?.replace('_', ' ')}
            </span>
            <span className="news-summary">{newsImpact.aiAnalysis.summary}</span>
            <span className="news-action">{newsImpact.aiAnalysis.immediateAction}</span>
            <div className="news-chips-row">
              {newsImpact.aiAnalysis.topTrades?.slice(0, 3).map((t, i) => (
                <span
                  key={i}
                  className="news-trade-chip"
                  style={{ color: t.action === 'BUY' ? '#22c55e' : '#ef4444' }}
                >
                  {t.ticker} {t.action}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Shariah-compliant long trades */}
        {shariahTrades?.recommendations?.length > 0 && (
          <div className="intel-card shariah-bar">
            <span className="intel-tag">🕌 SHARIAH LONG</span>
            <div className="chips-row">
              {shariahTrades.recommendations.map((t, i) => (
                <span
                  key={i}
                  className="shariah-chip"
                  style={{ borderColor: t.color, color: t.color }}
                >
                  {t.symbol} <em>({t.score})</em> {t.recommendation}
                </span>
              ))}
            </div>
            {shariahTrades.marketContext && (
              <span className="intel-note">{shariahTrades.marketContext.summary?.slice(0, 80)}</span>
            )}
          </div>
        )}

        {/* Institutional activity */}
        {instActivity && (
          <div className="intel-card inst-bar" style={{ borderLeftColor: instActivity.color }}>
            <span className="intel-tag">🏢 INSTITUTIONAL</span>
            <span className="intel-main">{instActivity.signal}</span>
            <span className="intel-detail">
              Vol: {instActivity.today.volume?.toLocaleString()} &nbsp;|&nbsp; σ: {instActivity.volumeSigma}
            </span>
            {instActivity.bullishTrigger && (
              <span className="trigger-pill">🟢 Institutions buying</span>
            )}
            <span className="intel-note">{instActivity.recommendation}</span>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          ZONE C — SECTOR HEATMAP + TOP MOVERS
          ════════════════════════════════════════════════════════════════════ */}
      <section className="overview-section">
        <div className="overview-row">

          {/* Sector heatmap */}
          <div className="overview-block sectors-block">
            <div className="panel-section-label">🗺️ Sector Heatmap</div>
            <SectorHeatmap sectors={sectors} />
          </div>

          {/* Top movers quick-jump */}
          {opportunities.length > 0 && (
            <div className="overview-block movers-block">
              <div className="panel-section-label">🔥 Top Movers</div>
              <div className="chips-row movers-chips">
                {opportunities.slice(0, 5).map(o => (
                  <button
                    key={o.symbol}
                    className="opp-chip"
                    style={{ color: o.changePercent > 0 ? '#22c55e' : '#ef4444' }}
                    onClick={() => setSelected(o)}
                    title={`View ${o.symbol} details`}
                  >
                    {o.symbol} {o.changePercent > 0 ? '+' : ''}{o.changePercent}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          ZONE D — CONTROLS: Search → Filter → Sort (top-to-bottom priority)
          ════════════════════════════════════════════════════════════════════ */}
      <section className="controls-section">

        {/* Search box */}
        <div className="control-block search-block">
          <div className="control-block-label">🔍 Search Stock</div>
          <SearchBar onSearch={handleSearch} inputRef={searchInputRef} />
          <div className="search-hint">
            Press <kbd>/</kbd> to focus · <kbd>Esc</kbd> to clear
          </div>
        </div>

        {/* Filter buttons */}
        <div className="control-block filter-block">
          <div className="control-block-label">
            ⚙️ Filter &nbsp;
            <span className="count-pill green">▲ {buyCount} Buys</span>
            <span className="count-pill red">▼ {sellCount} Sells</span>
          </div>
          <div className="filter-bar">
            {[
              { key: 'ALL',       icon: '📋', label: 'All'          },
              { key: 'BUY',       icon: '🟢', label: 'Buy Signals', cls: 'buy'      },
              { key: 'SELL',      icon: '🔴', label: 'Sell Signals',cls: 'sell'     },
              { key: 'KMI30',     icon: '🏦', label: 'KMI-30',      cls: 'kmi'      },
              { key: 'VOL_SPIKE', icon: '🚀', label: 'Vol Spike',   cls: 'spike'    },
              { key: 'VOL_FALL',  icon: '📉', label: 'Vol Fall',    cls: 'fall'     },
              { key: 'CIRCUIT',   icon: '⚡', label: 'Near Circuit',cls: 'circuit'  },
              { key: 'ABNORMAL',  icon: '🔴', label: 'Abnormal Vol',cls: 'abnormal' },
            ].map(({ key, icon, label, cls = '' }) => (
              <button
                key={key}
                className={`filter-btn ${cls} ${filter === key ? 'active' : ''}`}
                onClick={() => handleFilter(key)}
              >
                {icon} {label}
              </button>
            ))}
            {/* Watchlist filter — separate so badge is visible */}
            <button
              className={`filter-btn watchlist ${filter === 'WATCHLIST' ? 'active' : ''}`}
              onClick={() => handleFilter('WATCHLIST')}
              title={`${watchlist.length} stocks saved`}
            >
              ⭐ Watchlist
              {watchlist.length > 0 && (
                <span className="watchlist-count">{watchlist.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Sort buttons */}
        <div className="control-block sort-block">
          <div className="control-block-label">↕️ Sort By</div>
          <div className="sort-bar">
            {[
              { key: 'DEFAULT',     label: '— Default'    },
              { key: 'CHANGE_DESC', label: '▲ % Change'   },
              { key: 'CHANGE_ASC',  label: '▼ % Change'   },
              { key: 'VOL_DESC',    label: '↑ Volume'     },
              { key: 'VOL_RATIO',   label: '📊 Vol Ratio' },
              { key: 'PRICE_DESC',  label: '💰 High→Low'  },
              { key: 'PRICE_ASC',   label: '💰 Low→High'  },
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
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          ZONE E — RESULTS HEADER + STOCK GRID
          ════════════════════════════════════════════════════════════════════ */}
      <main className="stocks-section">

        {/* Results summary strip */}
        <div className="results-strip">
          <span className="results-count">
            Showing <strong>{filtered.length}</strong> stocks
          </span>
          <span className="results-market">
            <span className="adv">▲ {summary?.gainers || 0} Advancing</span>
            <span className="decl">▼ {summary?.losers  || 0} Declining</span>
          </span>
          {watchlist.length > 0 && (
            <span className="results-watchlist">
              ⭐ Tracking <strong>{watchlist.length}</strong>
            </span>
          )}
        </div>

        {/* Stock cards grid */}
        <div className="stock-grid">
          {filtered.map(stock => (
            <StockCard
              key={stock.symbol}
              stock={stock}
              onClick={() => setSelected(stock)}
              isWatched={watchlist.includes(stock.symbol)}
              onToggleWatch={(e) => { e.stopPropagation(); toggleWatchlist(stock.symbol); }}
            />
          ))}
        </div>
      </main>

      {/* ════════════════════════════════════════════════════════════════════
          ZONE F — MODALS & OVERLAYS
          ════════════════════════════════════════════════════════════════════ */}
      {selected && (
        <StockModal
          stock={selected}
          onClose={() => setSelected(null)}
          isWatched={watchlist.includes(selected.symbol)}
          onToggleWatch={() => toggleWatchlist(selected.symbol)}
        />
      )}

      <TestPanel />

      {showPredictionDashboard && (
        <div
          className="prediction-dashboard-overlay"
          onClick={() => setShowPredictionDashboard(false)}
        >
          <div
            className="prediction-dashboard-container"
            onClick={e => e.stopPropagation()}
          >
            <div className="prediction-dashboard-header">
              <h2>🎯 Prediction Dashboard</h2>
              <button
                className="new-window-btn"
                onClick={() => window.open('/prediction-dashboard', '_blank', 'width=1200,height=800')}
              >
                🔗 Open in New Window
              </button>
              <button
                className="close-btn"
                onClick={() => setShowPredictionDashboard(false)}
              >
                ✕
              </button>
            </div>
            <PredictionSystem />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;