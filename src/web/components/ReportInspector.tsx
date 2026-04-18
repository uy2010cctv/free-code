import React from 'react'
import type { ReportPlan } from '../types'

interface ReportInspectorProps {
  plan: ReportPlan | null
}

export function ReportInspector({ plan }: ReportInspectorProps) {
  if (!plan) return null

  return (
    <section className="enterprise-panel report-panel" data-testid="admin-report-inspector">
      <h3>{plan.reportType}</h3>
      <p>{plan.summary}</p>
      <div className="trace-list">
        {plan.trace.map(item => (
          <div key={`${item.sourceType}-${item.sourceId}`} className="trace-row">
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </div>
        ))}
      </div>
      <div className="export-list">
        {plan.exports.map(format => (
          <span key={format} className="export-chip">{format}</span>
        ))}
      </div>
    </section>
  )
}
