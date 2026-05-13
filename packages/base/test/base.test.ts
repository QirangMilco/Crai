/**
 * @crai/base — 路径工具函数与日志实现测试。
 */
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveAllowedPath, getPathArg, validateToolPaths } from '../src/path'
import { ConsoleLogger } from '../src/logger'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
  tempDirs.push(dir)
  return dir
}

// ── resolveAllowedPath ──

describe('resolveAllowedPath', () => {
  it('合法路径返回标准化绝对路径', () => {
    const root = tempDir()
    const result = resolveAllowedPath('src/file.ts', root)
    assert.equal(result, join(root, 'src/file.ts'))
  })

  it('子目录路径合法', () => {
    const root = tempDir()
    const result = resolveAllowedPath('a/b/c/d.ts', root)
    assert.equal(result, join(root, 'a/b/c/d.ts'))
  })

  it('根目录本身返回根目录', () => {
    const root = tempDir()
    const result = resolveAllowedPath('.', root)
    assert.equal(result, root)
  })

  it('.. 逃逸抛出错误', () => {
    const root = tempDir()
    assert.throws(() => resolveAllowedPath('../etc', root), /路径拒绝/)
  })

  it('多层 .. 逃逸抛出错误', () => {
    const root = tempDir()
    assert.throws(() => resolveAllowedPath('a/../../etc', root), /路径拒绝/)
  })

  it('绝对路径逃逸抛出错误', () => {
    const root = tempDir()
    assert.throws(() => resolveAllowedPath('/etc', root), /路径拒绝/)
  })

  it('空字符串解析为 rootDir 本身', () => {
    const root = tempDir()
    const result = resolveAllowedPath('', root)
    assert.equal(result, root)
  })
})

// ── getPathArg ──

describe('getPathArg', () => {
  it('标准 path 参数提取并校验', () => {
    const root = tempDir()
    const result = getPathArg({ path: 'test.txt' }, root)
    assert.equal(result, join(root, 'test.txt'))
  })

  it('path 参数为空字符串时抛出错误', () => {
    assert.throws(() => getPathArg({ path: '' }, tempDir()), /path 参数必须是非空字符串/)
  })

  it('path 参数不存在时抛出错误', () => {
    assert.throws(() => getPathArg({}, tempDir()), /path 参数必须是非空字符串/)
  })

  it('path 参数逃逸时抛出错误', () => {
    const root = tempDir()
    assert.throws(() => getPathArg({ path: '../secret' }, root), /路径拒绝/)
  })
})

// ── validateToolPaths ──

describe('validateToolPaths', () => {
  it('所有路径合法时返回 undefined', () => {
    const root = tempDir()
    const result = validateToolPaths({ path: 'a.txt', dir: 'sub' }, root)
    assert.equal(result, undefined)
  })

  it('首个非法路径返回错误信息', () => {
    const root = tempDir()
    const result = validateToolPaths({ path: '../bad', source: 'ok' }, root)
    assert.ok(result)
    assert.equal(result?.argName, 'path')
  })

  it('非路径参数忽略', () => {
    const root = tempDir()
    const result = validateToolPaths({ content: 'hello', text: 'world' }, root)
    assert.equal(result, undefined)
  })

  it('非字符串值忽略', () => {
    const root = tempDir()
    const result = validateToolPaths({ path: 123, dir: true } as any, root)
    assert.equal(result, undefined)
  })
})

// ── ConsoleLogger ──

describe('ConsoleLogger', () => {
  it('info 级别输出不抛异常（控制台）', () => {
    const logger = new ConsoleLogger({ tag: 'test', level: 'info' })
    logger.info('test message')
    logger.debug('should not appear')
  })

  it('warn 和 error 级别输出不抛异常（控制台）', () => {
    const logger = new ConsoleLogger({ tag: 'test', level: 'warn' })
    logger.warn('warning message')
    logger.error('error message')
    logger.info('should not appear')
  })

  it('文件输出模式写入日志文件', () => {
    const dir = tempDir()
    const logger = new ConsoleLogger({ tag: 'test', level: 'info', logDir: dir })
    logger.info('hello from test')
    logger.warn('warning')

    const content = readFileSync(join(dir, 'test.log'), 'utf-8')
    assert.ok(content.includes('hello from test'))
    assert.ok(content.includes('warning'))
  })

  it('debug 级别输出到文件', () => {
    const dir = tempDir()
    const logger = new ConsoleLogger({ tag: 'app', level: 'debug', logDir: dir })
    logger.debug('debug test')

    const content = readFileSync(join(dir, 'app.log'), 'utf-8')
    assert.ok(content.includes('debug test'))
  })

  it('文件轮转：超出 maxFileSize 时创建备份', () => {
    const dir = tempDir()
    const logger = new ConsoleLogger({
      tag: 'rotate', level: 'info', logDir: dir,
      maxFileSize: 50, maxBackups: 2,
    })

    for (let i = 0; i < 100; i++) {
      logger.info(`line ${i} - this is a reasonably long log message for rotation testing`)
    }

    const logFile = join(dir, 'rotate.log')
    assert.ok(existsSync(logFile), `主日志文件 ${logFile} 应存在`)
  })
})
