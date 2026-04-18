import React from 'react'
import type { BusinessModule, DataSourceConnector, ReportPlan } from '../types'
import { DataSourceManager } from './DataSourceManager'
import { ModuleManager } from './ModuleManager'
import { ReportInspector } from './ReportInspector'

type AdminStudioPanel = 'overview' | 'sources' | 'modules' | 'reports'

interface AdminStudioProps {
  connectors: DataSourceConnector[]
  modules: BusinessModule[]
  selectedConnectorIds: string[]
  selectedModuleIds: string[]
  latestReportPlan: ReportPlan | null
  onToggleConnector: (id: string) => void
  onToggleModule: (id: string) => void
  onPublishModule?: (id: string) => void
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
  hasAdminAccount: boolean
  isAdminAuthenticated: boolean
  adminUsername: string | null
  onSetupAdmin?: (credentials: { username: string; password: string; bootstrapSecret: string }) => void
  onLoginAdmin?: (credentials: { username: string; password: string }) => void
  onLogoutAdmin?: () => void
  embedded?: boolean
  initialPanel?: AdminStudioPanel
  onPanelChange?: (panel: AdminStudioPanel) => void
}

export function AdminStudio({
  connectors,
  modules,
  selectedConnectorIds,
  selectedModuleIds,
  latestReportPlan,
  onToggleConnector,
  onToggleModule,
  onPublishModule,
  onCreateConnector,
  onCreateModule,
  onRefreshModule,
  hasAdminAccount,
  isAdminAuthenticated,
  adminUsername,
  onSetupAdmin,
  onLoginAdmin,
  onLogoutAdmin,
  embedded = false,
  initialPanel = 'overview',
  onPanelChange,
}: AdminStudioProps) {
  const [activePanel, setActivePanel] = React.useState<AdminStudioPanel>(initialPanel)
  const [adminUsernameInput, setAdminUsernameInput] = React.useState('admin')
  const [adminPasswordInput, setAdminPasswordInput] = React.useState('')
  const [bootstrapSecretInput, setBootstrapSecretInput] = React.useState('')

  React.useEffect(() => {
    setActivePanel(initialPanel)
  }, [initialPanel])

  const publishedModules = modules.filter((module) => module.lifecycleState === 'published')
  const readyConnectors = connectors.filter((connector) => connector.status === 'connected')

  function selectPanel(panel: AdminStudioPanel) {
    setActivePanel(panel)
    onPanelChange?.(panel)
  }

  function renderOverview() {
    return (
      <div className="admin-studio-overview" data-testid="admin-studio-overview">
        <div className="admin-studio-card-grid">
          <article className="admin-studio-card" data-testid="admin-studio-card-connectors">
            <span className="admin-studio-card-label">Connected Sources</span>
            <strong>{readyConnectors.length}</strong>
            <p>{connectors.length} total connectors registered for this workspace.</p>
          </article>
          <article className="admin-studio-card" data-testid="admin-studio-card-modules">
            <span className="admin-studio-card-label">Published Modules</span>
            <strong>{publishedModules.length}</strong>
            <p>{modules.length} total modules available, draft to published lifecycle.</p>
          </article>
          <article className="admin-studio-card" data-testid="admin-studio-card-session">
            <span className="admin-studio-card-label">Active Session Binding</span>
            <strong>{selectedConnectorIds.length + selectedModuleIds.length}</strong>
            <p>{selectedConnectorIds.length} sources and {selectedModuleIds.length} modules selected.</p>
          </article>
        </div>

        <div className="admin-studio-overview-grid">
          <section className="admin-studio-summary">
            <div className="admin-studio-summary-header">
              <h3>Ready Connectors</h3>
              <button type="button" className="enterprise-action-btn" onClick={() => selectPanel('sources')}>
                Open Data Sources
              </button>
            </div>
            <div className="enterprise-panel-body">
              {readyConnectors.map((connector) => (
                <div key={connector.id} className="enterprise-row admin-studio-summary-row">
                  <div className="enterprise-main">
                    <strong>{connector.name}</strong>
                    <span>{connector.description}</span>
                  </div>
                  <div className="enterprise-sidecar">
                    <span className={`status-badge status-${connector.status}`}>{connector.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-studio-summary" data-testid="admin-studio-published-modules">
            <div className="admin-studio-summary-header">
              <h3>Published Modules</h3>
              <button type="button" className="enterprise-action-btn" onClick={() => selectPanel('modules')}>
                Open Modules
              </button>
            </div>
            <div className="enterprise-panel-body">
              {publishedModules.map((module) => (
                <div key={module.id} className="enterprise-row admin-studio-summary-row">
                  <div className="enterprise-main">
                    <strong>{module.name}</strong>
                    <span>{module.description}</span>
                  </div>
                  <div className="enterprise-sidecar">
                    <span className="module-version">v{module.version}</span>
                    <span className="status-badge status-connected">{module.lifecycleState}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    )
  }

  function renderAdminAuth() {
    if (isAdminAuthenticated) {
      return (
        <div className="enterprise-admin-banner" data-testid="admin-studio-authenticated">
          <div>
            <strong>Admin authenticated</strong>
            <span>{adminUsername || 'admin'} can publish connectors and modules.</span>
          </div>
          <button type="button" className="enterprise-action-btn" onClick={() => onLogoutAdmin?.()}>
            Logout
          </button>
        </div>
      )
    }

    return (
      <div className="enterprise-admin-auth" data-testid="admin-studio-auth">
        <div className="enterprise-admin-banner">
          {hasAdminAccount
            ? 'Admin Studio requires login before enterprise modules can be published.'
            : 'Create the first admin account to unlock self-serve connector and module publishing.'}
        </div>
        <div className="enterprise-form">
          <input
            data-testid="admin-studio-username"
            value={adminUsernameInput}
            onChange={(event) => setAdminUsernameInput(event.target.value)}
            placeholder="Admin username"
          />
          <input
            data-testid="admin-studio-password"
            type="password"
            value={adminPasswordInput}
            onChange={(event) => setAdminPasswordInput(event.target.value)}
            placeholder="Password"
          />
          {!hasAdminAccount && (
            <input
              data-testid="admin-studio-bootstrap-secret"
              type="password"
              value={bootstrapSecretInput}
              onChange={(event) => setBootstrapSecretInput(event.target.value)}
              placeholder="Bootstrap secret"
            />
          )}
          <div className="enterprise-form-row">
            {!hasAdminAccount ? (
              <button
                type="button"
                className="enterprise-action-btn"
                data-testid="admin-studio-setup"
                onClick={() => onSetupAdmin?.({
                  username: adminUsernameInput,
                  password: adminPasswordInput,
                  bootstrapSecret: bootstrapSecretInput,
                })}
              >
                Create Admin Account
              </button>
            ) : (
              <button
                type="button"
                className="enterprise-action-btn"
                data-testid="admin-studio-login"
                onClick={() => onLoginAdmin?.({ username: adminUsernameInput, password: adminPasswordInput })}
              >
                Login to Admin Studio
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  function renderPanel() {
    switch (activePanel) {
      case 'sources':
        return (
          <DataSourceManager
            connectors={connectors}
            selectedConnectorIds={selectedConnectorIds}
            onToggleConnector={onToggleConnector}
            isAdmin={isAdminAuthenticated}
            onCreateConnector={onCreateConnector}
          />
        )
      case 'modules':
        return (
          <ModuleManager
            modules={modules}
            selectedModuleIds={selectedModuleIds}
            onToggleModule={onToggleModule}
            onPublishModule={onPublishModule}
            allowPublish={isAdminAuthenticated}
            isAdmin={isAdminAuthenticated}
            onCreateModule={onCreateModule}
            onRefreshModule={onRefreshModule}
          />
        )
      case 'reports':
        return <ReportInspector plan={latestReportPlan} />
      case 'overview':
      default:
        return renderOverview()
    }
  }

  return (
    <section
      className={`admin-studio ${embedded ? 'admin-studio-embedded' : ''}`}
      data-testid="admin-studio"
    >
      {!embedded && (
        <header className="admin-studio-header">
          <div>
            <span className="admin-studio-eyebrow">Enterprise Build Studio</span>
            <h2>Admin Studio</h2>
            <p>Self-serve connectors, modules, publishing, and enterprise report control.</p>
          </div>
          <div className="admin-studio-header-stats">
            <span className="status-badge">{connectors.length} connectors</span>
            <span className="status-badge">{modules.length} modules</span>
            <span className="status-badge">{publishedModules.length} published</span>
          </div>
        </header>
      )}

      <nav className="admin-studio-tabs" data-testid="admin-studio-tabs">
        {([
          ['overview', 'Overview'],
          ['sources', 'Data Sources'],
          ['modules', 'Modules'],
          ['reports', 'Reports'],
        ] as Array<[AdminStudioPanel, string]>).map(([panel, label]) => (
          <button
            key={panel}
            type="button"
            className={`admin-studio-tab ${activePanel === panel ? 'active' : ''}`}
            data-testid={`admin-studio-tab-${panel}`}
            onClick={() => selectPanel(panel)}
          >
            {label}
          </button>
        ))}
      </nav>

      {renderAdminAuth()}

      <div
        className="admin-studio-content"
        data-testid={`admin-studio-panel-${activePanel}`}
      >
        {renderPanel()}
      </div>
    </section>
  )
}
