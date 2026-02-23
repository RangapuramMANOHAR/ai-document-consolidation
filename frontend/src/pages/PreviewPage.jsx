import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'

const API_BASE = 'http://127.0.0.1:8000'

const TABLE_COLUMNS = [
  { key: 'invoice_number', label: 'Invoice #' },
  { key: 'vendor_name', label: 'Vendor' },
  { key: 'invoice_date', label: 'Date' },
  { key: 'subtotal_amount', label: 'Subtotal' },
  { key: 'tax_amount', label: 'Tax' },
  { key: 'total_amount', label: 'Total' },
  { key: 'currency', label: 'Currency' },
  { key: 'payment_status', label: 'Payment' },
  { key: 'processing_status', label: 'Processing Status' },
  { key: 'source_file', label: 'Source File' },
]

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
  const [currencyFilter, setCurrencyFilter] = useState('all')
  const [deletingId, setDeletingId] = useState(null)

  const loadInvoices = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/invoices/?skip=0&limit=100`)
      .then((res) => res.json())
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

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
    if (currencyFilter !== 'all' && (inv.currency ?? '').toUpperCase() !== currencyFilter) return false
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

  const handleDelete = useCallback(async (inv) => {
    const id = inv?.id
    if (id == null) return
    if (!window.confirm(`Delete invoice "${inv.invoice_number || inv.vendor_name || id}"? This cannot be undone.`)) return
    setDeletingId(id)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/invoices/${id}`, { method: 'DELETE' })
      if (res.status === 404) throw new Error('Invoice not found')
      if (!res.ok) throw new Error(res.statusText || 'Delete failed')
      setInvoices((prev) => prev.filter((i) => i.id !== id))
      if (selectedInvoice?.id === id) setSelectedInvoice(null)
    } catch (err) {
      setError(err.message || 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }, [selectedInvoice?.id])

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
  const formatAmount = (val) => val != null && val !== '' ? Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

  const getStatusBadgeClass = (status) => {
    if (status === 'SUCCESS') return 'badge badge--success'
    if (status === 'PARTIAL') return 'badge badge--partial'
    if (status === 'FAILED') return 'badge badge--failed'
    return 'badge'
  }

  const warningsList = selectedInvoice && Array.isArray(selectedInvoice.warnings)
    ? selectedInvoice.warnings
    : selectedInvoice && selectedInvoice.warnings
      ? [selectedInvoice.warnings]
      : []
  const hasPreview = selectedInvoice && selectedInvoice.extracted_text_preview != null && String(selectedInvoice.extracted_text_preview).trim() !== ''

  if (loading && !invoices.length) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Review extracted invoices, filter by status/currency, and verify the data saved in the system.</p>
        </header>
        <div className="loading-block">
          <span className="loading-spinner" aria-hidden />
          <span>Loading…</span>
        </div>
      </>
    )
  }
  if (error && !invoices.length) return <p className="upload-status--error">{error}</p>

  return (
    <>
      <style>{`
        .page-header { margin-bottom: 2rem; }
        .card.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; }
        .card.toolbar .filter-search { height: 42px; padding: 0 1rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 16px; min-width: 220px; }
        .card.toolbar .filter-select { height: 42px; padding: 0 1rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 15px; background: #fff; min-height: 42px; }
        .btn-sm { padding: 0.4rem 0.75rem; font-size: 0.9375rem; }
        .table-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem; }
        .table-count { color: #475569; font-size: 1rem; }
        .table.table-lg { width: 100%; border-collapse: collapse; font-size: 16px; }
        .table.table-lg th, .table.table-lg td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
        .table.table-lg th { font-weight: 700; color: #334155; background: #f8fafc; font-size: 0.9375rem; }
        .table.table-lg tbody tr { cursor: pointer; }
        .table.table-lg tbody tr:nth-child(even) { background: #fafafa; }
        .table.table-lg tbody tr:hover { background: #eff6ff !important; }
        .table.table-lg tbody tr:nth-child(even):hover { background: #eff6ff !important; }
        .row-highlight { background-color: #dbeafe !important; }
        .table-empty { margin: 0.5rem 0; color: #64748b; font-size: 1rem; }
        .upload-status--error { color: #dc2626; margin: 0.5rem 0; font-size: 1rem; font-weight: 600; }
        .badge { display: inline-block; padding: 0.3rem 0.65rem; border-radius: 6px; font-size: 0.875rem; font-weight: 600; }
        .badge--success { background: #dcfce7; color: #166534; }
        .badge--partial { background: #fef3c7; color: #92400e; }
        .badge--failed { background: #fee2e2; color: #991b1b; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
        .modal-content { background: #fff; border-radius: 12px; padding: 1.5rem; max-width: 520px; width: 100%; max-height: 90vh; overflow: auto; position: relative; box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        .modal-close { position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; line-height: 1; }
        .modal-close:hover { color: #0f172a; }
        .modal-title { margin: 0 0 1rem; font-size: 1.35rem; font-weight: 700; }
        .modal-dl { margin: 0; }
        .modal-dl dt { font-weight: 600; color: #475569; margin-top: 0.75rem; font-size: 0.95rem; }
        .modal-dl dd { margin: 0.15rem 0 0; font-size: 1rem; }
        .modal-pre { white-space: pre-wrap; font-size: 0.9rem; background: #f1f5f9; padding: 0.75rem; border-radius: 6px; overflow: auto; max-height: 200px; margin: 0; }
        .modal-actions { margin-top: 1.25rem; }
        .empty-state-block { text-align: center; padding: 2rem 1rem; color: #475569; font-size: 1.1rem; }
      `}</style>

      <header className="page-header">
        <h1 className="page-title">Invoices</h1>
        <p className="page-subtitle">Review extracted invoices, filter by status/currency, and verify the data saved in the system.</p>
      </header>

      <div className="card toolbar">
        <input
          type="text"
          className="filter-search"
          placeholder="Vendor or Invoice #"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
          <select
            className="filter-select"
            value={processingStatusFilter}
            onChange={(e) => setProcessingStatusFilter(e.target.value)}
          >
            <option value="all">ALL</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="FAILED">FAILED</option>
          </select>
          <select
            className="filter-select"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
          >
            <option value="all">ALL</option>
            <option value="USD">USD</option>
            <option value="INR">INR</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
          <select
            className="filter-select"
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
          >
            <option value="all">Payment: All</option>
            {paymentStatusOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        <button type="button" className="btn btn-outline" onClick={loadInvoices} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="card table-card">
        <div className="table-toolbar">
          <span className="table-count">Showing {filteredInvoices.length} of {invoices.length}</span>
          <button type="button" className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Downloading…' : 'Download (invoices.xlsx)'}
          </button>
        </div>
        {error && <p className="upload-status--error">{error}</p>}
        <table className="table table-lg preview-invoice-table">
          <thead>
            <tr>
              {TABLE_COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv) => (
              <tr
                key={inv.id}
                ref={inv.id === highlightId ? highlightRowRef : null}
                className={inv.id === highlightId ? 'row-highlight' : ''}
                onClick={() => setSelectedInvoice(inv)}
              >
                {TABLE_COLUMNS.map((col) => (
                  <td key={col.key}>
                    {col.key === 'invoice_date'
                      ? formatDate(inv[col.key])
                      : col.key === 'processing_status'
                        ? <span className={getStatusBadgeClass(inv[col.key])}>{inv[col.key] ?? '—'}</span>
                        : (col.key === 'subtotal_amount' || col.key === 'tax_amount' || col.key === 'total_amount')
                          ? formatAmount(inv[col.key])
                          : (inv[col.key] != null ? String(inv[col.key]) : '—')}
                  </td>
                ))}
                <td onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="btn btn-sm" onClick={() => setSelectedInvoice(inv)}>View</button>
                  {' '}
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(inv)}
                    disabled={deletingId === inv.id}
                    title="Delete invoice"
                  >
                    {deletingId === inv.id ? '…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!invoices.length && !loading && <p className="empty-state-block">No invoices found. Upload a file to get started.</p>}
        {invoices.length > 0 && !filteredInvoices.length && <p className="table-empty">No invoices match the filters.</p>}
      </div>

      {selectedInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invoice details"
          className="modal-overlay"
          onClick={() => setSelectedInvoice(null)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Close"
              className="modal-close"
              onClick={() => setSelectedInvoice(null)}
            >
              ×
            </button>
            <h2 className="modal-title">Invoice details</h2>
            <dl className="modal-dl">
              <dt>invoice_number</dt>
              <dd>{selectedInvoice.invoice_number ?? '—'}</dd>
              <dt>vendor_name</dt>
              <dd>{selectedInvoice.vendor_name ?? '—'}</dd>
              <dt>invoice_date</dt>
              <dd>{formatDate(selectedInvoice.invoice_date)}</dd>
              <dt>subtotal</dt>
              <dd>{formatAmount(selectedInvoice.subtotal_amount)}</dd>
              <dt>tax</dt>
              <dd>{formatAmount(selectedInvoice.tax_amount)}</dd>
              <dt>total</dt>
              <dd>{formatAmount(selectedInvoice.total_amount)}</dd>
              <dt>currency</dt>
              <dd>{selectedInvoice.currency ?? '—'}</dd>
              <dt>payment_status</dt>
              <dd>{selectedInvoice.payment_status ?? '—'}</dd>
              <dt>processing_status</dt>
              <dd><span className={getStatusBadgeClass(selectedInvoice.processing_status)}>{selectedInvoice.processing_status ?? '—'}</span></dd>
              <dt>source_file</dt>
              <dd>{selectedInvoice.source_file ?? '—'}</dd>
              <dt>confidence</dt>
              <dd>{selectedInvoice.confidence != null ? (typeof selectedInvoice.confidence === 'number' ? (selectedInvoice.confidence * 100).toFixed(0) + '%' : String(selectedInvoice.confidence)) : 'N/A'}</dd>
              <dt>warnings</dt>
              <dd>
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
              <dt>extracted_text_preview</dt>
              <dd>
                {hasPreview ? (
                  <pre className="modal-pre">{String(selectedInvoice.extracted_text_preview)}</pre>
                ) : (
                  '—'
                )}
              </dd>
            </dl>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setSelectedInvoice(null)}>Close</button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => selectedInvoice && handleDelete(selectedInvoice)}
                disabled={selectedInvoice && deletingId === selectedInvoice.id}
                title="Delete this invoice"
              >
                {selectedInvoice && deletingId === selectedInvoice.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
