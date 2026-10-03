export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="modal-overlay" onClick={busy ? undefined : onCancel}>
      <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="muted">{message}</p>
        <div className="modal-actions end">
          <button className="secondary-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={danger ? 'danger-button' : 'primary-button'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}