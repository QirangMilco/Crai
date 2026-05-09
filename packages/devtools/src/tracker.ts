/**
 * 任务追踪助手。
 * 解析、格式化、更新 Markdown 格式的实现跟踪文档。
 */

import type { TaskItem, TaskList, TaskStatus } from './types'

/** 从 Markdown 文本中提取任务列表（解析 - [ ] / - [x] 格式）。 */
export function parseTaskList(markdown: string, sectionTitle?: string): TaskList {
  const lines = markdown.split('\n')
  const tasks: TaskItem[] = []
  let inTargetSection = !sectionTitle

  for (const line of lines) {
    // 检测目标 section
    if (sectionTitle && line.startsWith('## ') && line.includes(sectionTitle)) {
      inTargetSection = true
      continue
    }
    // 如果在目标 section 内遇到下一个 section 则停止
    if (inTargetSection && line.startsWith('## ') && sectionTitle && !line.includes(sectionTitle)) {
      // 不退出，允许跨 section 收集（简单实现只收集到下一 section 前）
      if (tasks.length > 0) break
    }

    if (!inTargetSection) continue

    const match = line.match(/^\s*-\s+\[( |x|X)\]\s+(.+)/)
    if (match) {
      const checked = match[1] !== ' '
      tasks.push({
        content: match[2].trim(),
        status: checked ? 'completed' : 'pending',
      })
    }
  }

  return { tasks }
}

/** 将任务列表格式化为 Markdown。 */
export function formatTaskList(list: TaskList, indent = 0): string {
  const prefix = '  '.repeat(indent)
  return list.tasks
    .map((t) => {
      const check = t.status === 'completed' ? 'x' : ' '
      return `${prefix}- [${check}] ${t.content}`
    })
    .join('\n')
}

/** 更新单条任务的状态（通过 content 匹配）。 */
export function updateTaskStatus(
  list: TaskList,
  content: string,
  newStatus: TaskStatus,
): TaskList {
  return {
    ...list,
    tasks: list.tasks.map((t) =>
      t.content === content ? { ...t, status: newStatus } : t,
    ),
  }
}
