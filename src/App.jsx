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
  getKSE100VolumeSpeed, getKSE100Volume, getTodayResults
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

// ── INDEX SYMBOL LISTS ──────────────────────────────────────────────────────
const KSE100_SYMBOLS = ['ABL','ABOT','AGP','AGTL','AICL','AIRLINK','AKBL','AMTEX','ANL','APL','ARPL','ASTL','ATLH','ATRL','AVN','BAFL','BAHL','BIPL','BOP','BWCL','CHCC','CNERGY','COLG','CPHL','CSAP','CTM','DADX','DGKC','DOL','EFERT','EFUG','ENGRO','ENGROH','EPCL','FABL','FATIMA','FCCL','FCEPL','FFBL','FFC','FFL','FHAM','FLYNG','GADT','GAL','GATM','GGL','GHGL','GHNI','GLAXO','GRR','GTYR','HABSM','HASCOL','HBL','HCAR','HINO','HINOON','HMB','HUBC','IBFL','ICI','ILP','INDU','ISL','JGICL','JLICL','JSBL','KAPCO','KEL','KOSM','KTML','LOTCHEM','LUCK','MACFL','MARI','MCB','MEBL','MEHT','MLCF','MQM','MTL','MUGHAL','MUREB','MWMP','NATF','NBP','NCL','NCPL','NETSOL','NEXT','NICL','NML','NPL','NRL','OGDC','OLPL','PABC','PAEL','PAKT','PECO','PGLC','PIOC','PKGS','PMI','PNSC','POL','PPL','PRL','PSEL','PSMC','PSO','PTC','QUICE','REDCO','RICL','SAZEW','SBL','SEARL','SEL','SHEL','SHFA','SHNI','SIBL','SITC','SLGL','SML','SNBL','SNGP','SPEL','SRVI','SSGC','STCL','STL','SYS','TATM','TELE','TGL','TOMCL','TPL','TREET','TRG','UBL','UNITY','WAVES','WTL','YOUW','ZIL'];

const KSE30_SYMBOLS = ['ABL','AKBL','ATRL','BAFL','BAHL','BOP','CHCC','DGKC','EFERT','ENGRO','FABL','FATIMA','FCCL','FFBL','FFC','HBL','HUBC','INDU','KAPCO','LUCK','MARI','MCB','MEBL','MLCF','NBP','OGDC','PPL','PSO','SEARL','UBL'];

const KMI30_SYMBOLS = ['AIRLINK','ATRL','CNERGY','CPHL','DGKC','EFERT','ENGROH','FCCL','FFC','FFL','GAL','GHNI','GLAXO','HUBC','LUCK','MARI','MEBL','MLCF','MTL','NRL','OGDC','PAEL','PPL','PRL','PSO','SAZEW','SEARL','SNGP','SSGC','SYS'];

const KMIALLSHR_SYMBOLS = ['AGP','AIRLINK','APL','ASTL','ATLH','ATRL','AVN','BIPL','CHCC','CNERGY','COLG','CPHL','DGKC','EFERT','EFUG','ENGRO','ENGROH','EPCL','FATIMA','FCCL','FCEPL','FFC','FFL','GAL','GATM','GHGL','GHNI','GLAXO','GTYR','HCAR','HINOON','HUBC','ICI','INDU','ISL','KAPCO','KEL','LOTCHEM','LUCK','MARI','MEBL','MLCF','MTL','MUGHAL','MUREB','NATF','NCL','NCPL','NETSOL','NML','NRL','OGDC','PAEL','PIOC','PKGS','POL','PPL','PRL','PSMC','PSO','QUICE','REDCO','SAZEW','SEARL','SHEL','SITC','SNGP','SPEL','SRVI','SSGC','SYS','TGL','TRG','UNITY'];

const BKTI_SYMBOLS = ['ABL','AKBL','BAFL','BAHL','BIPL','BOK','BOP','FABL','HBL','JSBL','MCB','MEBL','NBP','SBL','SNBL','UBL'];

