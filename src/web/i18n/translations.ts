export const translations = {
  en: {
    // General
    appName: 'Free Code',

    // Command Toolbar
    commands: 'Commands',
    settings: 'Settings',
    rewind: 'Rewind',
    workspace: 'Workspace',

    // Prompt Input
    selectOrCreateSession: 'Select or create a session to start...',
    processing: 'Processing...',
    typeMessage: 'Type a message (Enter to send, Shift+Enter for new line)',
    send: 'Send',
    stop: 'Stop',
    enterSend: 'Enter',
    newLine: 'Shift+Enter',
    cancelKey: 'Ctrl+C',
    history: 'Ctrl+R',

    // Session Sidebar
    newSession: 'New Session',
    sessions: 'Sessions',
    noSessions: 'No sessions yet',

    // Message Selector (Rewind)
    rewindToPrevious: 'Rewind to Previous Message',
    useArrowKeys: 'Use ↑/↓ or k/j to navigate, Enter to select, Esc to close',
    noMessagesToRewind: 'No messages available to rewind to.',

    // Settings
    language: 'Language',
    theme: 'Theme',
    apiKey: 'API Key',
    save: 'Save',
    cancel: 'Cancel',

    // Commands
    plan: 'Plan',
    compact: 'Compact',
    undo: 'Undo',
    diff: 'Diff',
    status: 'Status',

    // Errors
    errorOccurred: 'An error occurred',
    tryAgain: 'Try again',

    // Workspace Panel
    editor: 'Editor',
    files: 'Files',
    preview: 'Preview',
    selectFileToEdit: 'Select a file from the Files tab to edit',
    nothingToPreview: 'Nothing to preview',
  },
  zh: {
    // General
    appName: 'Free Code',

    // Command Toolbar
    commands: '命令',
    settings: '设置',
    rewind: '回溯',
    workspace: '工作区',

    // Prompt Input
    selectOrCreateSession: '选择或创建会话开始...',
    processing: '处理中...',
    typeMessage: '输入消息 (Enter 发送, Shift+Enter 换行)',
    send: '发送',
    stop: '停止',
    enterSend: 'Enter',
    newLine: 'Shift+Enter',
    cancelKey: 'Ctrl+C',
    history: 'Ctrl+R',

    // Session Sidebar
    newSession: '新会话',
    sessions: '会话',
    noSessions: '暂无会话',

    // Message Selector (Rewind)
    rewindToPrevious: '回溯到之前的消息',
    useArrowKeys: '使用 ↑/↓ 或 k/j 导航, Enter 选择, Esc 关闭',
    noMessagesToRewind: '没有可回溯的消息。',

    // Settings
    language: '语言',
    theme: '主题',
    apiKey: 'API 密钥',
    save: '保存',
    cancel: '取消',

    // Commands
    plan: '计划',
    compact: '压缩',
    undo: '撤销',
    diff: '差异',
    status: '状态',

    // Errors
    errorOccurred: '发生错误',
    tryAgain: '重试',

    // Workspace Panel
    editor: '编辑器',
    files: '文件',
    preview: '预览',
    selectFileToEdit: '从文件标签页选择文件进行编辑',
    nothingToPreview: '没有可预览的内容',
  },
} as const

export type Language = keyof typeof translations
export type TranslationKey = keyof typeof translations.en
