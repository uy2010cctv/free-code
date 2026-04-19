import React from 'react'
import type { DataSourceConnector } from '../types'
import { parseCommaSeparated, slugifyName } from '../utils/enterpriseForm'

interface DataSourceManagerProps {
  connectors: DataSourceConnector[]
  selectedConnectorIds: string[]
  onToggleConnector: (id: string) => void
  isAdmin?: boolean
  onCreateConnector?: (input: {
    id: string
    name: string
    kind: DataSourceConnector['kind']
    description: string
    capabilities: string[]
    schemaHints: string[]
    authType: DataSourceConnector['authType']
    status: DataSourceConnector['status']
    compatibilityStatus: DataSourceConnector['compatibilityStatus']
  }) => void
}

export function DataSourceManager({
  connectors,
  selectedConnectorIds,
  onToggleConnector,
  isAdmin = false,
  onCreateConnector,
}: DataSourceManagerProps) {
  const [form, setForm] = React.useState({
    name: '',
    kind: 'external' as DataSourceConnector['kind'],
    description: '',
    capabilities: 'read',
    schemaHints: '',
    authType: 'apiKey' as DataSourceConnector['authType'],
    status: 'disconnected' as DataSourceConnector['status'],
    compatibilityStatus: 'beta' as DataSourceConnector['compatibilityStatus'],
  })

  function submitConnector() {
    const name = form.name.trim()
    if (!name) return

    onCreateConnector?.({
      id: slugifyName(name),
      name,
      kind: form.kind,
      description: form.description.trim(),
      capabilities: parseCommaSeparated(form.capabilities),
      schemaHints: parseCommaSeparated(form.schemaHints),
      authType: form.authType,
      status: form.status,
      compatibilityStatus: form.compatibilityStatus,
    })

    setForm({
      name: '',
      kind: 'external',
      description: '',
      capabilities: 'read',
      schemaHints: '',
      authType: 'apiKey',
      status: 'disconnected',
      compatibilityStatus: 'beta',
    })
  }

  return (
    <section className="enterprise-panel" data-testid="admin-data-sources">
      <h3>Data Sources</h3>
      {isAdmin && (
        <div className="enterprise-form">
          <input
            value={form.name}
            onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
            placeholder="Connector name"
          />
          <select
            value={form.kind}
            onChange={event => setForm(prev => ({ ...prev, kind: event.target.value as DataSourceConnector['kind'] }))}
          >
            <option value="file">File</option>
            <option value="database">Database</option>
            <option value="external">External</option>
          </select>
          <input
            value={form.description}
            onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
            placeholder="Description"
          />
          <input
            value={form.capabilities}
            onChange={event => setForm(prev => ({ ...prev, capabilities: event.target.value }))}
            placeholder="Capabilities (comma separated)"
          />
          <input
            value={form.schemaHints}
            onChange={event => setForm(prev => ({ ...prev, schemaHints: event.target.value }))}
            placeholder="Schema hints (comma separated)"
          />
          <div className="enterprise-form-row">
            <select
              value={form.authType}
              onChange={event => setForm(prev => ({ ...prev, authType: event.target.value as DataSourceConnector['authType'] }))}
            >
              <option value="none">No auth</option>
              <option value="apiKey">API key</option>
              <option value="oauth">OAuth</option>
              <option value="serviceAccount">Service account</option>
            </select>
            <select
              value={form.status}
              onChange={event => setForm(prev => ({ ...prev, status: event.target.value as DataSourceConnector['status'] }))}
            >
              <option value="connected">Connected</option>
              <option value="disconnected">Disconnected</option>
              <option value="error">Error</option>
            </select>
            <select
              value={form.compatibilityStatus}
              onChange={event => setForm(prev => ({ ...prev, compatibilityStatus: event.target.value as DataSourceConnector['compatibilityStatus'] }))}
            >
              <option value="ready">Ready</option>
              <option value="beta">Beta</option>
              <option value="legacy">Legacy</option>
            </select>
            <button type="button" className="enterprise-action-btn" onClick={submitConnector}>
              Register Connector
            </button>
          </div>
        </div>
      )}
      <div className="enterprise-panel-body">
        {connectors.length === 0 ? (
          <div className="enterprise-empty-state">
            <div className="enterprise-empty-icon">C</div>
            <div className="enterprise-empty-title">No Data Sources</div>
            <div className="enterprise-empty-description">
              Add data sources in Admin Studio to enable enterprise data connectivity.
              Connectors define how the agent accesses databases, files, and external APIs.
            </div>
          </div>
        ) : (
          connectors.map(connector => (
            <label key={connector.id} className="enterprise-row" data-testid={`admin-connector-row-${connector.id}`}>
              <input
                type="checkbox"
                checked={selectedConnectorIds.includes(connector.id)}
                onChange={() => onToggleConnector(connector.id)}
              />
              <div className="enterprise-main">
                <strong>{connector.name}</strong>
                <span>{connector.description}</span>
              </div>
              <div className="enterprise-sidecar">
                <span className={`status-badge status-${connector.status}`}>{connector.status}</span>
                <span className="module-version">{connector.kind}</span>
                <span className="module-version">{connector.compatibilityStatus}</span>
              </div>
            </label>
          ))
        )}
      </div>
    </section>
  )
}
