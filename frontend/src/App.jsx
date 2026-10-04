import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { request, setUnauthorizedHandler } from './api'
import AuthScreen from './components/AuthScreen'
import Navbar from './components/Navbar'
import Dashboard from './components/Dashboard'
import AgreementEditor from './components/AgreementEditor'
import AgreementDetails from './components/AgreementDetails'
import SharedAgreement from './components/SharedAgreement'
import ResetPassword from './components/ResetPassword'

function useRoute() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to)
    setPath(to)
    window.scrollTo(0, 0)
  }, [])

  return [path, navigate]
}

export default function App() {
  const [path, navigate] = useRoute()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [agreements, setAgreements] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [toast, setToast] = useState(null)

  const shareMatch = path.match(/^\/agreement\/share\/([^/]+)\/?$/)
  const isShare = Boolean(shareMatch)
  const resetMatch = path.match(/^\/reset-password\/([^/]+)\/([^/]+)\/?$/)

  const notify = useCallback((text, type = 'success') => {
    setToast({ text, type, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setAgreements([])
    })
  }, [])

  useEffect(() => {
    request('me/')
      .then((data) => {
        if (data.authenticated) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  const loadAgreements = useCallback(async () => {
    setListLoading(true)
    setListError('')
    try {
      const data = await request('')
      setAgreements(Array.isArray(data) ? data : [])
    } catch (error) {
      setListError(error.message)
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user && !isShare) loadAgreements()
  }, [user, isShare, loadAgreements])

  const upsert = useCallback((item) => {
    setAgreements((previous) =>
      previous.some((a) => a.id === item.id)
        ? previous.map((a) => (a.id === item.id ? { ...a, ...item } : a))
        : [item, ...previous]
    )
  }, [])

  const remove = useCallback((id) => {
    setAgreements((previous) => previous.filter((a) => a.id !== id))
  }, [])

  async function logout() {
    try {
      await request('logout/', { method: 'POST' })
    } catch {
      /* ignore: we clear local state either way */
    }
    setUser(null)
    setAgreements([])
    navigate('/')
  }

  const toastEl = toast && (
    <div className={`toast ${toast.type}`} role="status" key={toast.id}>
      {toast.text}
    </div>
  )

    if (resetMatch) {
    return (
      <>
        <ResetPassword uid={resetMatch[1]} token={resetMatch[2]} navigate={navigate} notify={notify} />
        {toastEl}
      </>
    )
  }

  // Public counterparty page (no login needed)
  if (isShare) {
    return (
      <>
        <SharedAgreement token={shareMatch[1]} notify={notify} />
        {toastEl}
      </>
    )
  }

  if (authLoading) {
    return (
      <div className="screen-center">
        <div className="loader"></div>
        <p>Loading Accord...</p>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen onAuthed={setUser} />
  }

  let page
  let match
  if (path === '/agreements/new') {
    page = (
      <AgreementEditor key="new" user={user} navigate={navigate} notify={notify} upsert={upsert} />
    )
  } else if ((match = path.match(/^\/agreements\/(\d+)\/edit\/?$/))) {
    page = (
      <AgreementEditor
        key={`edit-${match[1]}`}
        agreementId={match[1]}
        user={user}
        navigate={navigate}
        notify={notify}
        upsert={upsert}
      />
    )
  } else if ((match = path.match(/^\/agreements\/(\d+)\/?$/))) {
    page = (
      <AgreementDetails
        key={`view-${match[1]}`}
        agreementId={match[1]}
        navigate={navigate}
        notify={notify}
        upsert={upsert}
        remove={remove}
      />
    )
  } else {
    page = (
      <Dashboard
        user={user}
        agreements={agreements}
        loading={listLoading}
        error={listError}
        onRetry={loadAgreements}
        navigate={navigate}
      />
    )
  }

  return (
    <div className="app">
      <Navbar user={user} onLogout={logout} onHome={() => navigate('/')} />
      <main className="dashboard">{page}</main>
      <footer>
        <strong>Accord</strong>
        <span>Simple agreements. Clear outcomes.</span>
      </footer>
      {toastEl}
    </div>
  )
}