import React, { useEffect, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'

interface DocxPreviewProps {
  filePath: string
  onError?: (error: string) => void
}

export function DocxPreview({ filePath, onError }: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)

  useEffect(() => {
    if (!filePath || !containerRef.current) return

    const loadDocument = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`)
        if (!response.ok) {
          throw new Error(`Failed to load document: ${response.statusText}`)
        }

        const data = await response.json()
        // Content is base64 encoded
        const buffer = Uint8Array.from(atob(data.content), c => c.charCodeAt(0))

        // Clear container
        if (containerRef.current) {
          containerRef.current.innerHTML = ''
        }

        // Render docx
        await renderAsync(buffer, containerRef.current, undefined, {
          className: 'docx-preview-content',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderChanges: false,
          renderRevision: false,
          view: 'preview',
        })

        setLoading(false)
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to render document'
        setError(errorMsg)
        setLoading(false)
        onError?.(errorMsg)
      }
    }

    loadDocument()
  }, [filePath, onError])

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50))

  if (loading) {
    return (
      <div className="docx-preview-loading">
        <div className="loading-spinner" />
        <p>Loading document...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="docx-preview-error">
        <p>Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="docx-preview-container">
      <div className="preview-toolbar">
        <button onClick={handleZoomOut} title="Zoom Out">−</button>
        <span>{zoom}%</span>
        <button onClick={handleZoomIn} title="Zoom In">+</button>
      </div>
      <div
        ref={containerRef}
        className="docx-preview-wrapper"
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
      />
    </div>
  )
}
