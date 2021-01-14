import path from 'path'
import webpack, { RuleSetLoader, RuleSetRule, RuleSetUse } from 'webpack'

type Rules = Omit<RuleSetRule[] | RuleSetUse | RuleSetLoader, string>

/**
 * 递归查找包含指定loader的rule
 * @param rules
 * @param matcher
 */
export function findLoader(rules: Rules, matcher: Function) {
  let matched: any = undefined
  if (!Array.isArray(rules)) {
    rules = [rules]
  }
  ;(<Array<Rules>>rules).some((rule: RuleSetRule, index: number) => {
    if (rule) {
      if (matcher(rule)) {
        matched = { rule, parent: rules, index }
      } else if (rule.use) {
        matched = findLoader(rule.use, matcher)
      } else if (rule.oneOf) {
        matched = findLoader(rule.oneOf, matcher)
      } else if (Array.isArray(rule.loader)) {
        matched = findLoader(rule.loader, matcher)
      }
    }
    return matched !== undefined
  })
  return matched
}

/**
 * 添加一个新的loader配置到指定的位置。
 * 如果添加成功，则返回true。
 * @param config
 * @param matcher
 * @param newLoader
 * @param getPosition
 */
function addLoader(
  config: webpack.Configuration,
  matcher: Function,
  newLoader: webpack.RuleSetRule,
  getPosition: Function
) {
  const matched = findLoader(config.module!.rules, matcher)
  if (matched) {
    matched.parent.splice(getPosition(matched.index), 0, newLoader)
    return true
  }
  return false
}

/**
 * 根据名称匹配loader。
 * @param name
 */
export function matchLoaderByName(name: string) {
  return (rule: string | RuleSetRule) => {
    let matched = false
    if (typeof rule === 'string') {
      matched =
        rule === name ||
        rule.indexOf(`${path.sep}${name}${path.sep}`) !== -1 ||
        rule.indexOf(`@${name}${path.sep}`) !== -1
    } else if (typeof rule.loader === 'string') {
      matched =
        rule.loader === name ||
        rule.loader.indexOf(`${path.sep}${name}${path.sep}`) !== -1 ||
        rule.loader.indexOf(`@${name}${path.sep}`) !== -1
    }
    return matched
  }
}

/**
 * 在匹配到的loader之前添加新的loader配置。
 * @param config
 * @param matcher
 * @param newLoader
 */
export const addLoaderBefore = (
  config: webpack.Configuration,
  matcher: Function,
  newLoader: webpack.RuleSetRule
) => addLoader(config, matcher, newLoader, (x: number) => x)
