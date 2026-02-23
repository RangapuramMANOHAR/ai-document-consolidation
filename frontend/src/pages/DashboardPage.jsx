import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://127.0.0.1:8000'

const defaultSummary = {
  total_invoices: 0,
  by_status: { SUCCESS: 0, PARTIAL: 0, FAILED: 0 },
  by_currency: { USD: 0, INR: 0, EUR: 0, GBP: 0 },
  amount_totals: { subtotal_sum: 0, tax_sum: 0, total_sum: 0 },
  top_vendors: [],
  daily_totals_last_14_days: [],
}

function getStatusBadgeClass(status) {
  if (status === 'SUCCESS') return 'dashboard-badge dashboard-badge--success'
  if (status === 'PARTIAL') return 'dashboard-badge dashboard-badge--partial'
  if (status === 'FAILED') return 'dashboard-badge dashboard-badge--failed'
  return 'dashboard-badge'
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/analytics/summary`)
      if (!res.ok) throw new Error(res.statusText || 'Failed to load')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  if (loading && !data) {
    return (
      <>
        <h1 className="page-title">KPI Dashboard</h1>
        <p className="page-subtitle">Invoice analytics across status, currency, vendors, and daily totals.</p>
        <div className="loading-block">
          <span className="loading-spinner" aria-hidden />
          <span>Loading…</span>
        </div>
      </>
    )
  }
  if (error && !data) return <p className="dashboard-error">{error}</p>

  const summary = data || defaultSummary
  const amt = summary.amount_totals || {}
  const byStatus = summary.by_status || {}
  const byCurrency = summary.by_currency || {}
  const topVendors = summary.top_vendors || []
  const dailyTotals = summary.daily_totals_last_14_days || []
  const formatMoney = (val) => (val != null && val !== '' ? Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—')
  const formatDate = (val) => {
    if (val == null || val === '') return '—'
    try {
      const d = new Date(val)
      return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString(undefined, { dateStyle: 'medium' })
    } catch {
      return String(val)
    }
  }
  const hasNoData = summary.total_invoices === 0

  return (
    <>
      <style>{`
        .dashboard-error { color: #dc2626; margin: 0.5rem 0; font-size: 1.05rem; font-weight: 600; }
        .dashboard-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .dashboard-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        @media (max-width: 800px) { .dashboard-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .dashboard-kpi-grid { grid-template-columns: 1fr; } }
        .dashboard-kpi-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .dashboard-kpi-label { font-size: 1rem; color: #64748b; margin-bottom: 0.35rem; }
        .dashboard-kpi-value { font-size: 1.75rem; font-weight: 700; color: #0f172a; }
        .dashboard-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
        @media (max-width: 700px) { .dashboard-two-col { grid-template-columns: 1fr; } }
        .dashboard-section-title { font-size: 1.15rem; font-weight: 700; margin: 0 0 0.75rem; color: #334155; }
        .dashboard-status-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
        .dashboard-currency-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
        .dashboard-badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 500; min-width: 4.5rem; text-align: center; }
        .dashboard-badge--success { background: #dcfce7; color: #166534; }
        .dashboard-badge--partial { background: #fef3c7; color: #92400e; }
        .dashboard-badge--failed { background: #fee2e2; color: #991b1b; }
        .dashboard-table { width: 100%; border-collapse: collapse; font-size: 1rem; }
        .dashboard-table th, .dashboard-table td { padding: 0.6rem 0.9rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
        .dashboard-table th { font-weight: 600; color: #475569; background: #f8fafc; }
        .dashboard-table td.num { text-align: right; }
        .dashboard-empty { color: #64748b; font-size: 1rem; margin: 0.5rem 0; }
        .dashboard-empty-state { text-align: center; padding: 2rem 1rem; color: #475569; font-size: 1.1rem; }
      `}</style>

      <h1 className="page-title">KPI Dashboard</h1>
      <p className="page-subtitle">Invoice analytics across status, currency, vendors, and daily totals.</p>

      {error && data && <p className="dashboard-error">{error}</p>}

      {hasNoData && <p className="dashboard-empty-state">No analytics yet. Upload invoices first.</p>}

      {!hasNoData && <div className="dashboard-kpi-grid">
        <div className="dashboard-kpi-card">
          <div className="dashboard-kpi-label">Total Invoices</div>
          <div className="dashboard-kpi-value">{summary.total_invoices}</div>
        </div>
        <div className="dashboard-kpi-card">
          <div className="dashboard-kpi-label">Total Amount</div>
          <div className="dashboard-kpi-value">{formatMoney(amt.total_sum)}</div>
        </div>
        <div className="dashboard-kpi-card">
          <div className="dashboard-kpi-label">SUCCESS</div>
          <div className="dashboard-kpi-value">{byStatus.SUCCESS ?? 0}</div>
        </div>
        <div className="dashboard-kpi-card">
          <div className="dashboard-kpi-label">PARTIAL</div>
          <div className="dashboard-kpi-value">{byStatus.PARTIAL ?? 0}</div>
        </div>
      </div>}

      {!hasNoData && <div className="dashboard-two-col">
        <div className="dashboard-card">
          <h2 className="dashboard-section-title">By Status</h2>
          {['SUCCESS', 'PARTIAL', 'FAILED'].map((key) => (
            <div key={key} className="dashboard-status-row">
              <span className={getStatusBadgeClass(key)}>{key}</span>
              <span style={{ fontWeight: 500 }}>{byStatus[key] ?? 0}</span>
            </div>
          ))}
        </div>
        <div className="dashboard-card">
          <h2 className="dashboard-section-title">By Currency</h2>
          {['USD', 'INR', 'EUR', 'GBP'].map((key) => (
            <div key={key} className="dashboard-currency-row">
              <span style={{ minWidth: '3rem' }}>{key}</span>
              <span style={{ fontWeight: 500 }}>{byCurrency[key] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>}

      {!hasNoData && <div className="dashboard-two-col">
        <div className="dashboard-card">
          <h2 className="dashboard-section-title">Top Vendors</h2>
          {topVendors.length === 0 ? (
            <p className="dashboard-empty">No data</p>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="num">Count</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {topVendors.map((row, i) => (
                  <tr key={i}>
                    <td>{row.vendor_name || '—'}</td>
                    <td className="num">{row.count}</td>
                    <td className="num">{formatMoney(row.total_sum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="dashboard-card">
          <h2 className="dashboard-section-title">Daily Totals (Last 14 Days)</h2>
          {dailyTotals.length === 0 ? (
            <p className="dashboard-empty">No data</p>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Count</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {dailyTotals.map((row, i) => (
                  <tr key={row.date ?? i}>
                    <td>{formatDate(row.date)}</td>
                    <td className="num">{row.count}</td>
                    <td className="num">{formatMoney(row.total_sum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>}
    </>
  )
}
