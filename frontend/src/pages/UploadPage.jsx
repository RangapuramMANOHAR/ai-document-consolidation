import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = 'http://127.0.0.1:8000'

export default function UploadPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [error, setError] = useState(null)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) setFile(f)
    setError(null)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleSelect = useCallback((e) => {
    const f = e.target?.files?.[0]
    if (f) setFile(f)
    setError(null)
  }, [])

  const handleUpload = useCallback(() => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    setError(null)
    setUploadProgress(0)
    setUploadComplete(false)
    setIsUploading(true)
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        setUploadProgress(Math.round((event.loaded * 100) / event.total))
      }
    }
    xhr.onload = () => {
      setUploadProgress(100)
      setUploadComplete(true)
      setIsUploading(false)
      setFile(null)
      let data
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        setError('Invalid response')
        return
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const highlightId = data.invoice?.id ?? data.items?.[0]?.invoice?.id ?? null
        navigate('/preview', { state: highlightId != null ? { highlightId } : {} })
      } else {
        setError(data.detail || xhr.statusText || 'Upload failed')
      }
    }
    xhr.onerror = () => {
      setIsUploading(false)
      setUploadProgress(0)
      setError('Upload failed')
    }
    xhr.upload.onerror = () => {
      setIsUploading(false)
      setUploadProgress(0)
      setError('Upload failed')
    }
    xhr.open('POST', `${API_BASE}/upload`)
    xhr.send(formData)
  }, [file, navigate])

  return (
    <>
      <style>{`
        .page-header { margin-bottom: 2rem; }
        .card--upload { padding: 2rem 2.25rem; }
        .card--upload .upload-dropzone { margin-bottom: 1rem; }
        .card--upload .upload-formats-hint { margin: 0 0 1.25rem; }
        .card--upload .btn-lg { margin-top: 0.25rem; }
        .btn-lg { padding: 0.9rem 1.75rem; font-size: 1.1rem; }
        .alert-success { padding: 1rem 1.25rem; border-radius: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-weight: 500; font-size: 1rem; margin-top: 1rem; }
        .alert-error { padding: 1rem 1.25rem; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-weight: 500; font-size: 1rem; margin-top: 1rem; }
      `}</style>

      <header className="page-header">
        <h1 className="page-title">Upload & Extract</h1>
        <p className="page-subtitle">
          Upload invoices as PDF/JPG/PNG/CSV/XLSX or ZIP. We extract key fields and store them for review and analytics.
        </p>
      </header>

      <div className="card card--upload">
        <div
          className={`upload-dropzone ${dragOver ? 'upload-dropzone--active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.zip"
            onChange={handleSelect}
            className="upload-input"
          />
          <p className="upload-dropzone-hint">or drag and drop a file</p>
          {file ? <p className="upload-filename"><strong>{file.name}</strong></p> : <p className="empty-state">No file selected</p>}
        </div>

        <p className="upload-formats-hint">Supported: PDF, JPG, PNG, CSV, XLSX, ZIP</p>

        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleUpload}
          disabled={!file || isUploading}
        >
          {isUploading ? (
            <>
              <span className="loading-spinner" aria-hidden />
              Uploading… {uploadProgress}%
            </>
          ) : (
            'Upload'
          )}
        </button>

        <div className="upload-status">
          {isUploading && (
            <div className="upload-status-item upload-status--progress">
              <span><span className="loading-spinner" aria-hidden /> Loading… {uploadProgress}%</span>
              <div className="upload-progress-track">
                <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
          {uploadComplete && !isUploading && (
            <div className="alert-success">Upload complete</div>
          )}
          {error && (
            <div className="alert-error">{error}</div>
          )}
        </div>
      </div>
    </>
  )
}
