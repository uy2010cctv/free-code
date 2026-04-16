import React, { useEffect, useRef, useState, useCallback } from 'react'
import mammoth from 'mammoth'

interface DocxPreviewProps {
  filePath: string
  sessionId?: string
  onError?: (error: string) => void
  refreshKey?: number
}

export function DocxPreview({ filePath, sessionId, onError, refreshKey = 0 }: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [textContent, setTextContent] = useState('')
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const loadTimeRef = useRef(0)

  const loadDocument = useCallback(async () => {
    if (!filePath) return

    console.log('[DocxPreview] Loading:', filePath)
    setLoading(true)
    setError(null)

    try {
      let url: string
      if (sessionId) {
        const fileName = filePath.split('/').pop() || filePath
        url = `/api/sessions/${sessionId}/workspace/read?path=${encodeURIComponent(fileName)}`
      } else {
        url = `/api/files/read?path=${encodeURIComponent(filePath)}`
      }

      console.log('[DocxPreview] Fetching:', url)
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('[DocxPreview] Response:', { isBinary: data.isBinary, contentLen: data.content?.length })

      // Decode base64
      const binaryString = atob(data.content)
      const arrayBuffer = new ArrayBuffer(binaryString.length)
      const view = new Uint8Array(arrayBuffer)
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i)
      }
      console.log('[DocxPreview] ArrayBuffer size:', arrayBuffer.byteLength)

      // Try extractRawText first (most reliable)
      // Note: browser version uses arrayBuffer, Node uses buffer
      console.log('[DocxPreview] Calling mammoth.extractRawText...')
      const textResult = await mammoth.extractRawText({ arrayBuffer })
      console.log('[DocxPreview] Raw text extracted:', textResult.value.substring(0, 100))

      setTextContent(textResult.value)
      loadTimeRef.current = performance.now() - loadTimeRef.current
      setLoading(false)
    } catch (err: any) {
      console.error('[DocxPreview] Error:', err)
      setError(err.message || 'Failed to render document')
      setLoading(false)
      onError?.(err.message)
    }
  }, [filePath, sessionId, onError])

  useEffect(() => {
    loadTimeRef.current = performance.now()
    loadDocument()
  }, [filePath, loadDocument, refreshKey])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleRefresh = () => loadDocument()
  const handleZoomIn = () => setZoom(z => Math.min(z + 10, 200))
  const handleZoomOut = () => setZoom(z => Math.max(z - 10, 50))
  const handleFullscreen = () => wrapperRef.current?.requestFullscreen?.()

  const handleDownload = async () => {
    try {
      let url = sessionId
        ? `/api/sessions/${sessionId}/workspace/read?path=${encodeURIComponent(filePath.split('/').pop()!)}`
        : `/api/files/read?path=${encodeURIComponent(filePath)}`
      const res = await fetch(url)
      const data = await res.json()
      const blob = new Blob([Uint8Array.from(atob(data.content).split('').map(c => c.charCodeAt(0)))], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filePath.split('/').pop()!
      a.click()
    } catch (e: any) {
      onError?.(e.message)
    }
  }

  if (loading) return <div className="docx-preview-loading"><div className="loading-spinner" /><p>Loading document...</p></div>
  if (error) return <div className="docx-preview-error"><p>Error: {error}</p><button onClick={handleRefresh}>Retry</button></div>

  return (
    <div className="docx-preview-container" ref={wrapperRef}>
      <div className="preview-toolbar">
        <button onClick={handleRefresh}>↻</button>
        <button onClick={handleDownload}>↓</button>
        <button onClick={handleZoomOut}>−</button>
        <span>{zoom}%</span>
        <button onClick={handleZoomIn}>+</button>
        <button onClick={handleFullscreen}>{isFullscreen ? '⊠' : '⊞'}</button>
        <span className="load-time">{loadTimeRef.current > 0 ? `${loadTimeRef.current.toFixed(0)}ms` : ''}</span>
      </div>
      <div
        ref={containerRef}
        className="docx-preview-wrapper"
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
      >
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '14px', lineHeight: '1.6' }}>
          {textContent || '(empty document)'}
        </pre>
      </div>
    </div>
  )
}
