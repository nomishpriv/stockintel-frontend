import { useState } from 'react';
import api from '../services/api';
import './TestPanel.css';

function TestPanel() {
  const [symbol, setSymbol] = useState('FFC');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const runTest = async (endpoint) => {
    setLoading(true);
    setResult(null);
    try {
      let res;
      switch (endpoint) {
        case 'predict': res = await api.get(`/predict/${symbol}`); break;
        case 'check': res = await api.get(`/predict/check/${symbol}`); break;
        case 'accuracy': res = await api.get(`/predict/accuracy/${symbol}`); break;
        case 'smc': res = await api.get(`/smc/${symbol}`); break;
        case 'daily': res = await api.get('/stats/daily'); break;
        case 'report': res = await api.get('/stats/daily-report'); break;
        case 'batch': res = await api.post('/predict/batch'); break;
        default: res = null;
      }
      setResult(JSON.stringify(res?.data, null, 2));
    } catch (e) {
      setResult('Error: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button className="test-panel-toggle" onClick={() => setOpen(true)}>
        🧪 Test Panel
      </button>
    );
  }

  return (
    <div className="test-panel">
      <div className="test-panel-header">
        <h3>🧪 Test Panel</h3>
        <button onClick={() => setOpen(false)}>✕</button>
      </div>

      <div className="test-symbol">
        <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="Symbol" />
      </div>

      <div className="test-buttons">
        <button onClick={() => runTest('predict')} disabled={loading}>🎯 Predict</button>
        <button onClick={() => runTest('check')} disabled={loading}>✅ Check</button>
        <button onClick={() => runTest('accuracy')} disabled={loading}>📊 Accuracy</button>
        <button onClick={() => runTest('smc')} disabled={loading}>🏦 SMC</button>
        <button onClick={() => runTest('daily')} disabled={loading}>📈 Daily Stats</button>
        <button onClick={() => runTest('report')} disabled={loading}>📋 Full Report</button>
        <button onClick={() => runTest('batch')} disabled={loading}>🚀 Batch Predict</button>
      </div>

      {loading && <div className="test-loading">⏳ Running...</div>}

      {result && (
        <pre className="test-result">{result}</pre>
      )}
    </div>
  );
}

export default TestPanel;