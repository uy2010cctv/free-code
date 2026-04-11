import React, { useEffect, useRef, useState, useCallback } from 'react'
import { renderAsync } from 'docx-preview'

interface DocxPreviewProps {
  filePath: string
  onError?: (error: string) => void
  refreshKey?: number
}

export function DocxPreview({ filePath, onError, refreshKey = 0 }: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const loadTimeRef = useRef(0)

  const loadDocument = useCallback(async () => {
    if (!filePath || !containerRef.current) return

    const startTime = performance.now()
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

      loadTimeRef.current = performance.now() - startTime
      setLoading(false)
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to render document'
      setError(errorMsg)
      setLoading(false)
      onError?.(errorMsg)
    }
  }, [filePath, onError])

  useEffect(() => {
    loadDocument()
  }, [filePath, loadDocument, refreshKey])

  // Handle ESC key for fullscreen exit
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleRefresh = () => {
    loadDocument()
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50))

  const handleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await wrapperRef.current?.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`)
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`)
      }
      const data = await response.json()
      const buffer = Uint8Array.from(atob(data.content), c => c.charCodeAt(0))
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filePath.split('/').pop() || 'document.docx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      onError?.(err.message || 'Download failed')
    }
  }

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
        <button onClick={handleRefresh}>Retry</button>
      </div>
    )
  }

  return (
    <div className="docx-preview-container" ref={wrapperRef}>
      <div className="preview-toolbar">
        <button onClick={handleRefresh} title="Refresh">↻</button>
        <button onClick={handleDownload} title="Download">↓</button>
        <button onClick={handleZoomOut} title="Zoom Out">−</button>
        <span>{zoom}%</span>
        <button onClick={handleZoomIn} title="Zoom In">+</button>
        <button onClick={handleFullscreen} title="Fullscreen">
          {isFullscreen ? '⊠' : '⊞'}
        </button>
        {loadTimeRef.current > 0 && (
          <span className="load-time">{loadTimeRef.current.toFixed(0)}ms</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="docx-preview-wrapper"
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
      />
    </div>
  )
}
