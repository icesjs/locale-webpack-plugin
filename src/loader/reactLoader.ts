import path from 'path'
import webpack from 'webpack'
import { getOptions, stringifyRequest } from 'loader-utils'
import { loadModule } from '../lib/utils'
import { requireModuleLoader } from '../lib/module'
import { LibModuleLoader, LoaderType } from '../Plugin'

type ReactLoader = webpack.loader.Loader & LoaderType
type LoaderContext = webpack.loader.LoaderContext
let libLoaderModule: any

/**
 * 获取模块代码生成器。
 */
function getCodeGenerator(): LibModuleLoader['getModuleCode'] | never {
  const libName = reactLoader.libModuleName as string
  if (!libLoaderModule) {
    const { loader } = requireModuleLoader([libName])[0]
    libLoaderModule = loader
  }
  const generator = libLoaderModule.getModuleCode
  if (typeof generator !== 'function') {
    throw new Error(`Cannot get the loader interface named by getModuleCode from ${libName}`)
  }
  return generator
}

/**
 * 将语言定义文件转换为React组件模块。
 */
export const reactLoader: ReactLoader = function (this: LoaderContext) {
  const callback = this.async() || (() => {})
  let generator: ReturnType<typeof getCodeGenerator>
  try {
    generator = getCodeGenerator()
  } catch (err) {
    callback(err)
    return
  }

  const { fileTypes, esModule } = getOptions(this)
  loadModule.call(
    this,
    `${fileTypes}&f=${path.relative(this.rootContext, this.resourcePath)}`,
    (error, source, sourceMap, module) => {
      if (!error) {
        try {
          const code = generator({
            module: stringifyRequest(this, module.resource),
            esModule: esModule as boolean,
            resourcePath: this.resourcePath,
          })
          callback(null, code, sourceMap)
          return
        } catch (err) {
          error = err
        }
      }
      callback(error instanceof Error ? error : new Error(`${error}`))
    }
  )
}

reactLoader.raw = true
reactLoader.resourceQuery = /react/
reactLoader.filepath = __filename
reactLoader.libModuleName = '@ices/react-locale'

export default reactLoader
