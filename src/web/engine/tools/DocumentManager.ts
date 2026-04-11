import { readdir, readFile, writeFile, stat } from 'fs/promises'
import { resolve, extname } from 'path'
import { Document, Packer } from 'docx'
import * as XLSX from 'xlsx'

export interface DocumentInfo {
  name: string
  path: string
  type: 'word' | 'excel'
  size: number
  modifiedAt: Date
}

export class DocumentManager {
  constructor(private workspacePath: string) {}

  async createDocument(type: 'word' | 'excel', filename: string): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const fullPath = resolve(this.workspacePath, filename)

      if (type === 'word') {
        const doc = new Document({
          sections: [{
            children: [],
          }],
        })
        const buffer = await Packer.toBuffer(doc)
        await writeFile(fullPath, buffer)
        return { success: true, path: fullPath }
      } else if (type === 'excel') {
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet([[]])
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
        await writeFile(fullPath, buffer)
        return { success: true, path: fullPath }
      }

      return { success: false, error: `Unknown document type: ${type}` }
    } catch (error: any) {
      return { success: false, error: error.message || String(error) }
    }
  }

  async listDocuments(): Promise<DocumentInfo[]> {
    try {
      const entries = await readdir(this.workspacePath, { withFileTypes: true })
      const documents: DocumentInfo[] = []

      for (const entry of entries) {
        if (entry.isFile()) {
          const fullPath = resolve(this.workspacePath, entry.name)
          const ext = extname(entry.name).toLowerCase()
          const stats = await stat(fullPath)

          let type: 'word' | 'excel' | null = null
          if (ext === '.docx' || ext === '.doc') {
            type = 'word'
          } else if (ext === '.xlsx' || ext === '.xls') {
            type = 'excel'
          }

          if (type) {
            documents.push({
              name: entry.name,
              path: fullPath,
              type,
              size: stats.size,
              modifiedAt: stats.mtime,
            })
          }
        }
      }

      return documents
    } catch (error) {
      return []
    }
  }

  async readDocument(filename: string): Promise<{ success: boolean; content?: any; type?: string; error?: string }> {
    try {
      const fullPath = resolve(this.workspacePath, filename)
      const ext = extname(filename).toLowerCase()

      if (ext === '.docx' || ext === '.doc') {
        const buffer = await readFile(fullPath)
        // Return buffer for Word - caller can parse with docx library
        return { success: true, content: buffer.toString('base64'), type: 'word' }
      } else if (ext === '.xlsx' || ext === '.xls') {
        const buffer = await readFile(fullPath)
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        return { success: true, content: workbook, type: 'excel' }
      }

      return { success: false, error: `Unsupported document type: ${ext}` }
    } catch (error: any) {
      return { success: false, error: error.message || String(error) }
    }
  }

  async writeDocument(filename: string, content: Buffer): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const fullPath = resolve(this.workspacePath, filename)
      await writeFile(fullPath, content)
      return { success: true, path: fullPath }
    } catch (error: any) {
      return { success: false, error: error.message || String(error) }
    }
  }

  getWorkspacePath(): string {
    return this.workspacePath
  }
}
