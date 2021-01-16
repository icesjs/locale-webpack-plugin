import webpack from 'webpack'
import loaderUtils from 'loader-utils'
import { loadModule } from '../lib/utils'
import { LoaderOptions, LoaderType } from '../Plugin'

type LoaderContext = webpack.loader.LoaderContext

const localeLoader: LoaderType = function (this: LoaderContext) {
  const options: any = loaderUtils.getOptions(this)
  const { generator, extensions, esModule } = options as LoaderOptions
  const callback = this.async() || (() => {})

  loadModule.call(this, extensions.join('&'), (err, source, sourceMap, module) => {
    let error = err
    let code
    try {
      if (!error) {
        code = generator({
          esModule,
          resourcePath: this.resourcePath,
          module: loaderUtils.stringifyRequest(this, module.resource),
        })
      }
    } catch (err) {
      error = err
    } finally {
      if (error) {
        callback(err)
      } else {
        callback(null, code, sourceMap)
      }
    }
  })
}

localeLoader.raw = true
localeLoader.filepath = __filename
export default localeLoader
