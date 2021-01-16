import fs from 'fs'
import webpack from 'webpack'
import loaderUtils from 'loader-utils'
import { loadModule, normalizePath } from '../lib/utils'
import { LoaderOptions, LoaderType } from '../Plugin'

const cwd = fs.realpathSync(process.cwd())

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
          resourcePath: normalizePath(this.resourcePath, cwd),
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

export const raw = true
localeLoader.raw = raw
localeLoader.filepath = __filename
export default localeLoader
