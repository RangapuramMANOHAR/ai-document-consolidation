import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const API_BASE = 'http://127.0.0.1:8000'

export default function PreviewPage() {
  const location = useLocation()
  const highlightId = location.state?.highlightId ?? null
  const highlightRowRef = useRef(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [processingStatusFilter, setProcessingStatusFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/invoices/?skip=0&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setInvoices(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const sortedInvoices = [...invoices].sort((a, b) => {
    const tA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0
    const tB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0
    return tB - tA
  })

  const paymentStatusOptions = [...new Set(invoices.map((inv) => (inv.payment_status != null && inv.payment_status !== '') ? String(inv.payment_status) : null).filter(Boolean))].sort()

  const filteredInvoices = sortedInvoices.filter((inv) => {
    if (processingStatusFilter !== 'all' && (inv.processing_status ?? '') !== processingStatusFilter) return false
    if (paymentStatusFilter !== 'all' && (inv.payment_status ?? '') !== paymentStatusFilter) return false
    const q = (searchQuery || '').trim().toLowerCase()
    if (q) {
      const invNum = (inv.invoice_number ?? '').toLowerCase()
      const vendor = (inv.vendor_name ?? '').toLowerCase()
      const source = (inv.source_file ?? '').toLowerCase()
      if (!invNum.includes(q) && !vendor.includes(q) && !source.includes(q)) return false
    }
    return true
  })

  useEffect(() => {
    if (highlightId && filteredInvoices.length > 0 && highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [highlightId, filteredInvoices.length])

  useEffect(() => {
    if (!selectedInvoice) return
    const onKeyDown = (e) => { if (e.key === 'Escape') setSelectedInvoice(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedInvoice])

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/export`, { method: 'GET' })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.detail || res.statusText || 'Export failed')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'invoices.xlsx'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (loading && !invoices.length) return <p>Loading…</p>
  if (error && !invoices.length) return <p style={{ color: 'crimson' }}>{error}</p>

  const cols = ['id', 'invoice_number', 'vendor_name', 'invoice_date', 'total_amount', 'currency', 'payment_status', 'processing_status', 'source_file']

  const formatDate = (val) => {
    if (val == null || val === '') return '—'
    try {
      const d = new Date(val)
      return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString(undefined, { dateStyle: 'medium' })
    } catch {
      return String(val)
    }
  }
  const formatDateTime = (val) => {
    if (val == null || val === '') return '—'
    try {
      const d = new Date(val)
      return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return String(val)
    }
  }

  const warningsList = selectedInvoice && Array.isArray(selectedInvoice.warnings)
    ? selectedInvoice.warnings
    : selectedInvoice && selectedInvoice.warnings
      ? [selectedInvoice.warnings]
      : []
  const hasPreview = selectedInvoice && selectedInvoice.extracted_text_preview != null && String(selectedInvoice.extracted_text_preview).trim() !== ''

  return (
    <div>
      <style>{`
        .preview-invoice-table tbody tr { cursor: pointer; }
        .preview-invoice-table tbody tr:hover { background-color: #f0f4f0 !important; }
      `}</style>
      <h1>Preview</h1>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={handleExport} disabled={exporting}>
          {exporting ? 'Downloading…' : 'Download (invoices.xlsx)'}
        </button>
      </div>
      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search invoice #, vendor, source file…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: '0.35rem 0.5rem', minWidth: 260 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem' }}>processing_status</span>
          <select
            value={processingStatusFilter}
            onChange={(e) => setProcessingStatusFilter(e.target.value)}
            style={{ padding: '0.35rem 0.5rem' }}
          >
            <option value="all">All</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="FAILED">FAILED</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem' }}>payment_status</span>
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            style={{ padding: '0.35rem 0.5rem' }}
          >
            <option value="all">All</option>
            {paymentStatusOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
      </div>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#666' }}>
        Showing {filteredInvoices.length} of {invoices.length}
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <table className="preview-invoice-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'left' }}>{c}</th>
            ))}
            <th style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'left' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredInvoices.map((inv) => (
            <tr
              key={inv.id}
              ref={inv.id === highlightId ? highlightRowRef : null}
              style={
                inv.id === highlightId
                  ? { backgroundColor: '#e8f4ea', borderLeft: '3px solid #2e7d32' }
                  : undefined
              }
              onClick={() => setSelectedInvoice(inv)}
            >
              {cols.map((c) => (
                <td key={c} style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                  {inv[c] != null ? String(inv[c]) : ''}
                </td>
              ))}
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => setSelectedInvoice(inv)}>View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!invoices.length && !loading && <p>No invoices yet.</p>}

      {selectedInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invoice details"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 440,
              width: '90%',
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '0.75rem',
                right: '0.75rem',
                width: 28,
                height: 28,
                padding: 0,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: '#fff',
                fontSize: '1.1rem',
                lineHeight: 1,
                cursor: 'pointer',
              }}
              onClick={() => setSelectedInvoice(null)}
            >
              ×
            </button>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', paddingRight: 32 }}>Invoice details</h2>
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1.5rem', margin: 0 }}>
              <dt style={{ color: '#666' }}>invoice_number</dt>
              <dd style={{ margin: 0 }}>{selectedInvoice.invoice_number ?? '—'}</dd>
              <dt style={{ color: '#666' }}>vendor_name</dt>
              <dd style={{ margin: 0 }}>{selectedInvoice.vendor_name ?? '—'}</dd>
              <dt style={{ color: '#666' }}>invoice_date</dt>
              <dd style={{ margin: 0 }}>{formatDate(selectedInvoice.invoice_date)}</dd>
              <dt style={{ color: '#666' }}>subtotal</dt>
              <dd style={{ margin: 0 }}>{selectedInvoice.subtotal_amount != null ? Number(selectedInvoice.subtotal_amount).toFixed(2) : '—'}</dd>
              <dt style={{ color: '#666' }}>tax</dt>
              <dd style={{ margin: 0 }}>{selectedInvoice.tax_amount != null ? Number(selectedInvoice.tax_amount).toFixed(2) : '—'}</dd>
              <dt style={{ color: '#666' }}>total</dt>
              <dd style={{ margin: 0 }}>{selectedInvoice.total_amount != null ? Number(selectedInvoice.total_amount).toFixed(2) : '—'}</dd>
              <dt style={{ color: '#666' }}>currency</dt>
              <dd style={{ margin: 0 }}>{selectedInvoice.currency ?? '—'}</dd>
              <dt style={{ color: '#666' }}>payment_status</dt>
              <dd style={{ margin: 0 }}>{selectedInvoice.payment_status ?? '—'}</dd>
              <dt style={{ color: '#666' }}>processing_status</dt>
              <dd style={{ margin: 0 }}>{selectedInvoice.processing_status ?? '—'}</dd>
              <dt style={{ color: '#666' }}>source_file</dt>
              <dd style={{ margin: 0 }}>{selectedInvoice.source_file ?? '—'}</dd>
              <dt style={{ color: '#666' }}>confidence</dt>
              <dd style={{ margin: 0 }}>{selectedInvoice.confidence != null ? (typeof selectedInvoice.confidence === 'number' ? (selectedInvoice.confidence * 100).toFixed(0) + '%' : String(selectedInvoice.confidence)) : 'N/A'}</dd>
              <dt style={{ color: '#666' }}>warnings</dt>
              <dd style={{ margin: 0 }}>
                {warningsList.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {warningsList.map((w, i) => (
                      <li key={i}>{typeof w === 'string' ? w : String(w)}</li>
                    ))}
                  </ul>
                ) : (
                  'None'
                )}
              </dd>
              <dt style={{ color: '#666', marginTop: '0.5rem' }}>extracted_text_preview</dt>
              <dd style={{ margin: 0, marginTop: '0.5rem' }}>
                {hasPreview ? (
                  <pre
                    style={{
                      margin: 0,
                      padding: '0.75rem',
                      background: '#f5f5f5',
                      border: '1px solid #eee',
                      borderRadius: 4,
                      fontSize: '0.8rem',
                      overflow: 'auto',
                      maxHeight: 180,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {String(selectedInvoice.extracted_text_preview)}
                  </pre>
                ) : (
                  '—'
                )}
              </dd>
            </dl>
            <div style={{ marginTop: '1.25rem' }}>
              <button type="button" onClick={() => setSelectedInvoice(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
