import yaml from 'js-yaml'
import webpack from 'webpack'
import loaderUtils from 'loader-utils'

type YmlWebpackLoader = webpack.loader.Loader
type LoaderContext = webpack.loader.LoaderContext

function loadLocales(this: LoaderContext, source: string) {
  let definitions = yaml.load(source, {
    json: true,
    onWarning: (err) => {
      const warning = new Error(err.message)
      warning.name = 'Warning'
      warning.stack = ''
      this.emitWarning(warning)
    },
  })
  if (!definitions || typeof definitions !== 'object') {
    definitions = {}
  }
  return JSON.stringify(definitions)
}

// 用于将yaml文件转换为hooks，以及函数组件
const ymlLoader: YmlWebpackLoader = function (this: LoaderContext, source: string | Buffer) {
  const content = loadLocales.call(this, source as string)
  const outputPath = loaderUtils.interpolateName(this, 'locales/[contenthash:8].json', {
    content,
  })
  this.emitFile(outputPath, content, null)
  const runtime = loaderUtils.stringifyRequest(this, '@ices/react-locale')
  const resource = loaderUtils.stringifyRequest(this, outputPath)
  //
  return `
    /** ${this.resourcePath} **/
    import { withDefinitionsComponent, withDefinitionsHook } from ${runtime}
    import definitions from ${resource}
    export { LocaleContext, setLocale, getLocale } from from ${runtime}
    export const Translate = withDefinitionsComponent(definitions)
    export const Trans = Translate
    export const useLocale = withDefinitionsHook(definitions)
    export default useLocale
  `
}

export default ymlLoader
