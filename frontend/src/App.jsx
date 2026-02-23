import { Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell'
import UploadPage from './pages/UploadPage'
import PreviewPage from './pages/PreviewPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<UploadPage />} />
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>
    </Routes>
  )
}
