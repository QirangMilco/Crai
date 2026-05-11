import type { Extension } from '@crai/core'
import { TOOL_SAFETY_LEVELS } from '@crai/core'
import { promises as fs } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveAllowedPath, getPathArg } from './path-utils'
import { lineHash } from './line-hash'
import { editBySearch, editByHashline } from './edit'

// ── 配置 ─────────────────────────────────────────────

export interface FsToolsOptions {
  /** 工作区根目录，所有文件操作不得逃逸此目录。 */
  rootDir: string
  /** 备份目录（默认 {rootDir}/.crai/backups）。 */
  backupDir?: string
}

// ── Extension 工厂 ──────────────────────────────────

export function createFsTools(options: FsToolsOptions): Extension {
  const rootDir = options.rootDir
  const backupDir = options.backupDir ?? resolve(rootDir, '.crai', 'backups')

  return {
    name: 'tools-fs',
    setup(ctx) {
      // ── fs_read ──
      ctx.registerTool({
        name: 'fs_read',
        description:
          '读取文件内容。每行格式为 "行号:hash→代码"，例如 "42:a3c7→const x = 1"。' +
          'hash 为基于行内容的短签名，用于 fs_edit 的锚点定位。编辑时请直接引用锚点行号:hash。',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径（相对工作区或绝对路径）' },
          },
          required: ['path'],
        },
        safetyLevel: TOOL_SAFETY_LEVELS.SAFE as any,
        execute: async (request) => {
          try {
            const args = request.toolCall.arguments as any
            const allowedPath = getPathArg(args, rootDir)
            const content = await fs.readFile(allowedPath, 'utf-8')
            const lines = content.split('\n')
            const numbered = lines
              .map((line: string, i: number) => {
                const hash = lineHash(line)
                return `${i + 1}:${hash}\u2192${line}`
              })
              .join('\n')
            const summary = `文件: ${allowedPath}\n总行数: ${lines.length}\n\n${numbered}`
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'fs_read',
              content: [{ type: 'text', text: summary }],
            }
          } catch (err: any) {
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'fs_read',
              isError: true,
              content: [{ type: 'text', text: `读取失败: ${err.message}` }],
            }
          }
        },
      })

      // ── fs_write ──
      ctx.registerTool({
        name: 'fs_write',
        description: '写入文件。自动创建父目录。overwrite=true 时覆盖已有文件。',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径' },
            content: { type: 'string', description: '文件内容' },
            overwrite: {
              type: 'boolean',
              description: '是否覆盖已有文件（默认 false）',
              default: false,
            },
          },
          required: ['path', 'content'],
        },
        safetyLevel: TOOL_SAFETY_LEVELS.RESTRICTED as any,
        execute: async (request) => {
          try {
            const args = request.toolCall.arguments as any
            const allowedPath = getPathArg(args, rootDir)
            const content = String(args.content ?? '')

            let exists = false
            try {
              await fs.access(allowedPath)
              exists = true
            } catch { /* 不存在 */ }

            if (exists && !args.overwrite) {
              return {
                toolCallId: request.toolCall.toolCallId,
                name: 'fs_write',
                isError: true,
                content: [{ type: 'text', text: `文件已存在: ${allowedPath}。设置 overwrite=true 以覆盖。` }],
              }
            }

            if (exists && args.overwrite) {
              const dest = resolve(backupDir, `${Date.now().toString(36)}_write_${allowedPath.replace(/[/\\]/g, '_')}.bak`)
              await fs.mkdir(backupDir, { recursive: true })
              await fs.copyFile(allowedPath, dest).catch(() => {})
            }

            const parentDir = dirname(allowedPath)
            await fs.mkdir(parentDir, { recursive: true })
            await fs.writeFile(allowedPath, content, 'utf-8')

            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'fs_write',
              content: [{ type: 'text', text: `已写入 ${allowedPath}（${content.length} 字符）` }],
            }
          } catch (err: any) {
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'fs_write',
              isError: true,
              content: [{ type: 'text', text: `写入失败: ${err.message}` }],
            }
          }
        },
      })

      // ── fs_grep ──
      ctx.registerTool({
        name: 'fs_grep',
        description: '在文件中搜索文本（使用系统 grep，默认在工作区内搜索）。',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: '搜索模式（正则表达式）' },
            path: { type: 'string', description: '搜索路径（可选，默认工作区根目录）' },
          },
          required: ['pattern'],
        },
        safetyLevel: TOOL_SAFETY_LEVELS.SAFE as any,
        execute: async (request) => {
          try {
            const args = request.toolCall.arguments as any
            const pattern = String(args.pattern ?? '')
            const searchPath = args.path
              ? resolveAllowedPath(String(args.path), rootDir)
              : rootDir

            const result = spawnSync('grep', ['-rn', pattern, searchPath], {
              encoding: 'utf-8',
              maxBuffer: 1024 * 1024,
              timeout: 10_000,
            })
            const output = result.stdout?.trim() || result.stderr?.trim() || ''
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'fs_grep',
              content: [{ type: 'text', text: output || '(无匹配)' }],
            }
          } catch (err: any) {
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'fs_grep',
              isError: true,
              content: [{ type: 'text', text: `搜索失败: ${err.message}` }],
            }
          }
        },
      })

      // ── fs_list ──
      ctx.registerTool({
        name: 'fs_list',
        description: '列出目录内容。',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '目录路径（可选，默认工作区根目录）' },
          },
          required: [],
        },
        safetyLevel: TOOL_SAFETY_LEVELS.SAFE as any,
        execute: async (request) => {
          try {
            const args = request.toolCall.arguments as any
            const dirPath = args.path
              ? resolveAllowedPath(String(args.path), rootDir)
              : rootDir

            const entries = await fs.readdir(dirPath, { withFileTypes: true })
            const lines = entries.map((entry) => {
              const suffix = entry.isDirectory() ? '/' : ''
              return `${entry.name}${suffix}`
            })
            lines.sort()

            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'fs_list',
              content: [{ type: 'text', text: lines.join('\n') || '(空目录)' }],
            }
          } catch (err: any) {
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'fs_list',
              isError: true,
              content: [{ type: 'text', text: `列出目录失败: ${err.message}` }],
            }
          }
        },
      })

      // ── fs_edit ──
      ctx.registerTool({
        name: 'fs_edit',
        description:
          '修改文件内容。支持两种模式：\n' +
          '1. 搜索替换模式：提供 searchContent + replaceContent。适用于不确定精确位置的编辑。' +
          ' 支持逐级 fallback：精确匹配 → 归一化行匹配 → 模糊匹配（Jaccard 相似度 >= 0.75）。\n' +
          '2. 锚点模式：提供 startAnchor + replaceContent（可选 endAnchor）。' +
          ' 用于精确编辑——锚点格式 "行号:hash"（源自 fs_read 的输出，如 "42:a3c7"）。' +
          ' hash 校验确保编辑发生在正确位置。endAnchor 不传时编辑单行，传了表示替换 start-end 范围。\n' +
          '修改前自动备份到 .crai/backups/。',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径' },
            searchContent: {
              type: 'string',
              description: '搜索替换模式：要搜索的内容。必须与文件中内容基本一致（支持模糊匹配）。',
            },
            replaceContent: {
              type: 'string',
              description: '替换后的内容（搜索替换模式和锚点模式都用此字段指定新内容）。',
            },
            occurrence: {
              type: 'number',
              description: '搜索替换模式：替换第几处匹配（1-indexed，默认 1）',
              default: 1,
            },
            startAnchor: {
              type: 'string',
              description: '锚点模式：起始锚点，格式 "行号:hash"，如 "42:a3c7"',
            },
            endAnchor: {
              type: 'string',
              description: '锚点模式：结束锚点（可选），格式同上。不传或与 startAnchor 相同时替换单行。',
            },
          },
          oneOf: [
            { required: ['path', 'searchContent', 'replaceContent'] },
            { required: ['path', 'startAnchor', 'replaceContent'] },
          ],
        },
        safetyLevel: TOOL_SAFETY_LEVELS.RESTRICTED as any,
        execute: async (request) => {
          try {
            const args = request.toolCall.arguments as any
            const allowedPath = getPathArg(args, rootDir)

            // 判断模式
            const isHashlineMode = !!args.startAnchor

            if (isHashlineMode) {
              const startAnchor = String(args.startAnchor ?? '')
              const endAnchor = args.endAnchor ? String(args.endAnchor) : startAnchor
              const replaceContent = String(args.replaceContent ?? '')
              const result = await editByHashline(allowedPath, startAnchor, endAnchor, replaceContent, backupDir)
              return {
                toolCallId: request.toolCall.toolCallId,
                name: 'fs_edit',
                isError: !result.success,
                content: [{ type: 'text', text: result.message + (result.success ? '' : ' 请尝试搜索替换模式。') }],
              }
            }

            // 搜索替换模式
            const searchContent = String(args.searchContent ?? '')
            const replaceContent = String(args.replaceContent ?? '')
            const occurrence = args.occurrence ? Number(args.occurrence) : 1
            const result = await editBySearch(allowedPath, searchContent, replaceContent, occurrence, backupDir)
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'fs_edit',
              isError: !result.success,
              content: [{ type: 'text', text: result.message }],
            }
          } catch (err: any) {
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'fs_edit',
              isError: true,
              content: [{ type: 'text', text: `编辑失败: ${err.message}` }],
            }
          }
        },
      })
    },
  }
}
