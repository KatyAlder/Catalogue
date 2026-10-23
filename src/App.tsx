import { useEffect } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { CLIENT_ID } from './auth/google'
import { doSignIn, doSignOut, startApp, useAppState } from './data/store'
import type { SyncStatus } from './data/store'
import Audit from './pages/Audit'
import CollectionEdit from './pages/CollectionEdit'
import CollectionPage from './pages/CollectionPage'
import RecordEdit from './pages/RecordEdit'
import Search from './pages/Search'
import Wardrobe from './pages/Wardrobe'

const STATUS_TEXT: Record<SyncStatus, string> = {
  local: 'локально',
  syncing: 'синхронізація…',
  synced: 'збережено в Google Drive',
  error: 'помилка синхронізації',
  'needs-auth': 'потрібен вхід',
}

export default function App() {
  const { status, signedIn, message } = useAppState()

  useEffect(() => {
    void startApp()
  }, [])

  const showSignIn = !!CLIENT_ID && (!signedIn || status === 'needs-auth')

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <Link to="/">Шафа</Link>
        </h1>
        <div className="topbar-right">
          <Link to="/search" className="btn ghost">
            Пошук
          </Link>
          <span className={`badge ${status}`}>{STATUS_TEXT[status]}</span>
          {showSignIn && (
            <button className="btn" onClick={() => void doSignIn()}>
              Увійти через Google
            </button>
          )}
          {signedIn && status !== 'needs-auth' && (
            <button className="btn ghost" onClick={doSignOut}>
              Вийти
            </button>
          )}
        </div>
      </header>
      {message && <p className="notice">{message}</p>}
      <Routes>
        <Route path="/" element={<Wardrobe />} />
        <Route path="/new" element={<CollectionEdit />} />
        <Route path="/c/:id" element={<CollectionPage />} />
        <Route path="/c/:id/edit" element={<CollectionEdit />} />
        <Route path="/c/:id/audit" element={<Audit />} />
        <Route path="/c/:id/r/new" element={<RecordEdit />} />
        <Route path="/c/:id/r/:rid" element={<RecordEdit />} />
        <Route path="/search" element={<Search />} />
        <Route path="*" element={<Wardrobe />} />
      </Routes>
    </div>
  )
}
