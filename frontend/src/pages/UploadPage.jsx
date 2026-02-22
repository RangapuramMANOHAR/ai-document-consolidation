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
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1>Upload</h1>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: `2px dashed ${dragOver ? '#06c' : '#ccc'}`,
          borderRadius: 8,
          padding: '2rem',
          textAlign: 'center',
          marginBottom: '1rem',
        }}
      >
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.zip"
          onChange={handleSelect}
          style={{ marginBottom: '0.5rem' }}
        />
        <p style={{ color: '#666' }}>or drag and drop a file</p>
        {file && <p><strong>{file.name}</strong></p>}
      </div>
      {isUploading && (
        <div style={{ marginBottom: '1rem' }}>
          <p>Uploading… {uploadProgress}%</p>
          <div
            style={{
              width: '100%',
              height: 8,
              backgroundColor: '#e0e0e0',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: '#06c',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
      )}
      {uploadComplete && !isUploading && <p style={{ color: '#2e7d32' }}>Upload complete</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button onClick={handleUpload} disabled={!file || isUploading}>
        Upload
      </button>
    </div>
  )
}
