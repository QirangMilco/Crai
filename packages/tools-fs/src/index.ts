import type { Extension } from '@crai/core'
import { TOOL_SAFETY_LEVELS } from '@crai/core'
import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveAllowedPath, getPathArg } from './path-utils'
import { editFile } from './edit'

// ── 配置 ─────────────────────────────────────────────

export interface FsToolsOptions {
  /** 工作区根目录，所有文件操作不得逃逸此目录。 */
  rootDir: string
}

// ── Extension 工厂 ──────────────────────────────────

export function createFsTools(options: FsToolsOptions): Extension {
  const rootDir = options.rootDir

  return {
    name: 'tools-fs',
    setup(ctx) {
      // ── fs_read ──
      ctx.registerTool({
        name: 'fs_read',
        description: '读取文件内容，返回带行号的内容。',
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
            const numbered = lines.map((line: string, i: number) => `${i + 1}|${line}`).join('\n')
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

            // 检查文件是否存在
            let exists = false
            try {
              await fs.access(allowedPath)
              exists = true
            } catch { /* 文件不存在 */ }

            if (exists && !args.overwrite) {
              return {
                toolCallId: request.toolCall.toolCallId,
                name: 'fs_write',
                isError: true,
                content: [{ type: 'text', text: `文件已存在: ${allowedPath}。设置 overwrite=true 以覆盖。` }],
              }
            }

            // 备份
            if (exists && args.overwrite) {
              const backupPath = allowedPath + '.bak'
              await fs.copyFile(allowedPath, backupPath).catch(() => {})
            }

            // 确保父目录存在
            const parentDir = dirname(allowedPath)
            await fs.mkdir(parentDir, { recursive: true })

            // 写入
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
          '搜索并替换文件内容。找到文件中与 searchContent 精确匹配的文本，替换为 replaceContent。' +
          '如果有多处匹配，设置 occurrence 参数指定替换第几处（1-indexed）。' +
          '修改前会自动备份原文件到 .bak。',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径' },
            searchContent: { type: 'string', description: '要搜索的文本（必须与文件中内容完全一致）' },
            replaceContent: { type: 'string', description: '替换后的文本' },
            occurrence: {
              type: 'number',
              description: '替换第几处匹配（1-indexed，默认 1）',
              default: 1,
            },
          },
          required: ['path', 'searchContent', 'replaceContent'],
        },
        safetyLevel: TOOL_SAFETY_LEVELS.RESTRICTED as any,
        execute: async (request) => {
          try {
            const args = request.toolCall.arguments as any
            const allowedPath = getPathArg(args, rootDir)
            const searchContent = String(args.searchContent ?? '')
            const replaceContent = String(args.replaceContent ?? '')
            const occurrence = args.occurrence ? Number(args.occurrence) : 1

            const result = await editFile(allowedPath, searchContent, replaceContent, occurrence)

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
