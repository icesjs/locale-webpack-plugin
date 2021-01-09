import path from 'path'
import webpack from 'webpack'
import { addLoaderBefore as addLoader, matchLoaderByName } from './addLoader'

/**
 * 在指定loader之前添加新的loader。
 * @param config
 * @param rule
 * @param tries
 */
export function addLoaderBefore(
  config: webpack.Configuration,
  rule: webpack.RuleSetRule,
  tries: string[]
) {
  const { module = { rules: [] } } = config
  const { rules } = module
  module.rules = rules
  config.module = module

  for (const name of tries) {
    if (addLoader(config, matchLoaderByName(name), rule)) {
      return
    }
  }
  rules.push(rule)
}

/**
 * 加载一个模块资源。
 * @param resourceQuery
 * @param callback
 */
export function loadModule(
  this: webpack.loader.LoaderContext,
  resourceQuery: string,
  callback: (err: any, source: any, sourceMap: any, module: any) => any
) {
  const request = `./${path
    .relative(this.context, this.resourcePath)
    .replace(/^\.[/\\]/g, '')}?${resourceQuery}`
  return this.loadModule(request, callback)
}
