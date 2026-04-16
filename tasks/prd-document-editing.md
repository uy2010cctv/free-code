# PRD: free-code Web 文档编辑能力

## Introduction

为 free-code Web 的 AI Agent 添加 Word (.docx) 和 Excel (.xlsx) 文档的创建、编辑和实时预览能力。每个会话对应一个工作区文件夹，Agent 可以在工作区内创建和修改文档，用户能够实时查看编辑成果。

## Goals

- 支持创建、读取、编辑 Word (.docx) 和 Excel (.xlsx) 文档
- 在工作区内联预览文档，无需下载或跳转
- 支持完整的格式、样式和公式编辑
- Agent 能够理解文档结构并进行精准编辑
- 用户实时观察 Agent 的编辑过程和结果

## User Stories

### US-001: 工作区文档管理基础
**Description:** As an Agent, I need to create and list documents in the workspace folder so that I can organize user files.

**Acceptance Criteria:**
- [ ] 每个会话对应独立的工作区文件夹（`workspace/[session-id]/`）
- [ ] 支持创建空白 Word 文档（`.docx`）和 Excel 文档（`.xlsx`）
- [ ] 列出工作区内的所有文档
- [ ] 文档命名遵循用户指定或自动生成

---

### US-002: Word 文档创建和基础编辑
**Description:** As an Agent, I want to create and edit Word documents so that I can help users with document tasks.

**Acceptance Criteria:**
- [ ] 创建包含标题、段落、列表的 Word 文档
- [ ] 编辑文本内容（添加、修改、删除）
- [ ] 设置字体样式（粗体、斜体、下划线、颜色、大小）
- [ ] 设置段落格式（对齐、行高、缩进）
- [ ] 添加表格和图片
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-003: Excel 文档创建和基础编辑
**Description:** As an Agent, I want to create and edit Excel spreadsheets so that I can help users with spreadsheet tasks.

**Acceptance Criteria:**
- [ ] 创建包含多个工作表的 Excel 文档
- [ ] 编辑单元格内容（文本、数字、日期）
- [ ] 设置单元格样式（字体、背景、边框）
- [ ] 调整列宽和行高
- [ ] 合并和拆分单元格
- [ ] 添加和编辑公式
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-004: 工作区内联文档预览
**Description:** As a user, I want to see document previews inline in the workspace panel so that I can verify edits in real-time.

**Acceptance Criteria:**
- [ ] Word 文档在浏览器内渲染（使用 docx-preview 或类似库）
- [ ] Excel 文档在浏览器内渲染（使用 xlsx-js-spreadsheet 或类似库）
- [ ] 预览面板支持滚动和缩放
- [ ] 点击文档切换预览目标
- [ ] 实时更新预览（编辑后刷新）

---

### US-005: Agent 文档编辑命令解析
**Description:** As an Agent, I need to understand document editing commands so that I can fulfill user requests accurately.

**Acceptance Criteria:**
- [ ] Agent 能解析 "在文档中添加一段话" 等自然语言指令
- [ ] Agent 能解析 "将 A1 单元格的数值乘以 2" 等表格操作指令
- [ ] Agent 能处理 "将标题改为红色" 等格式指令
- [ ] Agent 能处理跨文档操作（如 "把表格移到另一个文档"）

---

### US-006: 前端预览组件集成
**Description:** As a frontend developer, I need to integrate preview components into the workspace panel.

**Acceptance Criteria:**
- [ ] Word 预览组件嵌入 WorkspacePanel
- [ ] Excel 预览组件嵌入 WorkspacePanel
- [ ] 预览组件支持全屏模式
- [ ] 预览组件响应式布局
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-007: 文档保存和版本管理
**Description:** As a system, I need to persist document changes and track versions.

**Acceptance Criteria:**
- [ ] 编辑自动保存到工作区文件夹
- [ ] 支持手动保存触发
- [ ] 文件名冲突处理（覆盖或重命名）
- [ ] 支持导出文档到本地

---

## Functional Requirements

- **FR-1:** 工作区文件系统抽象
  - 每个会话创建独立工作区目录
  - 提供 `createDocument(type, filename)` 接口
  - 提供 `listDocuments()` 接口
  - 提供 `readDocument(filename)` 接口
  - 提供 `writeDocument(filename, content)` 接口

- **FR-2:** Word 文档处理
  - 使用前端库（docx 或类似）解析和渲染 `.docx`
  - 支持：段落、标题、列表、表格、图片、超链接
  - 支持：字体样式、段落样式
  - 支持：前端编辑和后端 LibreOffice 转换

- **FR-3:** Excel 文档处理
  - 使用前端库（xlsx-js 或类似）解析和渲染 `.xlsx`
  - 支持：多工作表、单元格、行列操作
  - 支持：公式计算
  - 支持：样式（字体、填充、边框）
  - 支持：前端编辑和后端处理复杂场景

- **FR-4:** 预览渲染
  - docx-preview 渲染 Word 文档
  - xlsx-js-spreadsheet 渲染 Excel 表格
  - 预览组件支持刷新操作
  - 预览组件支持缩放和全屏

- **FR-5:** Agent 工具接口
  - `WebWordTool`: Word 文档创建、读取、编辑工具
  - `WebExcelTool`: Excel 文档创建、读取、编辑工具
  - 工具暴露给 Agent 调度系统

- **FR-6:** 实时同步
  - 文件系统变更触发预览刷新
  - 预览组件监听文件变化（watch 或轮询）

## Non-Goals

- 不支持 PDF 直接编辑（可导出为 PDF）
- 不支持 Excel 宏（VBA）
- 不支持协作编辑（同一文档多人同时编辑）
- 不支持文档版本历史回滚
- 不支持 PowerPoint 等其他 Office 格式

## Technical Considerations

### 前端依赖
- `docx`: Word 文档生成和解析
- `docx-preview`: Word 文档浏览器预览
- `xlsx`: Excel 文档生成、解析和预览
- 预览库需要 SSR 兼容处理

### 后端处理
- 文件存储在工作区目录
- 可选：LibreOffice 用于复杂格式转换
- 文件变更通过文件系统事件通知

### 预览性能
- 大文档（>10MB）需要懒加载
- 预览组件需要虚拟化渲染
- 可考虑 Web Worker 处理解析

## Success Metrics

- Agent 能够在 3 步以内完成简单的文档编辑请求
- 预览刷新延迟 < 500ms
- 文档创建到预览可见 < 1s
- 支持 5MB 以内的文档流畅预览

## Open Questions

- [ ] 复杂公式（如跨 sheet 引用）是否需要后端计算引擎？
- [ ] 是否需要支持文档模板功能？
- [ ] 移动端预览体验是否需要特殊处理？
- [ ] 是否需要支持文档协作评论功能？
