import fs from 'fs'
import path from 'path'
import webpack from 'webpack'
import {
  escapeRegExpCharacters,
  getEntries,
  isSamePath,
  normalizeLocale,
  normalizePath,
  writeFile,
  writeFileSync,
} from './utils'

const cwd = fs.realpathSync(process.cwd())

type Compiler = webpack.Compiler
type Module = webpack.compilation.Module
type Compilation = webpack.compilation.Compilation

export type ExtractPluginOptions = {
  /**
   * 抽取文件的输出目录。
   * 相对于构建输出目录。
   * 默认为 locales
   */
  outputDir?: string

  /**
   * 应用preload加载的首选语言代码。
   * 默认使用 REACT_APP_FALLBACK_LOCALE、VUE_APP_FALLBACK_LOCALE 环境变量值。
   * 仅现代浏览器支持该特性。
   */
  preload?: string

  /**
   * 被抽取的模块代码，是否使用esModule导出。
   */
  esModule?: boolean

  /**
   * 临时目录，用于生成locale文件。
   * 默认为 src/.locales 目录。
   */
  tmpDir?: string
}

export default class ExtractPlugin implements webpack.Plugin {
  static readonly pluginName = 'ExtractLocalesPlugin'

  private readonly options: ExtractPluginOptions
  private readonly tmpDir: string
  private readonly runtime: string
  private readonly localeFiles = new Map<string, string>()
  private readonly locales = new Map<string, { [k: string]: any }>()
  private preload: string = ''

  constructor(options?: any) {
    this.options = Object.assign(
      {
        tmpDir: 'src/.locales',
        outputDir: 'locales',
        esModule: true,
        preload: process.env.REACT_APP_FALLBACK_LOCALE || process.env.VUE_APP_FALLBACK_LOCALE,
      },
      options
    )
    const { tmpDir } = this.options
    this.checkTmpDir(tmpDir as string)
    this.tmpDir = path.resolve(tmpDir as string)
    this.runtime = this.createRuntime()
  }

  // 应用插件
  apply(compiler: Compiler) {
    this.clear()
    this.initPreloadLocale()
    const pluginName = ExtractPlugin.pluginName

    compiler.hooks.thisCompilation.tap(pluginName, (compilation: Compilation) => {
      compilation.hooks.finishModules.tapPromise(pluginName, async (modules) => {
        for (const module of this.getContextModules(modules)) {
          if (this.shouldRebuildContextModule(module)) {
            await new Promise((resolve, reject) => {
              // @ts-ignore
              compilation.rebuildModule(module, (err) => (err ? reject(err) : resolve()))
            })
          }
        }
      })
    })
  }

  // 初始化preload的语言模块
  initPreloadLocale() {
    if (this.preload) {
      writeFileSync(this.preload, '{}')
      this.localeFiles.set(this.preload, '{}')
      this.locales.set(path.basename(this.preload, '.json'), {})
    }
  }

  // 获取上下文模块
  getContextModules(modules: Module[]) {
    return modules.filter((module) => {
      if (!isSamePath(module.context || '', this.tmpDir, cwd)) {
        return false
      }
      const contextDependencies = module?.buildInfo?.contextDependencies || []
      for (const deps of contextDependencies) {
        if (isSamePath(deps || '', this.tmpDir, cwd)) {
          return true
        }
      }
    })
  }

  // 判断是否需要重新编译上下文模块
  shouldRebuildContextModule(module: Module) {
    const { blocks } = module as any
    const blockLocales = Array.isArray(blocks)
      ? new Set(blocks.map((dep) => path.resolve(this.tmpDir, dep.request || '')))
      : null
    if (!blockLocales) {
      return true
    }
    for (let file of fs.readdirSync(this.tmpDir)) {
      file = path.resolve(this.tmpDir, file)
      if (file === this.preload || file === this.runtime) {
        continue
      }
      if (!blockLocales.has(file)) {
        return true
      }
    }
    return false
  }

  // 初始化清理
  clear() {
    this.locales.clear()
    this.localeFiles.clear()
    this.clearFiles(this.tmpDir)
  }

  // 清理临时文件
  clearFiles(dir: string, excludes?: Set<string>) {
    dir = path.resolve(dir)
    if (fs.existsSync(dir)) {
      for (const file of fs.readdirSync(dir)) {
        const filepath = path.join(dir, file)
        if (excludes && excludes.has(filepath)) {
          continue
        }
        if (filepath !== this.runtime && filepath !== this.preload) {
          this.localeFiles.delete(filepath)
          fs.unlinkSync(filepath)
        }
      }
    }
  }

