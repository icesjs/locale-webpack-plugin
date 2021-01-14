import webpack from 'webpack'
import { getOptions } from 'loader-utils'
import { loadModule } from '../lib/utils'
import { LoaderType } from '../Plugin'

type LocaleLoader = webpack.loader.Loader & LoaderType
type LoaderContext = webpack.loader.LoaderContext

/**
 * 将原始文件模块转发至模块转换loader。
 */
const localeLoader: LocaleLoader = function (this: LoaderContext) {
  const { componentType } = getOptions(this)
  const callback = this.async() || (() => {})
  loadModule.call(this, componentType as string, (err, source, sourceMap) =>
    err
      ? callback(err instanceof Error ? err : new Error(`${err}`))
      : callback(null, source, sourceMap)
  )
}

localeLoader.raw = true
localeLoader.filepath = __filename
export default localeLoader
