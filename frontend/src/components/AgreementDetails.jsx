import { useCallback, useEffect, useState } from 'react'
import { downloadPdf, request } from '../api'
import AgreementDocument from './AgreementDocument'
import AgreementHistory from './AgreementHistory'
import ConfirmModal from './ConfirmModal'
import ShareModal from './ShareModal'
import SignaturePanel from './SignaturePanel'

const DIALOGS = {
  send: {
    title: 'Send this agreement?',
    message: 'It will be locked for editing and the other party can open it with the private link.',
    label: 'Send',
  },
  reopen: {
    title: 'Reopen as draft?',
    message: 'Any signatures will be removed and the current share link will stop working.',
    label: 'Reopen',
    danger: true,
  },
  delete: {
    title: 'Delete this agreement?',
    message: 'This permanently removes the agreement and its history.',
    label: 'Delete',
    danger: true,
  },
}

export default function AgreementDetails({ agreementId, navigate, notify, upsert, remove }) {
  const [a, setA] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await request(`${agreementId}/`)
      setA(data)
      upsert(data)
    } catch (err) {
      setError(err.message)
    }
  }, [agreementId, upsert])

  useEffect(() => {
    load()
  }, [load])

  async function run(path, body, message) {
    setBusy(true)
    try {
      const data = await request(`${agreementId}/${path}/`, { method: 'POST', body: body || {} })
      setA(data)
      upsert(data)
      if (message) notify(message)
      setDialog(null)
    } catch (err) {
      notify(err.message, 'error')
      setDialog(null)
    } finally {
      setBusy(false)
    }
  }

  async function destroy() {
    setBusy(true)
    try {
      await request(`${agreementId}/`, { method: 'DELETE' })
      remove(a.id)
      notify('Agreement deleted.')
      navigate('/')
    } catch (err) {
      notify(err.message, 'error')
      setDialog(null)
    } finally {
      setBusy(false)
    }
  }

  async function pdf() {
    try {
      await downloadPdf(`${agreementId}/pdf/`, `${a.reference}.pdf`)
      load()
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  if (error) {
    return (
      <div className="empty">
        <div className="error-box">{error}</div>
        <button className="secondary-button" onClick={() => navigate('/')}>Back to dashboard</button>
      </div>
    )
  }
  if (!a) return <div className="empty"><div className="loader"></div></div>

  const can = (action) => a.available_actions.includes(action)
  const confirm = {
    send: () => run('send', {}, 'Agreement sent. Copy the link to share it.'),
    reopen: () => run('reopen', {}, 'Agreement reopened as a draft.'),
    delete: destroy,
  }

  return (
    <>
      <button className="back-link" onClick={() => navigate('/')}>← All agreements</button>

      <div className="action-bar">
        {can('edit') && <button className="secondary-button" onClick={() => navigate(`/agreements/${a.id}/edit`)}>Edit</button>}
        {can('send') && <button className="primary-button" onClick={() => setDialog('send')}>Send</button>}
        {can('share') && <button className="secondary-button" onClick={() => setDialog('share')}>Share link</button>}
        {can('pdf') && <button className="secondary-button" onClick={pdf}>Download PDF</button>}
        {can('reopen') && <button className="secondary-button" onClick={() => setDialog('reopen')}>Reopen as draft</button>}
        {can('delete') && <button className="danger-button" onClick={() => setDialog('delete')}>Delete</button>}
      </div>

      <div className="detail-layout">
        <AgreementDocument a={a} />
        <aside>
          {can('sign') && (
            <SignaturePanel
              roleLabel="Party 1"
              defaultName={a.party_one_name}
              busy={busy}
              onSign={(payload) => run('sign', payload, 'Your signature was added.')}
            />
          )}
          <AgreementHistory items={a.history} />
        </aside>
      </div>

      {DIALOGS[dialog] && (
        <ConfirmModal
          title={DIALOGS[dialog].title}
          message={DIALOGS[dialog].message}
          confirmLabel={DIALOGS[dialog].label}
          danger={DIALOGS[dialog].danger}
          busy={busy}
          onConfirm={confirm[dialog]}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'share' && (
        <ShareModal agreementId={a.id} notify={notify} onClose={() => { setDialog(null); load() }} />
      )}
    </>
  )
}