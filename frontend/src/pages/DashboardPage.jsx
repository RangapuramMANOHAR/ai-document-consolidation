import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://127.0.0.1:8000'

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

  if (loading && !data) return <p>Loading…</p>
  if (error && !data) return <p style={{ color: 'crimson' }}>{error}</p>

  const summary = data || {
    total_invoices: 0,
    by_status: { SUCCESS: 0, PARTIAL: 0, FAILED: 0 },
    by_currency: { USD: 0, INR: 0, EUR: 0, GBP: 0 },
    amount_totals: { subtotal_sum: 0, tax_sum: 0, total_sum: 0 },
    top_vendors: [],
    daily_totals_last_14_days: [],
  }
  const amt = summary.amount_totals || {}
  const byStatus = summary.by_status || {}
  const byCurrency = summary.by_currency || {}
  const statusMax = Math.max(1, ...Object.values(byStatus))
  const currencyMax = Math.max(1, ...Object.values(byCurrency))
  const daily = summary.daily_totals_last_14_days || []
  const dailyMax = Math.max(1, ...daily.map((d) => d.total_sum || 0))

  const cardStyle = {
    padding: '1rem 1.25rem',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    border: '1px solid #eee',
    minWidth: 140,
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <button type="button" onClick={fetchSummary} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error && data && <p style={{ color: 'crimson' }}>{error}</p>}

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: '0.75rem' }}>KPIs</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>Total Invoices</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{summary.total_invoices}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>Total Amount</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{Number(amt.total_sum || 0).toFixed(2)}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>Subtotal Sum</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{Number(amt.subtotal_sum || 0).toFixed(2)}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>Tax Sum</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{Number(amt.tax_sum || 0).toFixed(2)}</div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: '0.75rem' }}>By status</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {['SUCCESS', 'PARTIAL', 'FAILED'].map((key) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ width: 80, fontSize: '0.9rem' }}>{key}</span>
              <div style={{ flex: 1, height: 24, backgroundColor: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(100 * (byStatus[key] || 0)) / statusMax}%`,
                    height: '100%',
                    backgroundColor: key === 'SUCCESS' ? '#2e7d32' : key === 'PARTIAL' ? '#ed6c02' : '#c62828',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{byStatus[key] || 0}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: '0.75rem' }}>By currency</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {['USD', 'INR', 'EUR', 'GBP'].map((key) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ width: 80, fontSize: '0.9rem' }}>{key}</span>
              <div style={{ flex: 1, height: 24, backgroundColor: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(100 * (byCurrency[key] || 0)) / currencyMax}%`,
                    height: '100%',
                    backgroundColor: '#1976d2',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{byCurrency[key] || 0}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: '0.75rem' }}>Daily totals (last 14 days)</h2>
        {daily.length === 0 ? (
          <p style={{ color: '#666', fontSize: '0.9rem' }}>No data</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {daily.map((d) => (
              <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: 100, fontSize: '0.9rem' }}>{d.date}</span>
                <div style={{ flex: 1, height: 20, backgroundColor: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(100 * (d.total_sum || 0)) / dailyMax}%`,
                      height: '100%',
                      backgroundColor: '#7b1fa2',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.9rem' }}>{Number(d.total_sum || 0).toFixed(2)}</span>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>({d.count})</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: '0.75rem' }}>Top vendors</h2>
        {!summary.top_vendors || summary.top_vendors.length === 0 ? (
          <p style={{ color: '#666', fontSize: '0.9rem' }}>No data</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'left' }}>vendor_name</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'right' }}>count</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'right' }}>total_sum</th>
              </tr>
            </thead>
            <tbody>
              {summary.top_vendors.map((row, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{row.vendor_name}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'right' }}>{row.count}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'right' }}>{Number(row.total_sum || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
