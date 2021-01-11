import path from 'path'
import webpack from 'webpack'
import { getOptions, stringifyRequest } from 'loader-utils'
import { loadModule } from '../lib/utils'
import { LoaderType } from '../Plugin'

type ReactLoader = webpack.loader.Loader & LoaderType
type LoaderContext = webpack.loader.LoaderContext

function getModuleCode(this: LoaderContext, resource: string, esModule: boolean) {
  const request = stringifyRequest(this, resource)
  const runtime = stringifyRequest(this, '@ices/react-locale')
  return esModule
    ? `
    /** ${this.resourcePath} **/
    import definitions from ${request}
    import { withDefinitionsComponent, withDefinitionsHook } from ${runtime}
    export { setLocale, getLocale, utils, plugins, subscribe } from ${runtime}
    export const Translate = withDefinitionsComponent(definitions)
    export const Trans = Translate
    export const useLocale = withDefinitionsHook(definitions)
    export { definitions, useLocale as default }
  `
    : `
    const definitions = require(${request})
    const runtime = require(${runtime})
    const { withDefinitionsComponent, withDefinitionsHook, setLocale, getLocale, utils, plugins, subscribe } = runtime
    const useLocale = withDefinitionsHook(definitions)
    const Translate = withDefinitionsComponent(definitions)
    const Trans = Translate
    Object.assign(module.exports = exports = useLocale, {
      setLocale, getLocale, subscribe,
      useLocale, Translate, Trans,
      utils, plugins, definitions
    })
  `
}

/**
 * 将语言定义文件转换为React组件模块。
 */
export const reactLoader: ReactLoader = function (this: LoaderContext) {
  const callback = this.async() || (() => {})
  const { fileTypes, esModule } = getOptions(this)
  loadModule.call(
    this,
    `${fileTypes}&f=${path.relative(this.rootContext, this.resourcePath)}`,
    (err, source, sourceMap, module) => {
      if (err) {
        callback(err)
      } else {
        const code = getModuleCode.call(this, module.resource, esModule as boolean)
        callback(null, code, sourceMap)
      }
    }
  )
}

reactLoader.raw = true
reactLoader.resourceQuery = /react/
reactLoader.filepath = __filename
export default reactLoader
