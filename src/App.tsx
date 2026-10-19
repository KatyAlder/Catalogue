import { useEffect } from 'react'
import { CLIENT_ID } from './auth/google'
import { doSignIn, doSignOut, startApp, useAppState } from './data/store'
import type { SyncStatus } from './data/store'

const STATUS_TEXT: Record<SyncStatus, string> = {
  local: 'локально',
  syncing: 'синхронізація…',
  synced: 'збережено в Google Drive',
  error: 'помилка синхронізації',
  'needs-auth': 'потрібен вхід',
}

export default function App() {
  const { db, status, signedIn, message } = useAppState()

  useEffect(() => {
    void startApp()
  }, [])

  const showSignIn = !!CLIENT_ID && (!signedIn || status === 'needs-auth')

  return (
    <div className="app">
      <header className="topbar">
        <h1>Шафа</h1>
        <div className="topbar-right">
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
      <main className="wardrobe">
        {db.index.shelves.map((shelf) => (
          <section key={shelf.id} className="shelf">
            {db.index.settings.showShelfNames && <h2>{shelf.name}</h2>}
            <div className="shelf-row">
              {shelf.collectionIds.length === 0 && (
                <span className="empty">Полиця порожня</span>
              )}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
