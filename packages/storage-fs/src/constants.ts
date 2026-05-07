/** storage-fs 包内私有常量 */

export const DEFAULT_BASE_DIR = '.crai/data'

export const DIRS = {
  SESSIONS: 'sessions',
  MESSAGES: 'messages',
  ARTIFACTS: 'artifacts',
} as const

export const EXTENSION_NAME = 'storage:fs'

export const ADAPTER_NAME = 'storage:fs-default'

export const FILE_SUFFIX = '.json'
