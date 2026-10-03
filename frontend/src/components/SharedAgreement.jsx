import { useCallback, useEffect, useState } from 'react'
import { downloadPdf, request } from '../api'
import AgreementDocument from './AgreementDocument'
import SignaturePanel from './SignaturePanel'

export default function SharedAgreement({ token, notify }) {
  const [a, setA] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const base = `share/${token}/`

  useEffect(() => {
    request(base).then(setA).catch((err) => setError(err.message))
  }, [base])

  const post = useCallback(
    async (path, body, message) => {
      setBusy(true)
      try {
        setA(await request(base + path, { method: 'POST', body }))
        if (message) notify(message)
        setRejecting(false)
      } catch (err) {
        notify(err.message, 'error')
      } finally {
        setBusy(false)
      }
    },
    [base, notify]
  )

  async function pdf() {
    try {
      await downloadPdf(`${base}pdf/`, `${a.reference}.pdf`)
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  const can = (x) => a?.available_actions.includes(x)

  return (
    <div className="shared-page">
      <header className="shared-top">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>Accord</strong>
            <span>Shared agreement</span>
          </div>
        </div>
      </header>

      <div className="shared-body">
        {error && (
          <div className="empty">
            <h4>Link not available</h4>
            <p>{error}</p>
          </div>
        )}
        {!a && !error && <div className="empty"><div className="loader"></div></div>}

        {a && (
          <>
            {a.is_owner_preview && (
              <div className="banner">You're previewing this as the owner. Counterparty actions are hidden.</div>
            )}

            <AgreementDocument a={a} />

            <div className="action-bar">
              {can('accept') && (
                <button className="primary-button" disabled={busy} onClick={() => post('respond/', { action: 'accept' }, 'Accepted. You can now sign.')}>
                  Accept and continue to sign
                </button>
              )}
              {can('continue') && (
                <button className="secondary-button" disabled={busy} onClick={() => post('respond/', { action: 'continue' })}>
                  Mark as in review
                </button>
              )}
              {can('reject') && (
                <button className="danger-button" onClick={() => setRejecting(true)}>Reject</button>
              )}
              <button className="secondary-button" onClick={pdf}>Download PDF</button>
            </div>

            {can('sign') && (
              <SignaturePanel
                roleLabel="Party 2"
                defaultName={a.party_two_name}
                defaultEmail={a.party_two_email}
                needsEmail
                busy={busy}
                onSign={(payload) => post('sign/', payload, 'Thank you. Your signature was recorded.')}
              />
            )}

            {a.status === 'Signed' && <div className="banner ok">This agreement is fully signed.</div>}
          </>
        )}
      </div>

      {rejecting && (
        <div className="modal-overlay" onClick={() => setRejecting(false)}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <h3>Reject this agreement</h3>
            <label className="field">
              <span>Reason (optional)</span>
              <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div className="modal-actions end">
              <button className="secondary-button" onClick={() => setRejecting(false)}>Cancel</button>
              <button className="danger-button" disabled={busy} onClick={() => post('reject/', { reason }, 'You rejected this agreement.')}>
                {busy ? 'Please wait...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}