import * as XLSX from 'xlsx'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { BaseTool } from '../Tool'
import type { ToolContext, ToolResult } from '../types'

interface CellStyle {
  font?: {
    bold?: boolean
    italic?: boolean
    color?: string
    size?: number
  }
  fill?: {
    color?: string
  }
  border?: {
    style?: string
    color?: string
  }
  alignment?: {
    horizontal?: 'left' | 'center' | 'right'
    vertical?: 'top' | 'middle' | 'bottom'
  }
}

interface CellData {
  value?: any
  formula?: string
  style?: CellStyle
}

interface CellRef {
  cell: string
  data: CellData
}

interface MergeRange {
  start: string
  end: string
}

export class WebExcelTool extends BaseTool {
  name = 'excel'
  description = 'Create or edit Excel spreadsheets (.xlsx). Supports formulas, styling, cell operations, and all Excel features.'
  inputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'read', 'write', 'addSheet', 'formula', 'style', 'resize', 'merge'],
        description: 'Action to perform',
      },
      path: {
        type: 'string',
        description: 'Path to the Excel workbook',
      },
      sheetName: {
        type: 'string',
        description: 'Name of the sheet (for create, addSheet actions)',
        default: 'Sheet1',
      },
      data: {
        type: 'array',
        description: '2D array of cell data (for write action)',
        items: {
          type: 'array',
          items: { type: 'any' },
        },
      },
      cell: {
        type: 'string',
        description: 'Cell reference like "A1" or range like "A1:B5" (for read/write)',
      },
      sheets: {
        type: 'array',
        description: 'Array of sheet names (for create with multiple sheets)',
        items: { type: 'string' },
      },
      // Formula support
      formula: {
        type: 'string',
        description: 'Formula to apply (e.g., "SUM(A1:A10)" for read action, or set formula for write)',
      },
      // Style support
      style: {
        type: 'object',
        description: 'Cell style properties',
        properties: {
          font: {
            type: 'object',
            properties: {
              bold: { type: 'boolean' },
              italic: { type: 'boolean' },
              color: { type: 'string' },
              size: { type: 'number' },
            },
          },
          fill: {
            type: 'object',
            properties: {
              color: { type: 'string' },
            },
          },
          border: {
            type: 'object',
            properties: {
              style: { type: 'string' },
              color: { type: 'string' },
            },
          },
          alignment: {
            type: 'object',
            properties: {
              horizontal: { type: 'string' },
              vertical: { type: 'string' },
            },
          },
        },
      },
      // Resize support
      dimension: {
        type: 'object',
        description: 'Column/row dimension',
        properties: {
          type: {
            type: 'string',
            enum: ['col', 'row'],
            description: 'Column or row',
          },
          index: {
            type: 'number',
            description: 'Column index (0-based) or row index (0-based)',
          },
          size: {
            type: 'number',
            description: 'Width in Excel units (columns) or points (rows)',
          },
        },
      },
      // Merge support
      merge: {
        type: 'object',
        description: 'Cell merge range',
        properties: {
          start: { type: 'string' },
          end: { type: 'string' },
        },
      },
    },
    required: ['action', 'path'],
  }

  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { action, path, sheetName = 'Sheet1', data, cell, sheets, formula, style, dimension, merge } = args

    const fullPath = resolve(context.cwd, path)

    try {
      switch (action) {
        case 'create':
          return await this.createWorkbook(fullPath, sheetName, sheets)
        case 'read':
          return await this.readWorkbook(fullPath, sheetName, cell, formula)
        case 'write':
          return await this.writeWorkbook(fullPath, sheetName, data, cell)
        case 'addSheet':
          return await this.addSheet(fullPath, sheetName)
        case 'formula':
          return await this.setFormula(fullPath, sheetName, cell!, formula!)
        case 'style':
          return await this.setStyle(fullPath, sheetName, cell!, style)
        case 'resize':
          return await this.resize(fullPath, sheetName, dimension!)
        case 'merge':
          return await this.mergeCells(fullPath, sheetName, merge!)
        default:
          return this.failure(`Unknown action: ${action}`)
      }
    } catch (error: any) {
      return this.failure(error.message || String(error))
    }
  }

  private async createWorkbook(fullPath: string, defaultSheet: string, sheetNames?: string[]): Promise<ToolResult> {
    const wb = XLSX.utils.book_new()

    const names = sheetNames && sheetNames.length > 0 ? sheetNames : [defaultSheet]

    for (const name of names) {
      const ws = XLSX.utils.aoa_to_sheet([[]])
      XLSX.utils.book_append_sheet(wb, ws, name)
    }

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    await writeFile(fullPath, buffer)
    return this.success(`Excel workbook created: ${fullPath} with sheets: ${names.join(', ')}`)
  }

  private async readWorkbook(fullPath: string, sheetName: string, cell?: string, formula?: string): Promise<ToolResult> {
    try {
      const buffer = await readFile(fullPath)
      const workbook = XLSX.read(buffer, { type: 'buffer' })

      const sheetNames = workbook.SheetNames

      if (sheetNames.length === 0) {
        return this.success('Workbook is empty')
      }

      const targetSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0]
      const worksheet = workbook.Sheets[targetSheet]

      if (!worksheet) {
        return this.failure(`Sheet "${targetSheet}" not found`)
      }

      // If formula is requested, return the formula instead of value
      if (cell && formula) {
        const cellData = worksheet[cell]
        if (cellData && cellData.f) {
          return this.success(`Formula in ${cell}: ${cellData.f}`)
        } else {
          return this.success(`Cell ${cell} has no formula`)
        }
      }

      if (cell) {
        const cellValue = worksheet[cell]
        if (cellValue) {
          const result: any = { value: cellValue.v }
          if (cellValue.f) result.formula = cellValue.f
          return this.success(`Cell ${cell}: ${JSON.stringify(result)}`)
        } else {
          return this.success(`Cell ${cell} is empty`)
        }
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

      return this.success(JSON.stringify({
        sheetName: targetSheet,
        sheets: sheetNames,
        data: jsonData,
      }, null, 2))
    } catch (error: any) {
      return this.failure(`Failed to read workbook: ${error.message}`)
    }
  }

  private async writeWorkbook(fullPath: string, sheetName: string, data?: any[][], cell?: string): Promise<ToolResult> {
    try {
      let workbook: XLSX.WorkBook

      try {
        const buffer = await readFile(fullPath)
        workbook = XLSX.read(buffer, { type: 'buffer' })
      } catch {
        workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), sheetName)
      }

      let worksheet: XLSX.WorkSheet
      if (workbook.SheetNames.includes(sheetName)) {
        worksheet = workbook.Sheets[sheetName]
      } else {
        worksheet = XLSX.utils.aoa_to_sheet([[]])
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      }

      if (data && Array.isArray(data)) {
        if (cell) {
          XLSX.utils.sheet_add_aoa(worksheet, data, { origin: cell })
        } else {
          XLSX.utils.sheet_add_aoa(worksheet, data, { origin: 'A1' })
        }
      }

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
      await writeFile(fullPath, buffer)

      return this.success(`Workbook updated: ${fullPath}`)
    } catch (error: any) {
      return this.failure(`Failed to write workbook: ${error.message}`)
    }
  }

  private async addSheet(fullPath: string, sheetName: string): Promise<ToolResult> {
    try {
      let workbook: XLSX.WorkBook

      try {
        const buffer = await readFile(fullPath)
        workbook = XLSX.read(buffer, { type: 'buffer' })
      } catch {
        return this.failure('Workbook does not exist. Use create action first.')
      }

      if (workbook.SheetNames.includes(sheetName)) {
        return this.failure(`Sheet "${sheetName}" already exists`)
      }

      const worksheet = XLSX.utils.aoa_to_sheet([[]])
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
      await writeFile(fullPath, buffer)

      return this.success(`Sheet "${sheetName}" added to: ${fullPath}`)
    } catch (error: any) {
      return this.failure(`Failed to add sheet: ${error.message}`)
    }
  }

  private async setFormula(fullPath: string, sheetName: string, cell: string, formula: string): Promise<ToolResult> {
    try {
      const buffer = await readFile(fullPath)
      const workbook = XLSX.read(buffer, { type: 'buffer' })

      if (!workbook.SheetNames.includes(sheetName)) {
        return this.failure(`Sheet "${sheetName}" not found`)
      }

      const worksheet = workbook.Sheets[sheetName]

      // Parse formula to remove leading = if present
      const cleanFormula = formula.startsWith('=') ? formula.substring(1) : formula

      // Get or create cell
      if (!worksheet[cell]) {
        worksheet[cell] = { t: 'n', v: 0 }
      }

      worksheet[cell].f = cleanFormula

      // Recalculate on read by clearing cached value
      delete worksheet[cell].w

      const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
      await writeFile(fullPath, outBuffer)

      return this.success(`Formula ${formula} set at ${cell} in ${fullPath}`)
    } catch (error: any) {
      return this.failure(`Failed to set formula: ${error.message}`)
    }
  }

  private async setStyle(fullPath: string, sheetName: string, cell: string, style?: CellStyle): Promise<ToolResult> {
    try {
      if (!style) {
        return this.failure('Style object required')
      }

      const buffer = await readFile(fullPath)
      const workbook = XLSX.read(buffer, { type: 'buffer' })

      if (!workbook.SheetNames.includes(sheetName)) {
        return this.failure(`Sheet "${sheetName}" not found`)
      }

      const worksheet = workbook.Sheets[sheetName]

      // Get or create cell
      if (!worksheet[cell]) {
        worksheet[cell] = { t: 's', v: 0 }
      }

      // Build style object for xlsx
      const cellStyle: Record<string, any> = {}

      if (style.font) {
        cellStyle.font = {}
        if (style.font.bold) (cellStyle.font as any).bold = true
        if (style.font.italic) (cellStyle.font as any).italic = true
        if (style.font.color) (cellStyle.font as any).color = { rgb: style.font.color }
        if (style.font.size) (cellStyle.font as any).sz = style.font.size
      }

      if (style.fill && style.fill.color) {
        cellStyle.fill = {
          fgColor: { rgb: style.fill.color },
          patternType: 'solid',
        }
      }

      if (style.border) {
        const borderStyle = style.border.style || 'thin'
        const borderColor = style.border.color || '000000'
        cellStyle.border = {
          top: { style: borderStyle, color: { rgb: borderColor } },
          bottom: { style: borderStyle, color: { rgb: borderColor } },
          left: { style: borderStyle, color: { rgb: borderColor } },
          right: { style: borderStyle, color: { rgb: borderColor } },
        }
      }

      if (style.alignment) {
        cellStyle.alignment = {}
        if (style.alignment.horizontal) {
          (cellStyle.alignment as any).horizontal = style.alignment.horizontal
        }
        if (style.alignment.vertical) {
          (cellStyle.alignment as any).vertical = style.alignment.vertical
        }
      }

      // Apply style via cell's s property (style index)
      // Note: xlsx library manages styles internally, we just set the property
      worksheet[cell].s = cellStyle

      const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
      await writeFile(fullPath, outBuffer)

      return this.success(`Style applied to ${cell} in ${fullPath}`)
    } catch (error: any) {
      return this.failure(`Failed to apply style: ${error.message}`)
    }
  }

  private async resize(fullPath: string, sheetName: string, dimension: { type: string; index: number; size: number }): Promise<ToolResult> {
    try {
      const buffer = await readFile(fullPath)
      const workbook = XLSX.read(buffer, { type: 'buffer' })

      if (!workbook.SheetNames.includes(sheetName)) {
        return this.failure(`Sheet "${sheetName}" not found`)
      }

      const worksheet = workbook.Sheets[sheetName]

      if (dimension.type === 'col') {
        // Column resize
        worksheet['!cols'] = worksheet['!cols'] || []
        worksheet['!cols'][dimension.index] = { wch: dimension.size }
      } else if (dimension.type === 'row') {
        // Row resize
        worksheet['!rows'] = worksheet['!rows'] || []
        worksheet['!rows'][dimension.index] = { hpt: dimension.size }
      }

      const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
      await writeFile(fullPath, outBuffer)

      return this.success(`Dimension set for ${dimension.type} ${dimension.index}: ${dimension.size}`)
    } catch (error: any) {
      return this.failure(`Failed to resize: ${error.message}`)
    }
  }

  private async mergeCells(fullPath: string, sheetName: string, merge: MergeRange): Promise<ToolResult> {
    try {
      if (!merge.start || !merge.end) {
        return this.failure('Merge requires start and end cell references')
      }

      const buffer = await readFile(fullPath)
      const workbook = XLSX.read(buffer, { type: 'buffer' })

      if (!workbook.SheetNames.includes(sheetName)) {
        return this.failure(`Sheet "${sheetName}" not found`)
      }

      const worksheet = workbook.Sheets[sheetName]

      // Add merge range
      ;(worksheet['!merges'] as XLSX.Range[] || []).push({
        s: XLSX.utils.decode_cell(merge.start),
        e: XLSX.utils.decode_cell(merge.end),
      })

      const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
      await writeFile(fullPath, outBuffer)

      return this.success(`Merged cells ${merge.start}:${merge.end} in ${fullPath}`)
    } catch (error: any) {
      return this.failure(`Failed to merge cells: ${error.message}`)
    }
  }
}
