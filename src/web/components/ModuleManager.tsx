import React from 'react'
import type { BusinessModule } from '../types'
import { parseCommaSeparated, slugifyName } from '../utils/enterpriseForm'

interface ModuleManagerProps {
  modules: BusinessModule[]
  selectedModuleIds: string[]
  onToggleModule: (id: string) => void
  onPublishModule?: (id: string) => void
  allowPublish?: boolean
  isAdmin?: boolean
  onCreateModule?: (input: {
    id: string
    name: string
    description: string
    prompts: string[]
    requiredConnectorKinds: BusinessModule['requiredConnectorKinds']
    reportTemplates: string[]
    outputFormats: BusinessModule['outputFormats']
  }) => void
  onRefreshModule?: (id: string) => void
}

export function ModuleManager({
  modules,
  selectedModuleIds,
  onToggleModule,
  onPublishModule,
  allowPublish = false,
  isAdmin = false,
  onCreateModule,
  onRefreshModule,
}: ModuleManagerProps) {
  const [form, setForm] = React.useState({
    name: '',
    description: '',
    prompts: '',
    reportTemplates: '',
    connectorKinds: ['database'] as BusinessModule['requiredConnectorKinds'],
    outputFormats: ['docx', 'xlsx', 'report'] as BusinessModule['outputFormats'],
  })
  const [pendingPublishModuleId, setPendingPublishModuleId] = React.useState<string | null>(null)
  const pendingPublishModule = pendingPublishModuleId
    ? modules.find(m => m.id === pendingPublishModuleId)
    : null

  function toggleConnectorKind(kind: BusinessModule['requiredConnectorKinds'][number]) {
    setForm(prev => ({
      ...prev,
      connectorKinds: prev.connectorKinds.includes(kind)
        ? prev.connectorKinds.filter(item => item !== kind)
        : [...prev.connectorKinds, kind],
    }))
  }

  function toggleOutputFormat(format: BusinessModule['outputFormats'][number]) {
    setForm(prev => ({
      ...prev,
      outputFormats: prev.outputFormats.includes(format)
        ? prev.outputFormats.filter(item => item !== format)
        : [...prev.outputFormats, format],
    }))
  }

  function submitModule() {
    const name = form.name.trim()
    if (!name) return

    onCreateModule?.({
      id: slugifyName(name),
      name,
      description: form.description.trim(),
      prompts: parseCommaSeparated(form.prompts),
      requiredConnectorKinds: form.connectorKinds,
      reportTemplates: parseCommaSeparated(form.reportTemplates),
      outputFormats: form.outputFormats,
    })

    setForm({
      name: '',
      description: '',
      prompts: '',
      reportTemplates: '',
      connectorKinds: ['database'],
      outputFormats: ['docx', 'xlsx', 'report'],
    })
  }

  return (
    <section className="enterprise-panel" data-testid="admin-modules">
      <h3>Business Modules</h3>
      {isAdmin && (
        <div className="enterprise-form">
          <input
            value={form.name}
            onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
            placeholder="Module name"
          />
          <input
            value={form.description}
            onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
            placeholder="Description"
          />
          <input
            value={form.prompts}
            onChange={event => setForm(prev => ({ ...prev, prompts: event.target.value }))}
            placeholder="Prompts (comma separated)"
          />
          <input
            value={form.reportTemplates}
            onChange={event => setForm(prev => ({ ...prev, reportTemplates: event.target.value }))}
            placeholder="Report templates (comma separated)"
          />
          <div className="enterprise-checklist">
            {(['file', 'database', 'external'] as const).map(kind => (
              <label key={kind}>
                <input
                  type="checkbox"
                  checked={form.connectorKinds.includes(kind)}
                  onChange={() => toggleConnectorKind(kind)}
                />
                <span>{kind}</span>
              </label>
            ))}
          </div>
          <div className="enterprise-checklist">
            {(['docx', 'xlsx', 'report'] as const).map(format => (
              <label key={format}>
                <input
                  type="checkbox"
                  checked={form.outputFormats.includes(format)}
                  onChange={() => toggleOutputFormat(format)}
                />
                <span>{format}</span>
              </label>
            ))}
          </div>
          <button type="button" className="enterprise-action-btn" onClick={submitModule}>
            Save Draft Module
          </button>
        </div>
      )}
      <div className="enterprise-panel-body">
        {modules.length === 0 ? (
          <div className="enterprise-empty-state">
            <div className="enterprise-empty-icon">M</div>
            <div className="enterprise-empty-title">No Modules</div>
            <div className="enterprise-empty-description">
              Add modules in Admin Studio to enable enterprise capabilities.
              Business modules define prompts, report templates, and connector requirements.
            </div>
          </div>
        ) : modules.map(module => (
          <label key={module.id} className="enterprise-row" data-testid={`admin-module-row-${module.id}`}>
            <input
              type="checkbox"
              checked={selectedModuleIds.includes(module.id)}
              onChange={() => onToggleModule(module.id)}
            />
            <div className="enterprise-main">
              <strong>{module.name}</strong>
              <span>{module.description}</span>
            </div>
            <div className="enterprise-sidecar">
              <span className="module-version">v{module.version}</span>
              <span className={`status-badge status-${module.lifecycleState}`}>
                {module.lifecycleState}
              </span>
              {isAdmin && (
                <button
                  type="button"
                  className="enterprise-action-btn"
                  onClick={event => {
                    event.preventDefault()
                    onRefreshModule?.(module.id)
                  }}
                >
                  Refresh
                </button>
              )}
              {allowPublish && (
                <button
                  type="button"
                  className="enterprise-action-btn"
                  disabled={module.lifecycleState === 'published'}
                  onClick={event => {
                    event.preventDefault()
                    setPendingPublishModuleId(module.id)
                  }}
                >
                  {module.lifecycleState === 'published' ? 'Published' : 'Publish'}
                </button>
              )}
            </div>
          </label>
        ))}
      </div>
      {pendingPublishModule && (
        <div className="enterprise-confirm-overlay">
          <div className="enterprise-confirm-dialog">
            <h4>Confirm Publish</h4>
            <p>Publish <strong>{pendingPublishModule.name}</strong> to the live enterprise agent environment?</p>
            <div className="enterprise-confirm-actions">
              <button
                type="button"
                className="enterprise-action-btn"
                onClick={() => setPendingPublishModuleId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="enterprise-action-btn enterprise-action-btn-primary"
                onClick={() => {
                  onPublishModule?.(pendingPublishModule.id)
                  setPendingPublishModuleId(null)
                }}
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
