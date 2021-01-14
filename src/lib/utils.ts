import fs from 'fs'
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

/**
 * 简单判断当前的工程，是不是一个typescript工程。
 */
export function isTypeScriptProject() {
  const cwd = fs.realpathSync(process.cwd())
  try {
    for (const file of fs.readdirSync(cwd).reverse()) {
      if (/tsconfig(\..+?)*\.json$/i.test(file)) {
        const { dependencies = {}, devDependencies = {} } = require(path.join(cwd, 'package.json'))
        if (dependencies.typescript || devDependencies.typescript) {
          return !!require.resolve('typescript', { paths: [cwd] })
        }
        break
      }
    }
  } catch (e) {}
  return false
}

/**
 * 获取当前模块的根路径。
 */
export function getSelfContext() {
  const cwd = fs.realpathSync(process.cwd())
  let file = __filename
  while (!fs.existsSync(path.join((file = path.dirname(file)), 'package.json'))) {
    if (file === cwd) {
      break
    }
  }
  if (file !== cwd) {
    return file
  }
  try {
    if (require(path.join(file, 'package.json')).name === '@ices/locale-webpack-plugin') {
      return file
    }
  } catch (e) {}
  return ''
}

/**
 * 转义处理正则元字符。
 * @param str 待处理的字符串。
 */
export function escapeRegExpCharacters(str: string): string {
  return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}
