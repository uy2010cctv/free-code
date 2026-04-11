import React, { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'

interface ExcelPreviewProps {
  filePath: string
  onError?: (error: string) => void
}

export function ExcelPreview({ filePath, onError }: ExcelPreviewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [activeSheet, setActiveSheet] = useState<string>('')
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [zoom, setZoom] = useState(100)

  useEffect(() => {
    if (!filePath) return

    const loadWorkbook = async () => {
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

        setLoading(false)
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to render spreadsheet'
        setError(errorMsg)
        setLoading(false)
        onError?.(errorMsg)
      }
    }

    loadWorkbook()
  }, [filePath, onError])

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50))

  const getSheetData = () => {
    if (!workbook || !activeSheet) return []
    const worksheet = workbook.Sheets[activeSheet]
    return XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
  }

  const hasFormulas = (cellRef: string) => {
    if (!workbook || !activeSheet) return false
    const worksheet = workbook.Sheets[activeSheet]
    const cell = worksheet[cellRef]
    return cell?.f ? true : false
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
      </div>
    )
  }

  const sheetData = getSheetData()

  return (
    <div className="excel-preview-container">
      <div className="preview-toolbar">
        <button onClick={handleZoomOut} title="Zoom Out">−</button>
        <span>{zoom}%</span>
        <button onClick={handleZoomIn} title="Zoom In">+</button>
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