  // 检查目录可用性
  checkTmpDir(dir: string) {
    dir = path.resolve(dir)
    if (fs.existsSync(dir)) {
      const stats = fs.statSync(dir)
      if (!stats.isDirectory()) {
        throw new Error(`tmpdir is not a directory: ${normalizePath(dir, cwd)}`)
      }
    }
    if (dir === cwd) {
      throw new Error(`tmpdir cannot be current working directory`)
    }
    for (const p of [
      'config',
      'node_modules',
      'assets',
      'public',
      'resources',
      'scripts',
      'src',
      'test',
      'tests',
      '__tests__',
      '.vscode',
      '.idea',
    ]) {
      if (path.resolve(p) === dir) {
        throw new Error(`tmpdir cannot be a resource dir: ${p}`)
      }
    }
  }

  // 将导出的语言定义数据抽出成单独的语言文件模块
  async extract(exports: any, namespace: string) {
    for (const [loc, data] of getEntries(exports)) {
      const [locale] = normalizeLocale(loc)
      if (!this.locales.has(locale)) {
        this.locales.set(locale, {})
      }
      const localeData = this.locales.get(locale)
      localeData![namespace] = data
    }

    await this.writeLocalesFile()

    const { esModule } = this.options
    const runtime = JSON.stringify(this.runtime)
    const loader = 'asyncLoader'

    return `
      ${esModule ? `import ${loader} from ${runtime}` : `const ${loader} = require(${runtime})`}
      ${esModule ? 'export default ' : 'module.exports= '}${loader}(${JSON.stringify(namespace)})
    `
  }

  // 生成临时的locale文件
  async writeLocalesFile() {
    for (const [locale, data] of this.locales) {
      const file = `${path.resolve(this.tmpDir, locale)}.json`
      const content = JSON.stringify(data, null, 2)
      // 这里对文件内容进行下缓存判定，减少磁盘IO
      if (this.localeFiles.get(file) === content) {
        continue
      }
      await writeFile(file, content)
      this.localeFiles.set(file, content)
    }
  }

  // 创建运行时代码
  createRuntime() {
    const { outputDir, esModule, preload } = this.options
    const output = typeof outputDir === 'string' ? outputDir : 'locales'
    if (path.isAbsolute(output) || output.startsWith('..')) {
      throw new Error('Arguments Error: outputDir must be relative to build path')
    }
    const localesRoot = this.tmpDir
    const runtime = path.join(localesRoot, 'runtime.js')
    const chunkName = `${output.replace(/\\/g, '/').replace(/^\.?\/+|\/+$/, '')}/`
    const locales = normalizePath(localesRoot, path.dirname(runtime)).replace(/(?:\/+)?$/, '/')
    const [preloadLocale] = normalizeLocale(preload)
    this.preload = preloadLocale ? path.join(localesRoot, `${preloadLocale}.json`) : ''

    writeFileSync(
      runtime,
      `
      // Runtime for load locales

      const storage = {
        namespaces: {},
        locales: {}
      }

      const formatRes = (promise, locale) =>
        promise
          .then((res) => (res && res.__esModule ? res.default : res))
          .then((res) => (!res || typeof res !== 'object' ? {} : res))
          .catch((err) => {
            delete storage.locales[locale]
            if (err && err.code === 'MODULE_NOT_FOUND') {
              return {}
            }
            throw err
          })${
            preloadLocale
              ? `

      ;(async () => {
         const promise = formatRes(
           import(
             /* webpackChunkName: ${JSON.stringify(chunkName + 'pre')} */
             /* webpackMode: "lazy" */
             /* webpackPreload: true */
             ${JSON.stringify(locales + preloadLocale + '.json')}
           ), ${JSON.stringify(preloadLocale)}
         )
         storage.locales[${JSON.stringify(preloadLocale)}] = promise
         storage.locales[${JSON.stringify(preloadLocale)}] = await promise    
        })()`
              : ''
          }

      const fetchLocale = async (locale) => {
        const promise = formatRes(
          import(
            /* webpackInclude: /${
              preloadLocale ? `(?<!${escapeRegExpCharacters(preloadLocale)})` : ''
            }\\.json$/ */
            /* webpackChunkName: ${JSON.stringify(chunkName)} */
            /* webpackMode: "lazy" */
            \`${locales}\${locale}.json\`
          ), locale
        )
        storage.locales[locale] = promise
        storage.locales[locale] = await promise
      }

      const assemble = (namespace) => {
        const namespaceData = {}
        for (const [locale, data] of Object.entries(storage.locales)) {
          if (data instanceof Promise) {
            continue
          }
          namespaceData[locale] = data[namespace] || {}
        }
        storage.namespaces[namespace] = namespaceData
        return namespaceData
      }

      const asyncLoader = (namespace) => async (locale) => {
        const namespaceData = storage.namespaces[namespace]
        if (namespaceData && namespaceData[locale]) {
          return namespaceData
        }
        let localeData = storage.locales[locale]
        if (!localeData) {
          localeData = fetchLocale(locale)
        }
        if (localeData instanceof Promise) {
          await localeData
        }
        return assemble(namespace)
      }

      ${esModule ? 'export default ' : 'module.exports = '}asyncLoader
    `
    )

    return runtime
  }
}