const MZNPI_SYMBOLS = ['AGP','AIRLINK','APL','ASTL','ATLH','ATRL','AVN','BIPL','CHCC','CNERGY','COLG','CPHL','DGKC','EFERT','EFUG','ENGRO','ENGROH','EPCL','FATIMA','FCCL','FCEPL','FFC','FFL','GAL','GATM','GHGL','GHNI','GLAXO','GTYR','HCAR','HINOON','HUBC','ICI','INDU','ISL','KAPCO','KEL','LOTCHEM','LUCK','MARI','MEBL','MLCF','MTL','MUGHAL','MUREB','NATF','NCL','NCPL','NETSOL','NML','NRL','OGDC','PAEL','PIOC','PKGS','POL','PPL','PRL','PSMC','PSO','QUICE','REDCO','SAZEW','SEARL','SHEL','SITC','SNGP','SPEL','SRVI','SSGC','SYS','TGL','TRG','UNITY'];

// ── INDEX MAP ───────────────────────────────────────────────────────────────
const INDEX_MAP = { KSE100: KSE100_SYMBOLS, KSE30: KSE30_SYMBOLS, KMI30: KMI30_SYMBOLS, KMIALLSHR: KMIALLSHR_SYMBOLS, BKTI: BKTI_SYMBOLS, MZNPI: MZNPI_SYMBOLS };

