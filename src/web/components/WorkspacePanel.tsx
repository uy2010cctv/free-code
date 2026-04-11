import React, { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { useTranslation } from '../i18n'
import { DocxPreview } from './DocxPreview'
import { ExcelPreview } from './ExcelPreview'

interface WorkspacePanelProps {
  isOpen: boolean
  onClose: () => void
  currentFile: string | null
  fileContent: string
  onContentChange: (content: string) => void
  onSave: () => void
  hasUnsavedChanges: boolean
  fileTree: Array<{ name: string; path: string; isDirectory: boolean }>
  onFileSelect: (path: string) => void
}

type TabType = 'editor' | 'files' | 'preview'

export function WorkspacePanel({
  isOpen,
  onClose,
  currentFile,
  fileContent,
  onContentChange,
  onSave,
  hasUnsavedChanges,
  fileTree,
  onFileSelect,
}: WorkspacePanelProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabType>('editor')
  const [previewKey, setPreviewKey] = useState(0) // Force re-render of preview

  // Reset preview when file changes
  useEffect(() => {
    setPreviewKey(prev => prev + 1)
  }, [currentFile])

  if (!isOpen) return null

  // Determine file type from extension
  const getFileType = (filename: string | null): 'word' | 'excel' | 'other' => {
    if (!filename) return 'other'
    const ext = filename.toLowerCase().split('.').pop()
    if (ext === 'docx' || ext === 'doc') return 'word'
    if (ext === 'xlsx' || ext === 'xls') return 'excel'
    return 'other'
  }

  const fileType = getFileType(currentFile)

  return (
    <div className="workspace-panel">
      <div className="workspace-header">
        <div className="workspace-tabs">
          <button
            className={`workspace-tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            {t('editor')}
          </button>
          <button
            className={`workspace-tab ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            {t('files')}
          </button>
          <button
            className={`workspace-tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            {t('preview')}
          </button>
        </div>
        <button className="workspace-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="workspace-content">
        {activeTab === 'editor' && (
          <div className="editor-panel">
            {currentFile ? (
              <>
                <div className="editor-header">
                  <span className="editor-filename">
                    {currentFile}
                    {hasUnsavedChanges && <span className="unsaved-indicator">•</span>}
                  </span>
                  <button className="editor-save-btn" onClick={onSave}>
                    {t('save')}
                  </button>
                </div>
                <div className="editor-container">
                  <Editor
                    height="100%"
                    defaultLanguage="typescript"
                    value={fileContent}
                    onChange={(value) => onContentChange(value || '')}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="editor-empty">
                <p>{t('selectFileToEdit')}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="files-panel">
            <div className="file-tree">
              {fileTree.map((node) => (
                <div
                  key={node.path}
                  className={`file-tree-item ${node.isDirectory ? 'directory' : 'file'}`}
                  onClick={() => !node.isDirectory && onFileSelect(node.path)}
                >
                  <span className="file-icon">{node.isDirectory ? '📁' : '📄'}</span>
                  <span className="file-name">{node.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="preview-panel">
            {!currentFile ? (
              <div className="preview-empty">
                <p>{t('nothingToPreview')}</p>
              </div>
            ) : fileType === 'word' ? (
              <DocxPreview
                key={`docx-${previewKey}`}
                filePath={currentFile}
              />
            ) : fileType === 'excel' ? (
              <ExcelPreview
                key={`xlsx-${previewKey}`}
                filePath={currentFile}
              />
            ) : fileContent ? (
              <div className="preview-content" dangerouslySetInnerHTML={{ __html: fileContent }} />
            ) : (
              <div className="preview-empty">
                <p>{t('nothingToPreview')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
