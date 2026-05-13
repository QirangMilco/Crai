# @crai/devtools

开发辅助工具包——任务追踪、仓库巡检、工作流助手。

## 定位

此包承载所有通用开发能力，不依赖 `core` / `runtime` 包。可以针对 Crai 自身使用，也可以独立用于其他项目。

## 模块

| 模块 | 功能 |
|------|------|
| `tracker` | 解析/格式化/更新 Markdown 实现跟踪文档 |
| `inspect` | 探索项目结构、查找源文件、分析包布局 |

## 使用示例

```ts
import { findPackages, parseTaskList } from '@crai/devtools'

// 查找 packages/ 下所有子包
const pkgs = findPackages('./packages')
console.log(pkgs) // ['core', 'runtime', 'security', ...]

// 解析实现跟踪器的任务列表
import { readFileSync } from 'node:fs'
const md = readFileSync('./docs/implementation-tracker.md', 'utf-8')
const list = parseTaskList(md, 'Todo')
console.log(list.tasks.filter(t => t.status === 'pending'))
```

## 设计原则

- 纯函数，无副作用（文件读写由调用方负责）
- 不依赖 core / runtime 包
- 可针对 Crai 或其他项目使用
