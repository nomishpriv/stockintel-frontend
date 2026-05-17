function SectorHeatmap({ sectors }) {
  if (!sectors?.length) return null;

  return (
    <div className="sector-heatmap">
      {sectors.map(s => (
        <div
          key={s.name}
          className="sector-chip"
          style={{
            background: s.avgChange > 1 ? 'rgba(34,197,94,0.2)' : s.avgChange < -1 ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.1)',
            borderColor: s.avgChange > 1 ? '#22c55e' : s.avgChange < -1 ? '#ef4444' : '#334155'
          }}
        >
          <span className="sector-name">{s.name}</span>
          <span className="sector-change" style={{ color: s.avgChange > 0 ? '#22c55e' : '#ef4444' }}>
            {s.avgChange > 0 ? '+' : ''}{s.avgChange}%
          </span>
          <span className="sector-count">{s.count} stocks</span>
        </div>
      ))}
    </div>
  );
}

export default SectorHeatmap;