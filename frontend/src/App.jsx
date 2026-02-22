import { Routes, Route, Link } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import PreviewPage from './pages/PreviewPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <div style={{ padding: '1rem', maxWidth: 960, margin: '0 auto' }}>
      <nav style={{ marginBottom: '1.5rem' }}>
        <Link to="/" style={{ marginRight: '1rem' }}>Upload</Link>
        <Link to="/preview" style={{ marginRight: '1rem' }}>Preview</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </div>
  )
}
