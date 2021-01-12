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
    import { withDefinitionsComponent, withDefinitionsHook, withDefinitionsContextHook } from ${runtime}
    export * from ${runtime}
    export const Trans = withDefinitionsComponent(definitions)
    export const Translate = Trans
    export const useTrans = withDefinitionsHook(definitions)
    export const useTranslate = useTrans
    export const useContextTrans = withDefinitionsContextHook(definitions)
    export const useContextTranslate = useContextTrans
    export { definitions, useTrans as default }
  `
    : `
    /** ${this.resourcePath} **/
    const definitions = require(${request})
    const runtime = require(${runtime})
    const { withDefinitionsComponent, withDefinitionsHook, withDefinitionsContextHook } = runtime
    
    Object.defineProperty(exports, '__esModule', { value: true });
    
    const Trans = withDefinitionsComponent(definitions)
    const Translate = Trans
    const useTrans = withDefinitionsHook(definitions)
    const useTranslate = useTrans
    const useContextTrans = withDefinitionsContextHook(definitions)
    const useContextTranslate = useContextTrans
    
    exports.default = useTrans
    exports.definitions = definitions
    
    exports.Trans = Trans
    exports.Translate = Translate
    exports.useTrans = useTrans
    exports.useTranslate = useTranslate
    exports.useContextTrans = useContextTrans
    exports.useContextTranslate = useContextTranslate
    
    exports.withDefinitionsComponent = withDefinitionsComponent
    exports.withDefinitionsHook = withDefinitionsHook
    exports.withDefinitionsContextHook = withDefinitionsContextHook
    
    exports.withDefinitions = runtime.withDefinitions
    exports.getLocale = runtime.getLocale
    exports.setLocale = runtime.setLocale
    exports.subscribe = runtime.subscribe
    exports.plugins = runtime.plugins
    exports.utils = runtime.utils
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
