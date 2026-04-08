import React from 'react'
import type { ToolResult } from '../types'

interface ToolResultPanelProps {
  toolName: string
  input: Record<string, any>
  result: ToolResult
  isExpanded?: boolean
}

export function ToolResultPanel({ toolName, input, result, isExpanded = false }: ToolResultPanelProps) {
  const [expanded, setExpanded] = React.useState(isExpanded)

  const formatInput = (input: Record<string, any>) => {
    const lines: string[] = []
    for (const [key, value] of Object.entries(input)) {
      const displayValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      lines.push(`${key}: ${displayValue}`)
    }
    return lines.join('\n')
  }

  const isLargeOutput = result.output && result.output.length > 500
  const [showFull, setShowFull] = React.useState(false)

  const displayOutput = result.output
    ? (isLargeOutput && !showFull ? result.output.slice(0, 500) + '\n\n[...]' : result.output)
    : result.error

  return (
    <div className="tool-result-panel">
      <div className="tool-result-header" onClick={() => setExpanded(!expanded)}>
        <div className="tool-result-title">
          <span className={`tool-status-dot ${result.success ? 'success' : 'error'}`} />
          <span className="tool-name">{toolName}</span>
        </div>
        <button className="tool-expand-btn">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="tool-result-body">
          <div className="tool-input-section">
            <div className="tool-section-label">Input:</div>
            <pre className="tool-input-code">{formatInput(input)}</pre>
          </div>

          <div className="tool-output-section">
            <div className="tool-section-label">Output:</div>
            <pre className={`tool-output-code ${result.success ? '' : 'error'}`}>
              {displayOutput}
            </pre>
            {isLargeOutput && (
              <button
                className="tool-show-more-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowFull(!showFull)
                }}
              >
                {showFull ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
