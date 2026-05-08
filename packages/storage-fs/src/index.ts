/** storage-fs Extension 工厂。注册后 runtime 自动持久化 session/message。 */
import type { Extension } from '@crai/core'
import { FileStorageAdapter, type FileStorageOptions } from './adapter'
import { EXTENSION_NAME } from './constants'

export interface FileStorageExtensionOptions extends FileStorageOptions {
  storageName?: string
}

/**
 * 创建文件存储 extension。
 * 注册后 runtime 的每个 turn 会自动读写 session/message 到磁盘。
 */
export function createFileStorage(options?: FileStorageExtensionOptions): Extension {
  const storageName = options?.storageName ?? EXTENSION_NAME

  return {
    name: storageName,
    setup(ctx) {
      const adapter = new FileStorageAdapter(options ?? {})
      ctx.registry.storages.register('storage:fs-default', adapter)
    },
  }
}
