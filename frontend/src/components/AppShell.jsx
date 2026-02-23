import { NavLink, Outlet } from 'react-router-dom'

export default function AppShell() {
  return (
    <>
      <header className="navbar">
        <div className="navbar-inner">
          <NavLink to="/" className="navbar-brand" end>
            AI Document Consolidation
          </NavLink>
          <nav className="navbar-links">
            <NavLink to="/" className="navbar-link" end>Upload</NavLink>
            <NavLink to="/preview" className="navbar-link">Invoices</NavLink>
            <NavLink to="/dashboard" className="navbar-link">KPI Dashboard</NavLink>
          </nav>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
