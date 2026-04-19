# free-code

`free-code` 现在包含两套运行形态：

- `CLI`：终端里的 Claude Code 风格 agent
- `Web`：面向企业场景的实时 Web Agent 工作台

当前项目重点已经不只是 CLI，而是一个可在浏览器中运行的企业 Agent 平台：

- 用户可以通过聊天生成和编辑企业场景下的 `docx`、`xlsx` 和报表
- 管理员可以管理数据源、模块和发布流程
- 系统会把企业上下文接入到 Agent 运行时中

## 系统概览

### 1. Web 端

Web 端位于 [src/web](/Users/kris/项目/Project_demo/evolution/free-code/src/web)，由两部分组成：

- 前端：React + Vite
- 服务端：Express + Bun

核心能力：

- 会话式聊天 Agent
- 工作区文件浏览与编辑
- 企业数据源管理
- 企业模块创建、刷新、发布
- 报表规划与 traceability
- 管理员鉴权和 enterprise 数据持久化

关键入口：

- 前端入口：[src/web/main.tsx](/Users/kris/项目/Project_demo/evolution/free-code/src/web/main.tsx)
- Web 应用壳：[src/web/AppWeb.tsx](/Users/kris/项目/Project_demo/evolution/free-code/src/web/AppWeb.tsx)
- 服务端入口：[src/web/server.ts](/Users/kris/项目/Project_demo/evolution/free-code/src/web/server.ts)

### 2. CLI

CLI 入口仍然保留，适合终端环境下直接使用：

- CLI 入口：[src/entrypoints/cli.tsx](/Users/kris/项目/Project_demo/evolution/free-code/src/entrypoints/cli.tsx)

## 当前已实现的企业能力

### 核心企业功能
- 管理员创建和登录
- connector 持久化和管理
- module 持久化、刷新和发布确认门
- session enterprise metadata 持久化
- 已发布模块进入用户运行时
- 报表规划 trace 和 ReportInspector 面板
- workspace 级文件读写保护
- API rate limiting (per-session 和 admin 端点)
- Admin 操作审计日志

### Agent 与会话功能
- Session rename (double-click 编辑)
- AI typing indicator (bouncing dots)
- Message retry on failure
- Conversation export to Markdown
- Keyboard shortcuts (Cmd+Enter submit, Cmd+Shift+L clear, Escape cancel)
- Toast notification system (success/error/info, auto-dismiss)
- Loading skeletons with shimmer animation
- Empty state designs (sessions, modules, connectors, conversation)

### 专业 UI/UX
- Professional status badges (module lifecycle: draft/published/archived; connector: connected/disconnected/connecting)
- Professional header branding with product name and admin mode indicator
- Input area improvements (character count, clear button, placeholder hints)
- Session list search, date filter, and sort
- Message timestamps (relative) and consecutive message grouping
- Dark mode theme support (toggle, localStorage persistence, system preference)

### 质量保障
- BUILD_STUDIO_20@v1 scenario (20 steps, shadow + primary mode)
- GitHub Actions CI pipeline (test + build + scenario smoke test)
- Playwright UI component tests (DataSourceManager, ModuleManager, surface switching)
- TypeScript strict mode enabled
- Vite production build with code splitting

当前还不是完整 ERP/CRM 替代系统，也不是通用低代码平台。

## 环境要求

- [Bun](https://bun.sh) `>= 1.3.11`
- macOS 或 Linux
- 一个可用的 `ANTHROPIC_API_KEY`

安装依赖：

```bash
bun install
```

## 环境变量

最少需要：

```bash
export ANTHROPIC_API_KEY="your-api-key"
```

可选：

```bash
export ANTHROPIC_BASE_URL="https://api.minimaxi.com/anthropic"
export FREE_CODE_ADMIN_BOOTSTRAP_SECRET="your-bootstrap-secret"
```

说明：

- `ANTHROPIC_API_KEY`：模型调用必需
- `ANTHROPIC_BASE_URL`：可选，默认就是 `https://api.minimaxi.com/anthropic`
- `FREE_CODE_ADMIN_BOOTSTRAP_SECRET`：推荐在首次启动 Web 管理后台前设置。这样首个管理员初始化时你能明确知道 bootstrap secret

如果不设置 `FREE_CODE_ADMIN_BOOTSTRAP_SECRET`，系统会在首次启动时自动生成 bootstrap secret，并把哈希配置文件写到：

- `.free-code-enterprise/admin-bootstrap.json`

## 如何启动

### 启动 Web 端

在仓库根目录执行：

```bash
bun run web:dev
```

默认会启动：

- Web 服务：`http://localhost:8080`

这个服务已经集成了前端和后端开发模式，直接打开浏览器访问即可。

### 首次初始化管理员

启动 Web 服务后，打开 Settings 里的 `Enterprise` 标签页。

首次初始化需要填 3 个字段：

- `Admin username`
- `Admin password`
- `Bootstrap secret`

创建成功后，系统会返回 admin session，后续 Enterprise 管理操作都需要这个登录态。

### 启动 CLI

直接从源码运行：

```bash
bun run dev
```

如果你想先编译再运行：

```bash
bun run build
./cli
```

## 常用命令

```bash
# CLI 开发模式
bun run dev

# Web 开发模式
bun run web:dev

# Web 构建
bun run web:build

# Web 测试
bun run web:test

# Web 检查（测试 + 构建）
bun run web:check

# CLI 构建
bun run build
```

## 目录说明

```text
src/
  entrypoints/cli.tsx     CLI 入口
  main.tsx                CLI 主装配
  screens/REPL.tsx        CLI 交互主界面
  commands.ts             CLI 命令注册
  tools.ts                CLI 工具注册

  web/
    main.tsx              Web 前端入口
    AppWeb.tsx            Web 主应用壳
    server.ts             Web 服务端入口
    components/           Web UI 组件
    engine/               Web 会话、auth、connector、module、reporting
```

运行时会生成两个本地目录：

- `.free-code-sessions`：会话和 workspace 状态
- `.free-code-enterprise`：管理员鉴权和 enterprise 数据

## 当前管理员相关接口

管理员鉴权：

- `GET /api/admin/auth/status`
- `POST /api/admin/auth/setup`
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`

企业管理：

- `GET /api/admin/connectors`
- `POST /api/admin/connectors`
- `PUT /api/admin/connectors/:id`
- `GET /api/admin/modules`
- `POST /api/admin/modules`
- `POST /api/admin/modules/:id/refresh`
- `POST /api/admin/modules/:id/publish`

用户侧报表：

- `POST /api/sessions/:id/reports/plan`

## 验证启动是否正常

建议至少跑一次：

```bash
bun run web:check
```

如果你只想验证服务能起来：

```bash
curl http://localhost:8080/api/health
```

正常情况下会返回类似：

```json
{
  "status": "ok"
}
```

## 当前系统边界

这个项目现在适合做：

- 企业文档和表格生成 Agent
- 企业数据源接入后的报表与周报生成
- 管理员自助构建 connector / module / publish 流程

这个项目现在还不适合直接当成：

- 完整 ERP
- 完整 CRM
- 通用低代码搭建平台
- 多人协同编辑平台

## License

项目来源于 Claude Code 源码快照的可构建 fork，请按你自己的使用场景自行评估合规和风险。
