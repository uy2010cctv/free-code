import React from 'react'

interface ToastProps {
  toasts: Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-dismiss" onClick={() => onDismiss(toast.id)}>x</button>
        </div>
      ))}
    </div>
  )
}