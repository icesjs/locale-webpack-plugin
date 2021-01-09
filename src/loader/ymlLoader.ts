import yaml from 'js-yaml'
import webpack from 'webpack'
import loaderUtils from 'loader-utils'
import { LoaderType } from '../Plugin'

type YmlLoader = webpack.loader.Loader & LoaderType
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
  return definitions
}

/**
 * 解析yml格式的语言定义文件。
 */
const ymlLoader: YmlLoader = function (this: LoaderContext, source: string | Buffer) {
  const { esModule } = loaderUtils.getOptions(this)
  const content = loadLocales.call(this, source as string)
  return `${esModule ? 'export default ' : 'module.exports='}${JSON.stringify(content)}`
}

ymlLoader.resourceQuery = /ya?ml/
ymlLoader.filepath = __filename
export default ymlLoader
