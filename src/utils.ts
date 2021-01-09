import webpack from 'webpack'
import { addBeforeLoader as addLoader, loaderByName } from '@craco/craco'

export function addBeforeLoader(
  webpackConfig: webpack.Configuration,
  rule: webpack.RuleSetRule,
  tries: string[]
) {
  const { module = { rules: [] } } = webpackConfig
  const { rules } = module
  module.rules = rules
  webpackConfig.module = module

  const getMatcher = (name: string) => (rule: webpack.RuleSetRule | string) => {
    let matched = loaderByName(name)(rule)
    if (!matched) {
      if (typeof rule === 'string') {
        matched = rule === name
      } else if (typeof rule.loader === 'string') {
        matched = rule.loader === name
      }
    }
    return matched
  }

  for (const name of tries) {
    if (addLoader(webpackConfig, getMatcher(name), rule).isAdded) {
      return
    }
  }
  rules.push(rule)
}
