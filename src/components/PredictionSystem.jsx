import { useState, useEffect, useCallback } from 'react';
import { 
  getPredictions, 
  createPrediction, 
  checkPrediction, 
  getAccuracy, 
  getAllAccuracies,
  getStocks 
} from '../services/api';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const SIGNAL_COLORS = {
  STRONG_BUY:  { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  BUY:         { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  HOLD:        { bg: '#fef9c3', text: '#854d0e', border: '#eab308' },
  SELL:        { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  STRONG_SELL: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
};

const RESULT_BADGES = {
  WIN:  { bg: '#22c55e', text: '#fff', label: '✅ WIN' },
  LOSS: { bg: '#ef4444', text: '#fff', label: '❌ LOSS' },
  PENDING: { bg: '#64748b', text: '#fff', label: '⏳ PENDING' },
};

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
}

function formatAge(iso) {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function PredictionCard({ pred, onCheck, onDelete }) {
  const [checking, setChecking] = useState(false);
  
  const handleCheck = async () => {
    setChecking(true);
    await onCheck(pred.symbol);
    setChecking(false);
  };

  const pivotResult = pred.pivot?.result || 'PENDING';
  const atrResult = pred.atr?.result || 'PENDING';
  const isResolved = pred.checked;

  return (
    <div className={`pred-card ${isResolved ? 'resolved' : 'active'}`}>
      <div className="pred-header">
        <span className="pred-symbol">{pred.symbol}</span>
        <span className="pred-age">{formatAge(pred.pivot?.createdAt)}</span>
        {!isResolved && (
          <button 
            className={`check-btn ${checking ? 'spinning' : ''}`}
            onClick={handleCheck}
            disabled={checking}
            title="Check against live price"
          >
            {checking ? '⏳' : '🔍 Check'}
          </button>
        )}
      </div>

      <div className="pred-methods">
        {/* PIVOT Method */}
        <div className={`method-box ${pivotResult.toLowerCase()}`}>
          <div className="method-label">PIVOT</div>
          <div className="method-detail">
            <span>Entry: ₨{pred.pivot?.entry}</span>
            <span className="target">Target: ₨{pred.pivot?.target}</span>
            <span className="stop">SL: ₨{pred.pivot?.stopLoss}</span>
          </div>
          <div className="method-result" style={{ 
            background: RESULT_BADGES[pivotResult]?.bg,
            color: RESULT_BADGES[pivotResult]?.text 
          }}>
            {RESULT_BADGES[pivotResult]?.label}
          </div>
          {pred.pivot?.hitAt && <div className="hit-time">@ {formatTime(pred.pivot.hitAt)}</div>}
        </div>

        {/* ATR Method */}
        <div className={`method-box ${atrResult.toLowerCase()}`}>
          <div className="method-label">ATR</div>
          <div className="method-detail">
            <span>Entry: ₨{pred.atr?.entry}</span>
            <span className="target">Target: ₨{pred.atr?.target}</span>
            <span className="stop">SL: ₨{pred.atr?.stopLoss}</span>
          </div>
          <div className="method-result" style={{ 
            background: RESULT_BADGES[atrResult]?.bg,
            color: RESULT_BADGES[atrResult]?.text 
          }}>
            {RESULT_BADGES[atrResult]?.label}
          </div>
          {pred.atr?.hitAt && <div className="hit-time">@ {formatTime(pred.atr.hitAt)}</div>}
        </div>
      </div>

      {isResolved && (
        <div className="pred-rollup">
          Final: <strong style={{ color: pred.result === 'WIN' ? '#22c55e' : '#ef4444' }}>
            {pred.result}
          </strong>
          {' · '}R:R {((pred.pivot?.target - pred.pivot?.entry) / (pred.pivot?.entry - pred.pivot?.stopLoss)).toFixed(1)}
        </div>
      )}

      <button className="delete-btn" onClick={() => onDelete(pred.symbol, pred.pivot?.createdAt)}>🗑️</button>
    </div>
  );
}

function AccuracyRow({ item }) {
  const pivotColor = item.pivotAccuracy >= 60 ? '#22c55e' : item.pivotAccuracy >= 40 ? '#f59e0b' : '#ef4444';
  const atrColor = item.atrAccuracy >= 60 ? '#22c55e' : item.atrAccuracy >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <tr className="accuracy-row">
      <td className="acc-symbol">{item.symbol}</td>
      <td className="acc-count">{item.totalCompleted}/{item.totalPredictions}</td>
      <td className="acc-pivot" style={{ color: pivotColor }}>
        {item.pivotAccuracy != null ? `${item.pivotAccuracy}%` : '—'}
      </td>
      <td className="acc-atr" style={{ color: atrColor }}>
        {item.atrAccuracy != null ? `${item.atrAccuracy}%` : '—'}
      </td>
      <td className="acc-best">
        {item.bestMethod ? (
          <span className={`best-badge ${item.bestMethod.toLowerCase()}`}>
            {item.bestMethod}
          </span>
        ) : '—'}
      </td>
      <td className="acc-rec">
        <span className="rec-text" title={item.recommendation}>
          {item.recommendation?.slice(0, 40) || '—'}
        </span>
      </td>
    </tr>
  );
}

function CreateModal({ stocks, onCreate, onClose }) {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const filtered = symbol.length >= 2 
    ? stocks.filter(s => 
        s.symbol.toLowerCase().includes(symbol.toLowerCase()) ||
        s.name.toLowerCase().includes(symbol.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleSelect = async (sym) => {
    setLoading(true);
    try {
      const res = await onCreate(sym);
      setResult(res);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-modal" onClick={e => e.stopPropagation()}>
        <h3>🎯 Create Prediction</h3>
        <input
          type="text"
          className="create-input"
          placeholder="Type symbol (e.g., OGDC)..."
          value={symbol}
          onChange={e => { setSymbol(e.target.value); setResult(null); }}
          autoFocus
        />
        
        {!result && filtered.length > 0 && (
          <div className="create-suggestions">
            {filtered.map(s => (
              <button 
                key={s.symbol} 
                className="suggestion-btn"
                onClick={() => handleSelect(s.symbol)}
                disabled={loading}
              >
                <span className="sug-symbol">{s.symbol}</span>
                <span className="sug-name">{s.name}</span>
                <span className="sug-price">₨{s.price}</span>
              </button>
            ))}
          </div>
        )}

        {loading && <div className="create-loading">Analyzing...</div>}

        {result && (
          <div className={`create-result ${result.skipped ? 'skipped' : 'created'}`}>
            {result.error ? (
              <div className="result-error">❌ {result.error}</div>
            ) : result.skipped ? (
              <div className="result-skip">
                <div>⏭️ Skipped: {result.reason}</div>
              </div>
            ) : (
              <div className="result-success">
                <div>✅ Prediction created for <strong>{result.pivot?.entry ? `₨${result.pivot.entry}` : symbol}</strong></div>
                <div className="result-levels">
                  <span>Target: ₨{result.pivot?.target}</span>
                  <span>SL: ₨{result.pivot?.stopLoss}</span>
                  <span>Conf: {result.pivot?.confidence}%</span>
                </div>
              </div>
            )}
            <button className="create-again" onClick={() => { setResult(null); setSymbol(''); }}>
              Create Another
            </button>
          </div>
        )}

        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

// ─── MAIN PREDICTION SYSTEM ───────────────────────────────────────────────────

export default function PredictionSystem() {
  const [predictions, setPredictions] = useState([]);
  const [accuracies, setAccuracies] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history' | 'leaderboard'
  const [showCreate, setShowCreate] = useState(false);
  const [stats, setStats] = useState({ total: 0, wins: 0, losses: 0, winRate: 0 });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Load all predictions from local tracking (we'll maintain this in state)
      // In production, you'd have a GET /api/predictions endpoint
      const [stocksRes, accRes] = await Promise.all([
        getStocks(),
        getAllAccuracies().catch(() => ({ data: { data: [] } }))
      ]);

      if (stocksRes.data?.success) setStocks(stocksRes.data.data);
      
      const accData = accRes.data?.data || [];
      setAccuracies(accData);

      // Build predictions list from accuracy data + localStorage backup
      const saved = JSON.parse(localStorage.getItem('psx_predictions') || '[]');
      setPredictions(saved);

      // Calculate stats
      const completed = saved.filter(p => p.checked);
      const wins = completed.filter(p => p.result === 'WIN').length;
      setStats({
        total: saved.length,
        wins,
        losses: completed.length - wins,
        winRate: completed.length > 0 ? ((wins / completed.length) * 100).toFixed(0) : 0
      });
    } catch (e) {
      console.error('Load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleCreate = async (symbol) => {
    try {
      // Use the existing API service instead of raw fetch
      const res = await createPrediction(symbol.toUpperCase());
      const data = res.data;
      
      if (data && !data.skipped) {
        const entry = {
          symbol: symbol,
          pivot: data.pivot,
          atr: data.atr,
          checked: false,
          result: null,
          createdAt: data.pivot?.createdAt
        };
        const updated = [entry, ...predictions].slice(0, 100);
        setPredictions(updated);
        localStorage.setItem('psx_predictions', JSON.stringify(updated));
      }
      
      return data;
    } catch (e) {
      return { error: e.message };
    }
  };

  const handleCheck = async (symbol) => {
    try {
      const res = await checkPrediction(symbol);
      if (res.data?.success) {
        // Update local state with result
        const updated = predictions.map(p => {
          if (p.symbol === symbol && !p.checked) {
            return { ...p, checked: true, result: res.data.result, hitAt: res.data.hitAt };
          }
          return p;
        });
        setPredictions(updated);
        localStorage.setItem('psx_predictions', JSON.stringify(updated));
      }
      await loadAll(); // Refresh accuracies
    } catch (e) {
      console.error('Check failed:', e);
    }
  };

  const handleDelete = (symbol, createdAt) => {
    const updated = predictions.filter(p => !(p.symbol === symbol && p.pivot?.createdAt === createdAt));
    setPredictions(updated);
    localStorage.setItem('psx_predictions', JSON.stringify(updated));
  };

  const activePreds = predictions.filter(p => !p.checked);
  const historyPreds = predictions.filter(p => p.checked);

  return (
    <div className="prediction-system">
      {/* Header Stats */}
      <div className="pred-stats-bar">
        <div className="stat-box">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Predictions</div>
        </div>
        <div className="stat-box wins">
          <div className="stat-value">{stats.wins}</div>
          <div className="stat-label">Wins</div>
        </div>
        <div className="stat-box losses">
          <div className="stat-value">{stats.losses}</div>
          <div className="stat-label">Losses</div>
        </div>
        <div className="stat-box rate">
          <div className="stat-value">{stats.winRate}%</div>
          <div className="stat-label">Win Rate</div>
        </div>
        <button className="create-pred-btn" onClick={() => setShowCreate(true)}>
          + New Prediction
        </button>
      </div>

      {/* Tabs */}
      <div className="pred-tabs">
        <button 
          className={`tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          ⚡ Active ({activePreds.length})
        </button>
        <button 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 History ({historyPreds.length})
        </button>
        <button 
          className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          🏆 Leaderboard ({accuracies.length})
        </button>
      </div>

      {/* Content */}
      <div className="pred-content">
        {loading && <div className="pred-loading">Loading predictions...</div>}

        {!loading && activeTab === 'active' && (
          activePreds.length === 0 ? (
            <div className="pred-empty">
              <div className="empty-icon">🎯</div>
              <div>No active predictions</div>
              <button className="empty-create" onClick={() => setShowCreate(true)}>
                Create your first prediction
              </button>
            </div>
          ) : (
            <div className="pred-grid">
              {activePreds.map((pred, i) => (
                <PredictionCard 
                  key={`${pred.symbol}-${i}`} 
                  pred={pred} 
                  onCheck={handleCheck}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )
        )}

        {!loading && activeTab === 'history' && (
          historyPreds.length === 0 ? (
            <div className="pred-empty">
              <div className="empty-icon">📜</div>
              <div>No completed predictions yet</div>
            </div>
          ) : (
            <div className="pred-grid">
              {historyPreds.map((pred, i) => (
                <PredictionCard 
                  key={`${pred.symbol}-${i}`} 
                  pred={pred} 
                  onCheck={handleCheck}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )
        )}

        {!loading && activeTab === 'leaderboard' && (
          accuracies.length === 0 ? (
            <div className="pred-empty">
              <div className="empty-icon">🏆</div>
              <div>Not enough data yet (need 3+ completed predictions per symbol)</div>
            </div>
          ) : (
            <table className="accuracy-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Completed</th>
                  <th>Pivot Acc</th>
                  <th>ATR Acc</th>
                  <th>Best Method</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {accuracies
                  .sort((a, b) => (b.pivotAccuracy || 0) - (a.pivotAccuracy || 0))
                  .map(item => (
                    <AccuracyRow key={item.symbol} item={item} />
                  ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateModal 
          stocks={stocks} 
          onCreate={handleCreate} 
          onClose={() => setShowCreate(false)} 
        />
      )}
    </div>
  );
}