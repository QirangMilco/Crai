/**
 * Crai loader-ts。
 * 支持加载、卸载、重载本地 .ts 扩展文件。
 * 运行时依赖 tsx 或 ts-node 处理 TypeScript 转译。
 */
import type { Extension, ExtensionModule } from '../../core/src'
import { createRequire } from 'node:module'
import { watch } from 'node:fs'

const _nodeRequire = createRequire(import.meta.url)

/** 加载本地 .ts 文件为 Extension。 */
export async function loadExtension(filePath: string): Promise<Extension> {
  const resolved = _nodeRequire.resolve(filePath)
  const mod: ExtensionModule = await import(resolved)
  if (!mod.default || typeof mod.default.setup !== 'function') {
    throw new Error(`扩展文件 "${filePath}" 缺少 default export（需为 Extension 对象）`)
  }
  return mod.default
}

/**
 * 重载扩展：清除模块缓存后重新 import。
 * 适用于开发时热更新场景。
 */
export async function reloadExtension(filePath: string): Promise<Extension> {
  const resolved = _nodeRequire.resolve(filePath)
  delete _nodeRequire.cache[resolved]
  return loadExtension(resolved)
}

/** 卸载扩展：调用 dispose 清理资源。 */
export async function unloadExtension(ext: Extension): Promise<void> {
  await ext.dispose?.()
}

export interface ExtensionWatcherOptions {
  /** 文件变动后的防抖延迟（毫秒）。默认 300。 */
  debounceMs?: number
  /** 重载后是否自动卸载旧实例。默认 true。 */
  autoUnload?: boolean
}

/** 监听文件变化，自动重载扩展。返回 Disposable 用于停止监听。 */
export function watchExtension(
  filePath: string,
  onReload: (ext: Extension) => void,
  options?: ExtensionWatcherOptions,
): { dispose: () => void } {
  const debounceMs = options?.debounceMs ?? 300
  const autoUnload = options?.autoUnload ?? true

  let timer: ReturnType<typeof setTimeout> | undefined
  let currentExt: Extension | undefined

  const watcher = watch(filePath, async () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      try {
        if (autoUnload && currentExt) {
          await unloadExtension(currentExt)
        }
        currentExt = await reloadExtension(filePath)
        onReload(currentExt)
      } catch (err) {
        console.error(`重载扩展失败: ${filePath}`, err)
      }
    }, debounceMs)
  })

  return {
    dispose: () => {
      if (timer) clearTimeout(timer)
      watcher.close()
    },
  }
}
