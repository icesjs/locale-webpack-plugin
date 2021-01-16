import fs from 'fs'
import path from 'path'
import webpack from 'webpack'
import { stringifyRequest, getOptions } from 'loader-utils'
import { getIdentifierMaker, normalizePath } from '../lib/utils'
import parseIncludeAsync from '../lib/include'
import merge from '../lib/merge'
import loadResource from '../lib/resource'
import { LoaderOptions, LoaderType } from '../Plugin'

type LoaderContext = webpack.loader.LoaderContext

const cwd = fs.realpathSync(process.cwd())
// 这个文件需要在浏览器端运行，辅助进行数据合并
const runtime = path.join(__dirname, '../lib/merge')

/**
 * 加载单个模块资源。
 */
function loadData(this: LoaderContext, source: string | Buffer) {
  if (Buffer.isBuffer(source)) {
    source = source.toString('utf8')
  }
  const { warnings, locale, data } = loadResource(source, this.resourcePath)
  for (const warn of warnings) {
    this.emitWarning(warn)
  }
  return { locale, data }
}

/**
 * 生成仅单个静态模块时的模块代码。
 */
function getStaticModuleCode(
  this: LoaderContext,
  data: ReturnType<typeof loadData>,
  esModule: boolean
) {
  // 这里使用 merge 对数据进行格式化
  const dataSet = merge([data])
  const exports = JSON.stringify(dataSet)
  return `/** ${normalizePath(this.resourcePath, cwd)} **/\n${
    esModule ? 'export default ' : 'module.exports = '
  }${exports}
  `
}

/**
 * 生成包含导入子模块时的模块代码。
 */
function getImportModuleCode(
  this: LoaderContext,
  files: { file: string; source: string }[],
  extensions: string[],
  esModule: boolean
) {
  const getIdent = getIdentifierMaker('loc')
  const query = extensions.join('&')
  const identifiers = []
  const codeSnippets = []

  const def = getIdent('def')
  if (!esModule) {
    // es导出兼容
    codeSnippets.push(
      `function ${def}(e){return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }}`
    )
  }

  // 当前模块自身
  const main = files.pop()

  for (const { file } of [{ file: runtime }, ...files]) {
    const id = getIdent(path.basename(file, path.extname(file)))
    const req = stringifyRequest(this, file + `${file === runtime ? '' : '?' + query}`)
    if (esModule) {
      codeSnippets.push(`import ${id} from ${req}`)
    } else {
      codeSnippets.push(`const ${id} = ${def}(require(${req})).default`)
    }
    identifiers.push(id)
  }

  // 添加模块自身数据
  const { file, source } = main!
  const mainId = getIdent(path.basename(file, path.extname(file)))
  const mainData = loadData.call(this, source)
  codeSnippets.push(`const ${mainId} = ${JSON.stringify(mainData)}`)

  // 使用 merge 函数对所有数据进行合并
  const execMerge = `${identifiers[0]}([${identifiers
    .slice(1)
    // 每个数据模块导出时都已通过merge处理，这里再次被导入，需要套一层data，才能再次被merge处理
    .map((id) => `{data:${id}}`)
    // mainId变量模块是自身数据模块，是直接引用的本地数据，所以不需要套一层data，这里concat进变量
    .concat(mainId)
    .join(',')}])`
  if (esModule) {
    codeSnippets.push(`export default ${execMerge}`)
  } else {
    codeSnippets.push(`module.exports = ${execMerge}`)
  }

  return `/** ${normalizePath(this.resourcePath, cwd)} **/\n${codeSnippets.join('\n')}`
}

/**
 * pitch阶段，解析include指令，并处理子模块导入情况
 */
export const pitch = function (this: LoaderContext) {
  const options: any = getOptions(this)
  const { esModule, extensions } = options as LoaderOptions
  const callback = this.async() || (() => {})
  // 处理包含导入情况
  parseIncludeAsync(this.resourcePath, this.fs as typeof fs)
    // 如果包含include进来的模块，则导入该模块
    .then(({ error, warnings, files }) => {
      for (const warn of warnings) {
        this.emitWarning(warn)
      }
      if (files.length > 1) {
        this.clearDependencies()
        for (const { file } of files) {
          this.addDependency(file)
        }
      }
      if (error) {
        callback(error)
      } else if (files.length > 1) {
        // 生成模块导入代码，并跳过常规 loader
        callback(null, getImportModuleCode.call(this, files, extensions, esModule))
      } else {
        // 由 loader 常规处理
        callback(null)
      }
    })
}

/**
 * 常规loader阶段。
 */
const ymlLoader: LoaderType = function (this: LoaderContext, source: string | Buffer) {
  const options: any = getOptions(this)
  const { esModule } = options as LoaderOptions
  // 需要重设依赖，因为可能从有导入子模块变成了不导入
  this.clearDependencies()
  this.addDependency(this.resourcePath)
  // 处理单个的资源模块
  const data = loadData.call(this, source)
  return getStaticModuleCode.call(this, data, esModule)
}

ymlLoader.pitch = pitch
ymlLoader.test = /\.ya?ml$/
ymlLoader.resourceQuery = /ya?ml/
ymlLoader.filepath = __filename
ymlLoader.extensions = ['.yml', '.yaml']
export default ymlLoader
