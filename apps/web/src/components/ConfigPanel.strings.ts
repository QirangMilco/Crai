/**
 * ConfigPanel UI 文本常量。
 *
 * 集中管理所有用户可见文本，方便后续 i18n 迁移。
 * 新增文本时在此添加 key，不要在组件中直接写中文。
 */
export const ui = {
  // 侧栏标签
  tabProviders: '供应商',
  tabGeneral: '通用',

  // 供应商列表
  presetLabel: '预设',
  customLabel: '自定义',
  configured: '已配置',
  addProvider: '+ 添加供应商',
  deleteProvider: '删除供应商',
  configTitle: '配置',
  selectProviderHint: '选择一个供应商进行配置',

  // 添加自定义供应商
  addCustomTitle: '添加自定义供应商',
  nameLabel: '名称',
  namePlaceholder: '如:my-llm',
  apiKeyLabel: 'API Key',
  apiKeyPlaceholder: 'sk-...',
  baseUrlLabel: 'Base URL',
  baseUrlPlaceholder: 'https://api.xxx.com/v1',
  modelsApiPathLabel: 'API 路径（可选）',
  modelsApiPathPlaceholder: '/v1/models',
  addProviderBtn: '添加供应商',

  // 供应商配置
  editProviderTitle: '配置',
  baseUrlDefaultHint: '默认: ',
  apiPathLabel: 'API 路径',
  testConnection: '测试连接',
  connectionOk: '连接成功',
  connectionFail: '连接失败',
  connectionTesting: '测试中…',

  // 模型列表
  addedModels: '已添加模型',
  noModelsHint: '尚未添加模型。点击上方"添加模型"或"获取模型"。',
  addModel: '添加模型',
  fetchModels: '获取模型',
  fetching: '获取中…',
  searchModel: '搜索模型…',
  customModelPlaceholder: '输入模型 ID',
  manualAddBtn: '添加',
  fetchFirstHint: '先点击"获取模型"发现模型',
  noMatch: '无匹配结果',
  allAdded: '所有发现的模型均已添加',
  editModel: '编辑模型',
  removeModel: '移除模型',
  supportVision: '支持视觉',

  // 模型编辑弹窗
  editModelTitle: '编辑模型',
  modelIdLabel: '模型 ID',
  displayNameLabel: '显示名称（可选）',
  contextLengthLabel: '输入上下文',
  maxOutputLabel: '输出上限',
  visionLabel: '支持视觉',
  cancel: '取消',
  save: '保存',
  defaultOption: '默认',

  // 全局模型设置
  defaultModelLabel: '默认对话模型',
  toolModelLabel: '工具模型',
  autoSelect: '自动选择',
  useDefaultModel: '使用默认模型',
  defaultModelHint: '用于对话的主模型',
  toolModelHint: '用于标题生成、对话摘要等辅助任务',

  // 通用设置
  sandboxLabel: 'OS 沙箱',
  sandboxMode: '沙箱模式',
  sandboxHint: '启用后 bash 命令在隔离环境 (sandbox-exec/bwrap) 中执行，更安全。',
  compressionLabel: '上下文压缩',
  compressionThreshold: '触发阈值',
  compressionHint: '超过上下文窗口的此比例时自动触发压缩。较低的值会更频繁地移除旧消息以节省 Token。',
  autoSaveHint: '配置自动保存 · API key 已加密',

  // Mock（测试模式）
  mockLabel: 'Mock（测试）',

  // InfoIsland
  infoContext: '上下文',
} as const

export type UiKey = keyof typeof ui
