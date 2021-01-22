import fs from 'fs'
import path from 'path'
import vm from 'vm'
import * as babel from '@babel/core'
import webpack from 'webpack'
import { getHashDigest, getOptions } from 'loader-utils'
import { normalizePath } from '../lib/utils'
import merge from '../lib/merge'
import loadResource from '../lib/resource'
import { LoaderOptions, LoaderType } from '../Plugin'

const cwd = fs.realpathSync(process.cwd())
const mergeModulePath = path.join(__dirname, '../lib/merge')

type LoaderContext = webpack.loader.LoaderContext

/**
 * 加载数据
 */
function loadData(this: LoaderContext, file: string) {
  const source = (this.fs || fs).readFileSync(file)
  const { warnings, locale, data } = loadResource(source, file)
  for (const warn of warnings) {
    this.emitWarning(warn)
  }
  return merge([{ locale, data }])
}

/**
 * 转换代码。
 */
function transformCode(originalCode: string) {
  const res = babel.transform(originalCode, {
    babelrc: false,
    presets: [
      [
        require('@babel/preset-env'),
        {
          modules: 'commonjs',
          targets: { node: 'current' },
        },
      ],
    ],
  })
  const code = res ? res.code : ''
  if (typeof code !== 'string') {
    return ''
  }
  return code
}

/**
 * 执行模块代码，获取导出结果及依赖信息
 */
function evalModuleCode(this: LoaderContext, code: string) {
  const dependencies = new Set<string>()
  const module = { exports: {} }
  const vmContext = vm.createContext({
    module,
    exports: module.exports,
    require: (file: string) => {
      file = file.split('!').pop()!.replace(/\?.*/, '')
      file = path.isAbsolute(file) ? file : path.join(this.context, file)
      if (mergeModulePath === file || `${mergeModulePath}.js` === file) {
        dependencies.add(file.replace(/(?:\.js)?$/, '.js'))
        return require(file)
      }
      dependencies.add(file)
      // 模块内容由内部插件生成，所以解析是确定的
      // 不会有嵌套超过一层的导入
      // 所以这里可以直接使用loadData进行数据加载
      return loadData.call(this, file)
    },
  })
  vm.runInContext(transformCode(code), vmContext, {
    displayErrors: true,
    breakOnSigint: true,
  })
  const exports: any = module.exports
  return {
    exports: exports && exports.__esModule ? exports.default : exports,
    dependencies,
  }
}

async function getModuleCode(this: LoaderContext, source: string, options: LoaderOptions) {
  const { exports, dependencies } = evalModuleCode.call(this, source)
  const { resourcePath } = this

  this.clearDependencies()
  this.addDependency(resourcePath)
  for (const deps of dependencies) {
    this.addDependency(deps)
  }

  const { extractor } = options
  const hash = getHashDigest(Buffer.from(resourcePath), 'md4', 'hex', 8)
  const code = await extractor!.extract(exports, hash)
  return `
    /** ${normalizePath(resourcePath, cwd)} (extracted) **/
    ${code} 
  `
}

const extractLoader: LoaderType = function (this: LoaderContext, source: string | Buffer) {
  const options: any = getOptions(this)
  this.cacheable(true)
  const callback = this.async() || (() => {})
  getModuleCode
    .call(
      this,
      Buffer.isBuffer(source) ? source.toString('utf8') : source,
      options as LoaderOptions
    )
    .then((code: string) => callback(null, code))
    .catch(callback)
}

extractLoader.filepath = __filename
export default extractLoader
