import fs from 'fs'
import webpack from 'webpack'
import { getOptions, stringifyRequest } from 'loader-utils'
import { normalizePath } from '../lib/utils'
import { LoaderOptions, LoaderType } from '../Plugin'

const cwd = fs.realpathSync(process.cwd())
type LoaderContext = webpack.loader.LoaderContext

export const pitch = function (this: LoaderContext) {
  const options: any = getOptions(this)
  const { generator, extensions, esModule } = options as LoaderOptions
  const query = `?${extensions.join('&')}`
  if (this.resourceQuery === query) {
    return
  }

  this.cacheable(true)
  const callback = this.async() || (() => {})
  const request = normalizePath(this.resourcePath, this.context) + query

  this.loadModule(request, (err) => {
    if (err) {
      callback(err)
    } else {
      try {
        callback(
          null,
          generator({
            esModule,
            rootContext: cwd,
            resourcePath: normalizePath(this.resourcePath, cwd),
            module: stringifyRequest(this, request),
          })
        )
      } catch (err) {
        callback(err)
      }
    }
  })
}

const localeLoader: LoaderType = (source) => source
localeLoader.pitch = pitch
localeLoader.filepath = __filename
export default localeLoader
