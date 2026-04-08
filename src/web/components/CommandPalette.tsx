import React, { useState, useEffect, useRef } from 'react'
import { COMMANDS, getCommandsByCategory, searchCommands } from '../data/commands'
import type { Command } from '../types/settings'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onExecuteCommand: (command: string) => void
}

export function CommandPalette({ isOpen, onClose, onExecuteCommand }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filteredCommands, setFilteredCommands] = useState<Command[]>(COMMANDS)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setFilteredCommands(COMMANDS)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (query.startsWith('/')) {
      setFilteredCommands(searchCommands(query.slice(1)))
    } else if (query) {
      setFilteredCommands(searchCommands(query))
    } else {
      setFilteredCommands(COMMANDS)
    }
    setSelectedIndex(0)
  }, [query])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredCommands[selectedIndex]) {
        executeCommand(filteredCommands[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  function executeCommand(cmd: Command) {
    onExecuteCommand(`/${cmd.name}`)
    onClose()
  }

  const categories = getCommandsByCategory()
  const categoryOrder = ['session', 'config', 'tools', 'agent', 'other']

  if (!isOpen) return null

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div className="command-palette-header">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="command-palette-input"
          />
        </div>

        <div className="command-palette-list">
          {query ? (
            // Search results
            <div className="command-list">
              {filteredCommands.map((cmd, index) => (
                <div
                  key={cmd.name}
                  className={`command-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="command-info">
                    <span className="command-name">/{cmd.name}</span>
                    {cmd.aliases?.map(alias => (
                      <span key={alias} className="command-alias">{alias}</span>
                    ))}
                  </div>
                  <span className="command-description">{cmd.description}</span>
                </div>
              ))}
              {filteredCommands.length === 0 && (
                <div className="command-empty">No commands found</div>
              )}
            </div>
          ) : (
            // Categorized list
            categoryOrder.map(category => (
              <div key={category} className="command-category">
                <div className="command-category-title">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </div>
                {categories[category]?.map((cmd, index) => {
                  const globalIndex = filteredCommands.indexOf(cmd)
                  return (
                    <div
                      key={cmd.name}
                      className={`command-item ${globalIndex === selectedIndex ? 'selected' : ''}`}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <div className="command-info">
                        <span className="command-name">/{cmd.name}</span>
                        {cmd.aliases?.map(alias => (
                          <span key={alias} className="command-alias">{alias}</span>
                        ))}
                      </div>
                      <span className="command-description">{cmd.description}</span>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="command-palette-footer">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Execute</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
