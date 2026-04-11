import React, { useEffect, useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'

interface ExcelPreviewProps {
  filePath: string
  onError?: (error: string) => void
  refreshKey?: number
}

export function ExcelPreview({ filePath, onError, refreshKey = 0 }: ExcelPreviewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [activeSheet, setActiveSheet] = useState<string>('')
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const loadTimeRef = useRef(0)

  const loadWorkbook = useCallback(async () => {
    if (!filePath) return

    const startTime = performance.now()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`)
      if (!response.ok) {
        throw new Error(`Failed to load workbook: ${response.statusText}`)
      }

      const data = await response.json()
      // Content is base64 encoded
      const buffer = Uint8Array.from(atob(data.content), c => c.charCodeAt(0))

      const wb = XLSX.read(buffer, { type: 'array' })
      setWorkbook(wb)
      setSheetNames(wb.SheetNames)
      if (wb.SheetNames.length > 0) {
        setActiveSheet(wb.SheetNames[0])
      }

      loadTimeRef.current = performance.now() - startTime
      setLoading(false)
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to render spreadsheet'
      setError(errorMsg)
      setLoading(false)
      onError?.(errorMsg)
    }
  }, [filePath, onError])

  useEffect(() => {
    loadWorkbook()
  }, [filePath, loadWorkbook, refreshKey])

  // Handle ESC key for fullscreen exit
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleRefresh = () => {
    loadWorkbook()
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
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filePath.split('/').pop() || 'spreadsheet.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      onError?.(err.message || 'Download failed')
    }
  }

  const getSheetData = () => {
    if (!workbook || !activeSheet) return []
    const worksheet = workbook.Sheets[activeSheet]
    return XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
  }

  const getCellInfo = (cellRef: string, value: any) => {
    if (!workbook || !activeSheet) return { value, formula: null }
    const worksheet = workbook.Sheets[activeSheet]
    const cell = worksheet[cellRef]
    return {
      value,
      formula: cell?.f || null,
    }
  }

  if (loading) {
    return (
      <div className="excel-preview-loading">
        <div className="loading-spinner" />
        <p>Loading spreadsheet...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="excel-preview-error">
        <p>Error: {error}</p>
        <button onClick={handleRefresh}>Retry</button>
      </div>
    )
  }

  const sheetData = getSheetData()

  return (
    <div className="excel-preview-container" ref={wrapperRef}>
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

      {sheetNames.length > 1 && (
        <div className="sheet-tabs">
          {sheetNames.map(name => (
            <button
              key={name}
              className={`sheet-tab ${name === activeSheet ? 'active' : ''}`}
              onClick={() => setActiveSheet(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="excel-table-wrapper" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
        <table className="excel-preview-table">
          <tbody>
            {sheetData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell: any, colIndex: number) => {
                  const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
                  const { value, formula } = getCellInfo(cellRef, cell)
                  const displayValue = formula ? `[${formula}]` : value
                  return (
                    <td key={colIndex} className={formula ? 'has-formula' : ''} title={formula ? `Formula: ${formula}` : ''}>
                      {displayValue}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
