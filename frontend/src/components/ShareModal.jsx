import { useEffect, useState } from 'react'
import { request } from '../api'

export default function ShareModal({ agreementId, onClose, notify }) {
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [confirmNew, setConfirmNew] = useState(false)

  async function load(regenerate = false) {
    try {
      setInfo(await request(`${agreementId}/share/`, { method: 'POST', body: { regenerate } }))
      setConfirmNew(false)
      if (regenerate) notify('New link created. The old link no longer works.')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const url = info ? `${window.location.origin}${info.share_path}` : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      notify('Link copied.')
    } catch {
      notify('Could not copy. Select the link and copy it manually.', 'error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">PRIVATE LINK</span>
            <h3>Share agreement</h3>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {error && <div className="error-box">{error}</div>}
        {!info && !error && <div className="loader"></div>}

        {info && (
          <>
            <p className="muted">
              Anyone with this link can view only this agreement. Share it just with the other party.
            </p>
            <div className="share-box">
              <input readOnly value={url} onFocus={(e) => e.target.select()} />
              <button className="primary-button" onClick={copy}>Copy</button>
            </div>
            {!info.live && (
              <p className="muted">This link starts working once you send the agreement.</p>
            )}
            <div className="modal-actions">
              <button
                className={confirmNew ? 'danger-button' : 'secondary-button'}
                onClick={() => (confirmNew ? load(true) : setConfirmNew(true))}
              >
                {confirmNew ? 'Click again to replace the link' : 'Generate new link'}
              </button>
              <button className="secondary-button" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}