function App() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [stocks,       setStocks]       = useState([]);
  const [filtered,     setFiltered]     = useState([]);
  const [summary,      setSummary]      = useState(null);
  const [opportunities,setOpportunities]= useState([]);
  const [sectors,      setSectors]      = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [loading,      setLoading]      = useState(true);

  // Multi-level filter state
  const [indexFilter,    setIndexFilter]    = useState('ALL');   // Index level
  const [signalFilter,   setSignalFilter]   = useState('ALL');   // Signal level
  const [actionFilter,   setActionFilter]   = useState('ALL');   // Action level

  const [searchTerm,   setSearchTerm]   = useState('');
  const [newsImpact,   setNewsImpact]   = useState(null);
  const [shariahTrades,setShariahTrades]= useState(null);
  const [instActivity, setInstActivity] = useState(null);
  const [kseVolume,    setKseVolume]    = useState(null);
  const [kseSpeed,     setKseSpeed]     = useState(null);
  const [showPredictionDashboard, setShowPredictionDashboard] = useState(false);
  const [todayResults, setTodayResults] = useState(null);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [annFilter, setAnnFilter] = useState('ALL');

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
  const countdownRef = useRef(null);

  // Session clock
  useEffect(() => {
    const t = setInterval(() => setSessionInfo(getPSXSessionInfo()), 30000);
    return () => clearInterval(t);
  }, []);

  // Countdown
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setRefreshCountdown(60);
    countdownRef.current = setInterval(() => setRefreshCountdown(prev => (prev <= 1 ? 60 : prev - 1)), 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [lastRefreshed]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === 'Escape') { searchInputRef.current?.blur(); setSelected(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Persist watchlist
  useEffect(() => { localStorage.setItem('psx_watchlist', JSON.stringify(watchlist)); }, [watchlist]);
  const toggleWatchlist = useCallback((symbol) => { setWatchlist(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]); }, []);

  // Auto-refresh
  useEffect(() => { loadData(); const interval = setInterval(loadData, 60000); return () => clearInterval(interval); }, []);

  // ========== MULTI-LEVEL FILTER ENGINE ==========
  const applyAllFilters = useCallback((stockList) => {
    let result = [...stockList];

    // Level 1: Index filter
    if (indexFilter !== 'ALL' && INDEX_MAP[indexFilter]) {
      result = result.filter(s => INDEX_MAP[indexFilter].includes(s.symbol));
    }

    // Level 2: Signal filter
    if (signalFilter === 'STRONG_BUY')       result = result.filter(s => s.signal === 'STRONG_BUY');
    else if (signalFilter === 'BUY')         result = result.filter(s => s.signal === 'BUY' || s.signal === 'STRONG_BUY');
    else if (signalFilter === 'SELL')        result = result.filter(s => s.signal === 'SELL' || s.signal === 'STRONG_SELL');
    else if (signalFilter === 'STRONG_SELL') result = result.filter(s => s.signal === 'STRONG_SELL');

    // Level 3: Action filter
    if (actionFilter === 'VOL_SPIKE') result = result.filter(s => s.volume > s.volAvg10d * 2 && s.changePercent > 1);
    if (actionFilter === 'VOL_FALL')  result = result.filter(s => s.volume > s.volAvg10d * 2 && s.changePercent < -1);
    if (actionFilter === 'CIRCUIT')   result = result.filter(s => s.upperCircuit && s.lowerCircuit && ((s.upperCircuit - s.price) / s.price * 100 < 5 || (s.price - s.lowerCircuit) / s.price * 100 < 5));
    if (actionFilter === 'ABNORMAL')  result = result.filter(s => s.volume > s.volAvg10d * 3);
    if (actionFilter === 'WATCHLIST') result = result.filter(s => watchlist.includes(s.symbol));

    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }

    // Sort
    return applySorting(result, sortBy);
  }, [indexFilter, signalFilter, actionFilter, searchTerm, sortBy, watchlist]);

  // ========== SORTING ==========
  const applySorting = useCallback((list, sort) => {
    if (sort === 'DEFAULT') return list;
    const s = [...list];
    if (sort === 'CHANGE_DESC') return s.sort((a, b) => b.changePercent - a.changePercent);
    if (sort === 'CHANGE_ASC')  return s.sort((a, b) => a.changePercent - b.changePercent);
    if (sort === 'VOL_DESC')    return s.sort((a, b) => b.volume - a.volume);
    if (sort === 'VOL_RATIO')   return s.sort((a, b) => { const ar = a.volAvg10d > 0 ? a.volume / a.volAvg10d : -1; const br = b.volAvg10d > 0 ? b.volume / b.volAvg10d : -1; return br - ar; });
    if (sort === 'PRICE_DESC')  return s.sort((a, b) => b.price - a.price);
    if (sort === 'PRICE_ASC')   return s.sort((a, b) => a.price - b.price);
    return s;
  }, []);

  // Re-apply filters when any level changes
  useEffect(() => { setFiltered(applyAllFilters(stocks)); }, [stocks, indexFilter, signalFilter, actionFilter, searchTerm, sortBy]);

  const loadData = async () => {
    try {
      const [stocksRes, summaryRes, oppRes, sectorRes, newsRes, shariahRes, instRes, speedRes, kseVolRes, resultsRes] = await Promise.all([
        getStocks(), getMarketSummary(), getOpportunities(), getSectors(),
        getNewsImpact(), getShariahTrades(), getInstitutionalActivity(),
        getKSE100VolumeSpeed(), getKSE100Volume(), getTodayResults()
      ]);
      if (stocksRes.data?.success) {
        setStocks(stocksRes.data.data);
      }
      if (summaryRes.data?.success) setSummary(summaryRes.data.data);
      if (oppRes.data?.success)     setOpportunities(oppRes.data.data);
      if (sectorRes.data?.success)  setSectors(sectorRes.data.data);
      if (newsRes.data?.success)    setNewsImpact(newsRes.data);
      if (shariahRes.data?.success) setShariahTrades(shariahRes.data);
      if (instRes.data?.success)    setInstActivity(instRes.data);
      if (speedRes.data?.success)   setKseSpeed(speedRes.data);
      if (kseVolRes.data?.success)  setKseVolume(kseVolRes.data);
      if (resultsRes.data?.success) setTodayResults(resultsRes.data);
      setLastRefreshed(new Date());
    } catch (e) { console.error('Load failed:', e); }
    finally { setLoading(false); setIsRefreshing(false); }
  };

  const handleManualRefresh = async () => { if (isRefreshing) return; setIsRefreshing(true); setRefreshCountdown(60); await loadData(); };
  const handleSearch = (query) => setSearchTerm(query);

  const handleIndexFilter  = (key) => setIndexFilter(indexFilter === key ? 'ALL' : key);
  const handleSignalFilter = (key) => setSignalFilter(signalFilter === key ? 'ALL' : key);
  const handleActionFilter = (key) => setActionFilter(actionFilter === key ? 'ALL' : key);

  // Derived counts
  const buyCount  = stocks.filter(s => s.signal === 'BUY' || s.signal === 'STRONG_BUY').length;
  const sellCount = stocks.filter(s => s.signal === 'SELL' || s.signal === 'STRONG_SELL').length;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <MarketBar summary={summary} loading={loading} />
        <div className="session-bar">
          <div className="session-left">
            <span className={`session-badge ${sessionInfo.open ? 'session-open' : 'session-closed'}`}>
              {sessionInfo.open ? '🟢' : '🔴'} {sessionInfo.label}
              {sessionInfo.countdown && <span className="session-countdown"> · {sessionInfo.countdown}</span>}
            </span>
            <span className="session-pkt">🕐 PKT {sessionInfo.pkt?.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="session-right">
            {lastRefreshed && <span className="last-refreshed">✓ {lastRefreshed.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
            <button className="prediction-dashboard-btn" onClick={() => setShowPredictionDashboard(true)}>🎯 Predictions</button>
            <button className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`} onClick={handleManualRefresh} disabled={isRefreshing}>
              {isRefreshing ? '⏳ Refreshing…' : `🔄 Refresh`}{!isRefreshing && <span className="refresh-countdown"> ({refreshCountdown}s)</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Intelligence Panel */}
      <section className="intelligence-panel">
        {kseVolume && kseSpeed && (
          <div className="intel-card kse-live-bar" style={{ borderLeftColor: kseSpeed.color }}>
            <span className="intel-tag">KSE-100 LIVE</span>
            <span className="intel-main">{kseVolume.emoji} <strong>{kseVolume.indexValue?.toLocaleString()}</strong>
              <span className="intel-change" style={{ color: kseVolume.changePercent > 0 ? '#22c55e' : '#ef4444' }}>{kseVolume.changePercent > 0 ? '+' : ''}{kseVolume.changePercent}%</span>
            </span>
            <span className="intel-detail">Vol: {kseVolume.ratioVs10Day}% of avg</span>
            <span className="intel-detail">⚡ {kseSpeed.trend}: {kseSpeed.perMinute?.toLocaleString()}/min</span>
            <span className="intel-note">{kseSpeed.message}</span>
          </div>
        )}
        {newsImpact?.aiAnalysis && (
          <div className={`intel-card news-bar ${newsImpact.aiAnalysis.sentiment === 'BULLISH' ? 'bullish' : newsImpact.aiAnalysis.sentiment === 'BEARISH' ? 'bearish' : ''}`}>
            <span className="intel-tag">AI NEWS</span>
            <span className="news-signal-badge" style={{ background: newsImpact.signalMeta?.color || '#666' }}>{newsImpact.signalMeta?.emoji} {newsImpact.aiAnalysis.signal?.replace('_', ' ')}</span>
            <span className="news-summary">{newsImpact.aiAnalysis.summary}</span>
            <span className="news-action">{newsImpact.aiAnalysis.immediateAction}</span>
            <div className="news-chips-row">{newsImpact.aiAnalysis.topTrades?.slice(0, 3).map((t, i) => <span key={i} className="news-trade-chip" style={{ color: t.action === 'BUY' ? '#22c55e' : '#ef4444' }}>{t.ticker} {t.action}</span>)}</div>
          </div>
        )}
        {shariahTrades?.recommendations?.length > 0 && (
          <div className="intel-card shariah-bar">
            <span className="intel-tag">🕌 SHARIAH LONG</span>
            <div className="chips-row">{shariahTrades.recommendations.map((t, i) => <span key={i} className="shariah-chip" style={{ borderColor: t.color, color: t.color }}>{t.symbol} <em>({t.score})</em> {t.recommendation}</span>)}</div>
            {shariahTrades.marketContext && <span className="intel-note">{shariahTrades.marketContext.summary?.slice(0, 80)}</span>}
          </div>
        )}

{todayResults?.hasAnnouncements && (
  <>
    {/* ── COMPACT BAR (click to expand) ── */}
    <div 
      className="results-bar" 
      onClick={() => setShowAnnouncements(!showAnnouncements)}
      style={{ 
        flexWrap: 'wrap', 
        gap: '6px', 
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background 0.2s'
      }}
    >
      <span className="results-title">
        📢 {todayResults.totalAnnouncements} Announcements
        <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: '8px' }}>
          {showAnnouncements ? '▲ click to collapse' : '▼ click to expand'}
        </span>
      </span>
      
      {todayResults.typeCounts?.FR > 0 && (
        <span style={{ fontSize: '0.75rem', background: '#3b82f622', color: '#3b82f6', padding: '2px 8px', borderRadius: '10px' }}>
          📊 {todayResults.typeCounts.FR}
        </span>
      )}
      {todayResults.typeCounts?.MI > 0 && (
        <span style={{ fontSize: '0.75rem', background: '#14b8a622', color: '#14b8a6', padding: '2px 8px', borderRadius: '10px' }}>
          📋 {todayResults.typeCounts.MI}
        </span>
      )}
      {todayResults.typeCounts?.DIV > 0 && (
        <span style={{ fontSize: '0.75rem', background: '#22c55e22', color: '#22c55e', padding: '2px 8px', borderRadius: '10px' }}>
          💰 {todayResults.typeCounts.DIV}
        </span>
      )}
      {todayResults.typeCounts?.BON > 0 && (
        <span style={{ fontSize: '0.75rem', background: '#8b5cf622', color: '#8b5cf6', padding: '2px 8px', borderRadius: '10px' }}>
          🎁 {todayResults.typeCounts.BON}
        </span>
      )}
      {todayResults.typeCounts?.RGT > 0 && (
        <span style={{ fontSize: '0.75rem', background: '#f59e0b22', color: '#f59e0b', padding: '2px 8px', borderRadius: '10px' }}>
          📜 {todayResults.typeCounts.RGT}
        </span>
      )}
      {todayResults.typeCounts?.SPL > 0 && (
        <span style={{ fontSize: '0.75rem', background: '#06b6d422', color: '#06b6d4', padding: '2px 8px', borderRadius: '10px' }}>
          ✂️ {todayResults.typeCounts.SPL}
        </span>
      )}
      {todayResults.typeCounts?.BM > 0 && (
        <span style={{ fontSize: '0.75rem', background: '#6366f122', color: '#6366f1', padding: '2px 8px', borderRadius: '10px' }}>
          📅 {todayResults.typeCounts.BM}
        </span>
      )}
      {todayResults.typeCounts?.AGM > 0 && (
        <span style={{ fontSize: '0.75rem', background: '#ec489922', color: '#ec4899', padding: '2px 8px', borderRadius: '10px' }}>
          🏛️ {todayResults.typeCounts.AGM}
        </span>
      )}
      {todayResults.typeCounts?.E > 0 && (
        <span style={{ fontSize: '0.75rem', background: '#6b728022', color: '#6b7280', padding: '2px 8px', borderRadius: '10px' }}>
          📡 {todayResults.typeCounts.E}
        </span>
      )}

      {todayResults.totalResults > 0 && (
        <>
          <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>🟢 {todayResults.positiveResults}</span>
          <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>🔴 {todayResults.negativeResults}</span>
        </>
      )}

      {/* Top 2 chips always visible */}
      {todayResults.topImpacts?.slice(0, 2).map((r, i) => (
        <span key={i} className="result-chip" style={{ borderColor: r.color, color: r.color, fontSize: '0.8rem' }}>
          {r.typeIcon || ''} {r.symbol}: {r.signal?.slice(0, 30)}
        </span>
      ))}
    </div>

    {/* ── EXPANDED PANEL ── */}
    {showAnnouncements && (
      <div style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '16px',
        marginTop: '8px',
        maxHeight: '70vh',
        overflowY: 'auto'
      }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
          {[
            { key: 'ALL', label: `All (${todayResults.totalAnnouncements})`, icon: '📢' },
            { key: 'FR', label: `Results (${todayResults.typeCounts?.FR || 0})`, icon: '📊', color: '#3b82f6' },
            { key: 'MI', label: `Material Info (${todayResults.typeCounts?.MI || 0})`, icon: '📋', color: '#14b8a6' },
            { key: 'DIV', label: `Dividend (${todayResults.typeCounts?.DIV || 0})`, icon: '💰', color: '#22c55e' },
            { key: 'BON', label: `Bonus (${todayResults.typeCounts?.BON || 0})`, icon: '🎁', color: '#8b5cf6' },
            { key: 'RGT', label: `Rights (${todayResults.typeCounts?.RGT || 0})`, icon: '📜', color: '#f59e0b' },
            { key: 'SPL', label: `Split (${todayResults.typeCounts?.SPL || 0})`, icon: '✂️', color: '#06b6d4' },
            { key: 'BM', label: `Board (${todayResults.typeCounts?.BM || 0})`, icon: '📅', color: '#6366f1' },
            { key: 'AGM', label: `AGM (${todayResults.typeCounts?.AGM || 0})`, icon: '🏛️', color: '#ec4899' },
            { key: 'E', label: `Notices (${todayResults.typeCounts?.E || 0})`, icon: '📡', color: '#6b7280' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={(e) => { e.stopPropagation(); setAnnFilter(tab.key); }}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: annFilter === tab.key ? (tab.color || '#3b82f6') : '#1e293b',
                color: annFilter === tab.key ? '#fff' : '#94a3b8',
                transition: 'all 0.2s'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Announcement cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(annFilter === 'ALL' 
            ? todayResults.announcements 
            : todayResults.byType?.[annFilter] || []
          ).map(a => (
            <div key={a.id} style={{
              background: '#1e293b',
              borderLeft: `4px solid ${a.color || a.typeColor || '#64748b'}`,
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#fff' }}>{a.symbol}</span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    background: (a.typeColor || '#64748b') + '22',
                    color: a.typeColor || '#64748b',
                    border: `1px solid ${(a.typeColor || '#64748b')}44`,
                    fontWeight: 600
                  }}>
                    {a.typeIcon} {a.typeLabel}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {new Date(a.date).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: a.score > 0 ? '#22c55e' : a.score < 0 ? '#ef4444' : '#94a3b8'
                }}>
                  {a.score > 0 ? '+' : ''}{a.score}
                </span>
              </div>

              {/* Full signal text — wraps naturally */}
              <div style={{ color: '#e2e8f0', fontSize: '0.95rem', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {a.signal}
              </div>

              {/* Details */}
              {a.details?.materialSubject && (
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  Subject: {a.details.materialSubject}
                </div>
              )}
              {a.details?.eps !== undefined && (
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                  <span>EPS: {a.details.eps}</span>
                  <span>Prev: {a.details.epsPrev}</span>
                  <span>PAT: {(a.details.pat / 1000000).toFixed(1)}M</span>
                  {a.details.epsChange !== 0 && (
                    <span style={{ color: a.details.epsChange > 0 ? '#22c55e' : '#ef4444' }}>
                      Change: {a.details.epsChange}
                    </span>
                  )}
                </div>
              )}
              {a.details?.dividend > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#22c55e' }}>
                  💰 Dividend: {a.details.dividend}% | Ex-Date: {a.details.exDate || 'TBA'}
                </div>
              )}
              {a.details?.bonus > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#8b5cf6' }}>
                  🎁 Bonus: {a.details.bonus}%
                </div>
              )}
              {a.details?.rightPrice > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>
                  📜 Rights: {a.details.rightIssue} @ PKR {a.details.rightPrice}
                </div>
              )}
              {a.details?.meetingTime && (
                <div style={{ fontSize: '0.8rem', color: '#6366f1' }}>
                  📅 Meeting: {a.details.meetingTime} {a.details.meetingDate ? `| ${a.details.meetingDate}` : ''}
                </div>
              )}
              {a.details?.matchedKeywords?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {a.details.matchedKeywords.map((kw, i) => (
                    <span key={i} style={{ fontSize: '0.7rem', background: '#0f172a', color: '#64748b', padding: '2px 8px', borderRadius: '10px' }}>
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                {a.pdf && (
                  <a 
                    href={`https://dps.psx.com.pk/download/document/${a.pdf}`} 
                    target="_blank" 
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: '0.75rem', color: '#60a5fa', textDecoration: 'none' }}
                  >
                    📄 PDF
                  </a>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelected(a.symbol); }}
                  style={{ 
                    fontSize: '0.75rem', 
                    color: '#94a3b8', 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  📈 View Stock
                </button>
              </div>
            </div>
          ))}
        </div>

        {((annFilter === 'ALL' ? todayResults.announcements : todayResults.byType?.[annFilter]) || []).length === 0 && (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
            No announcements in this category
          </div>
        )}
      </div>
    )}
  </>
)}

        {instActivity && (
          <div className="intel-card inst-bar" style={{ borderLeftColor: instActivity.color }}>
            <span className="intel-tag">🏢 INSTITUTIONAL</span>
            <span className="intel-main">{instActivity.signal}</span>
            <span className="intel-detail">Vol: {instActivity.today.volume?.toLocaleString()} | σ: {instActivity.volumeSigma}</span>
            {instActivity.bullishTrigger && <span className="trigger-pill">🟢 Institutions buying</span>}
            <span className="intel-note">{instActivity.recommendation}</span>
          </div>
        )}
      </section>

      {/* Sector + Top Movers */}
      <section className="overview-section">
        <div className="overview-row">
          <div className="overview-block sectors-block"><div className="panel-section-label">🗺️ Sector Heatmap</div><SectorHeatmap sectors={sectors} /></div>
          {opportunities.length > 0 && (
            <div className="overview-block movers-block"><div className="panel-section-label">🔥 Top Movers</div>
              <div className="chips-row movers-chips">{opportunities.slice(0, 5).map(o => <button key={o.symbol} className="opp-chip" style={{ color: o.changePercent > 0 ? '#22c55e' : '#ef4444' }} onClick={() => setSelected(o)}>{o.symbol} {o.changePercent > 0 ? '+' : ''}{o.changePercent}%</button>)}</div>
            </div>
          )}
        </div>
      </section>

      {/* CONTROLS */}
      <section className="controls-section">
        <div className="control-block search-block">
          <div className="control-block-label">🔍 Search Stock</div>
          <SearchBar onSearch={handleSearch} inputRef={searchInputRef} />
          <div className="search-hint">Press <kbd>/</kbd> to focus · <kbd>Esc</kbd> to clear</div>
        </div>

        {/* LEVEL 1: Index Filter */}
        <div className="control-block filter-block">
          <div className="control-block-label">📊 Index <span className="active-badge">{indexFilter !== 'ALL' ? indexFilter : ''}</span></div>
          <div className="filter-bar">
            {[{ key: 'ALL', icon: '📋', label: 'All' },{ key: 'KSE100', icon: '🏛️', label: 'KSE-100', cls: 'kse' },{ key: 'KSE30', icon: '📈', label: 'KSE-30', cls: 'kse' },{ key: 'KMI30', icon: '🏦', label: 'KMI-30', cls: 'kmi' },{ key: 'KMIALLSHR', icon: '🕌', label: 'KMI-All', cls: 'kmi' },{ key: 'BKTI', icon: '🏦', label: 'Banks', cls: 'bank' },{ key: 'MZNPI', icon: '📊', label: 'Meezan', cls: 'mzn' }].map(({ key, icon, label, cls = '' }) => (
              <button key={key} className={`filter-btn ${cls} ${indexFilter === key ? 'active' : ''}`} onClick={() => handleIndexFilter(key)}>{icon} {label}</button>
            ))}
          </div>
        </div>

        {/* LEVEL 2: Signal Filter */}
        <div className="control-block filter-block">
          <div className="control-block-label">📶 Signal <span className="count-pill green">▲ {buyCount}</span><span className="count-pill red">▼ {sellCount}</span></div>
          <div className="filter-bar">
            {[{ key: 'ALL', icon: '📋', label: 'All Signals' },{ key: 'STRONG_BUY', icon: '🟢🟢', label: 'Strong Buy', cls: 'strong-buy' },{ key: 'BUY', icon: '🟢', label: 'Buy', cls: 'buy' },{ key: 'SELL', icon: '🔴', label: 'Sell', cls: 'sell' },{ key: 'STRONG_SELL', icon: '🔴🔴', label: 'Strong Sell', cls: 'strong-sell' }].map(({ key, icon, label, cls = '' }) => (
              <button key={key} className={`filter-btn ${cls} ${signalFilter === key ? 'active' : ''}`} onClick={() => handleSignalFilter(key)}>{icon} {label}</button>
            ))}
          </div>
        </div>

        {/* LEVEL 3: Action Filter */}
        <div className="control-block filter-block">
          <div className="control-block-label">⚡ Action</div>
          <div className="filter-bar">
            {[{ key: 'ALL', icon: '📋', label: 'All' },{ key: 'VOL_SPIKE', icon: '🚀', label: 'Vol Spike', cls: 'spike' },{ key: 'VOL_FALL', icon: '📉', label: 'Vol Fall', cls: 'fall' },{ key: 'CIRCUIT', icon: '⚡', label: 'Circuit', cls: 'circuit' },{ key: 'ABNORMAL', icon: '🔴', label: 'Abnormal', cls: 'abnormal' },{ key: 'WATCHLIST', icon: '⭐', label: `Watchlist${watchlist.length > 0 ? ` (${watchlist.length})` : ''}`, cls: 'watchlist' }].map(({ key, icon, label, cls = '' }) => (
              <button key={key} className={`filter-btn ${cls} ${actionFilter === key ? 'active' : ''}`} onClick={() => handleActionFilter(key)}>{icon} {label}</button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="control-block sort-block">
          <div className="control-block-label">↕️ Sort By</div>
          <div className="sort-bar">
            {[{ key: 'DEFAULT', label: '— Default' },{ key: 'CHANGE_DESC', label: '▲ % Change' },{ key: 'CHANGE_ASC', label: '▼ % Change' },{ key: 'VOL_DESC', label: '↑ Volume' },{ key: 'VOL_RATIO', label: '📊 Vol Ratio' },{ key: 'PRICE_DESC', label: '💰 High→Low' },{ key: 'PRICE_ASC', label: '💰 Low→High' }].map(({ key, label }) => (
              <button key={key} className={`sort-btn ${sortBy === key ? 'active' : ''}`} onClick={() => setSortBy(key)}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      {/* STOCK GRID */}
      <main className="stocks-section">
        <div className="results-strip">
          <span className="results-count">Showing <strong>{filtered.length}</strong> stocks</span>
          <span className="results-market"><span className="adv">▲ {summary?.gainers || 0}</span> <span className="decl">▼ {summary?.losers || 0}</span></span>
          {watchlist.length > 0 && <span className="results-watchlist">⭐ <strong>{watchlist.length}</strong></span>}
        </div>
        <div className="stock-grid">
          {filtered.map(stock => <StockCard key={stock.symbol} stock={stock} onClick={() => setSelected(stock)} isWatched={watchlist.includes(stock.symbol)} onToggleWatch={(e) => { e.stopPropagation(); toggleWatchlist(stock.symbol); }} />)}
        </div>
      </main>

      {/* MODALS */}
      {selected && <StockModal stock={selected} onClose={() => setSelected(null)} isWatched={watchlist.includes(selected.symbol)} onToggleWatch={() => toggleWatchlist(selected.symbol)} />}
      <TestPanel />
      {showPredictionDashboard && (
        <div className="prediction-dashboard-overlay" onClick={() => setShowPredictionDashboard(false)}>
          <div className="prediction-dashboard-container" onClick={e => e.stopPropagation()}>
            <div className="prediction-dashboard-header"><h2>🎯 Prediction Dashboard</h2><button className="new-window-btn" onClick={() => window.open('/prediction-dashboard', '_blank', 'width=1200,height=800')}>🔗 Open in New Window</button><button className="close-btn" onClick={() => setShowPredictionDashboard(false)}>✕</button></div>
            <PredictionSystem />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;