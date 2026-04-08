import React, { useEffect, useRef } from 'react'

interface CodeBlockProps {
  code: string
  language?: string
  showLineNumbers?: boolean
}

export function CodeBlock({ code, language = 'plaintext', showLineNumbers = true }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (codeRef.current && window.hljs) {
      window.hljs.highlightElement(codeRef.current)
    }
  }, [code, language])

  const lines = code.split('\n')

  return (
    <div className="code-block">
      {language && language !== 'plaintext' && (
        <div className="code-language-badge">{language}</div>
      )}
      <pre className="code-pre">
        {showLineNumbers && (
          <div className="code-line-numbers">
            {lines.map((_, i) => (
              <span key={i} className="code-line-number">{i + 1}</span>
            ))}
          </div>
        )}
        <code ref={codeRef} className={`code-content language-${language}`}>
          {code}
        </code>
      </pre>
      <button
        className="code-copy-btn"
        onClick={() => navigator.clipboard.writeText(code)}
        title="Copy code"
      >
        Copy
      </button>
    </div>
  )
}

// Declare hljs for TypeScript
declare global {
  interface Window {
    hljs: any
  }
}
