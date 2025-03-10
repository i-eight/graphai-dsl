import * as defaultAgents from '@graphai/agents';
import nestedAgentInfo from '@graphai/vanilla/lib/graph_agents/nested_agent';
import { AgentFunctionInfoDictionary } from 'graphai';
import { printlnInfo } from './println';
import { plusAgentInfo } from './plus-agent';
import { defAgentInfo } from './def-agent';
import { caseAgentInfo } from './case-agent';
import { loopAgentInfo, recurAgentInfo } from './loop-agent';
import { identityAgentInfo } from './identity-agent';
import { orAgentInfo } from './or-agent';
import { andAgentInfo } from './and-agent';
import { eqAgentInfo } from './eq-agent';
import { neqAgentInfo } from './neq-agent';
import { ltAgentInfo } from './lt-agent';
import { lteAgentInfo } from './lte-agent';
import { gtAgentInfo } from './gt-agent';
import { gteAgentInfo } from './gte-agent';
import { minusAgentInfo } from './minus-agent';
import { mulAgentInfo } from './mul-agent';
import { divAgentInfo } from './div-agent';
import { modAgentInfo } from './mod-agent';
import { powAgentInfo } from './pow-agent';
import { concatStringAgentInfo } from './concat-string-agent';
import { getArrayElementAgentInfo } from './get-array-element';
import { getObjectMemberAgentInfo } from './object-member-agent';
import { evalAgentInfo } from './eval-agent';
import { connectAgentInfo } from './connect-agent';
import { barRightArrowAgentInfo } from './bar-right-arrow-agent';
import { rightArrowRightArrowAgentInfo } from './right-arrow-right-arrow-agent';
import { rightArrowRightArrowEqualAgentInfo } from './right-arrow-right-arrow-equal-agent';
import { rightArrowRightArrowHyphenAgentInfo } from './right-arrow-right-arrow-hyphen-agent';
import { hyphenRightArrowRightArrowAgentInfo } from './hyphen-right-arrow-right-arrow-agent';
import { colonRightArrowAgentInfo } from './colon-right-arrow-agent';
import { applyAgentInfo } from './apply-agent';
import { hyphenHyphenRightArrowAgentInfo } from './hyphen-hyphen-right-arrow-agent';
import { getWeatherFromOpenMeteoAgentInfo } from './open-meteo-agent';
import { getMyIpAgentInfo } from './my-ip-agent';
import { getLocationFromIpAgentInfo } from './location-agent';
import { arrayAgentInfo, arraySizeAgentInfo, arraySplitAtAgentInfo } from './array-agent';
import { dateAgentInfo } from './date-agent';
import {
  closeGithubIssueAgentInfo,
  createGithubIssueAgentInfo,
  editGithubIssueAgentInfo,
  getGithubIssuesAgentInfo,
} from './github-agent';
import { getProcessEnvAgentInfo } from './process-agent';
import { getAgentInfoAgentInfo } from './agent-info-agent';
import { nativeImportAgentInfo } from './native-import-agent';
import { objectAgentInfo, objectTakeAgentInfo } from './object-agent';
import { JsonAgentInfo } from './json-agent';
import { throwAgentInfo } from './throw-agent';
import { tryCatchAgentInfo } from './try-catch';
import {
  isArrayAgentInfo,
  isBooleanAgentInfo,
  isNumberAgentInfo,
  isObjectAgentInfo,
  isStringAgentInfo,
} from './type-check';

export const agents: AgentFunctionInfoDictionary = {
  ...defaultAgents,
  nestedAgent: nestedAgentInfo,
  identity: identityAgentInfo,
  println: printlnInfo,
  andAgent: andAgentInfo,
  orAgent: orAgentInfo,
  eqAgent: eqAgentInfo,
  neqAgent: neqAgentInfo,
  ltAgent: ltAgentInfo,
  lteAgent: lteAgentInfo,
  gtAgent: gtAgentInfo,
  gteAgent: gteAgentInfo,
  plusAgent: plusAgentInfo,
  minusAgent: minusAgentInfo,
  mulAgent: mulAgentInfo,
  divAgent: divAgentInfo,
  modAgent: modAgentInfo,
  powAgent: powAgentInfo,
  barRightArrowAgent: barRightArrowAgentInfo,
  hyphenHyphenRightArrowAgent: hyphenHyphenRightArrowAgentInfo,
  rightArrowRightArrow: rightArrowRightArrowAgentInfo,
  rightArrowRightArrowEqualAgent: rightArrowRightArrowEqualAgentInfo,
  rightArrowRightArrowHyphenAgent: rightArrowRightArrowHyphenAgentInfo,
  hyphenRightArrowRightArrowAgent: hyphenRightArrowRightArrowAgentInfo,
  colonRightArrowAgent: colonRightArrowAgentInfo,
  concatStringAgent: concatStringAgentInfo,
  getArrayElementAgent: getArrayElementAgentInfo,
  getObjectMemberAgent: getObjectMemberAgentInfo,
  nativeImportAgent: nativeImportAgentInfo,
  defAgent: defAgentInfo,
  tryCatch: tryCatchAgentInfo,
  caseAgent: caseAgentInfo,
  throw: throwAgentInfo,
  loop: loopAgentInfo,
  recur: recurAgentInfo,
  eval: evalAgentInfo,
  apply: applyAgentInfo,
  isBoolean: isBooleanAgentInfo,
  isNumber: isNumberAgentInfo,
  isString: isStringAgentInfo,
  isArray: isArrayAgentInfo,
  isObject: isObjectAgentInfo,
  getAgentInfo: getAgentInfoAgentInfo,
  arraySize: arraySizeAgentInfo,
  arraySplitAt: arraySplitAtAgentInfo,
  arrayAgent: arrayAgentInfo,
  objectTake: objectTakeAgentInfo,
  objectAgent: objectAgentInfo,
  jsonAgent: JsonAgentInfo,
  dateAgent: dateAgentInfo,
  getProcessEnvAgent: getProcessEnvAgentInfo,
  connectAgent: connectAgentInfo,
  getMyIpAgent: getMyIpAgentInfo,
  getLocationFromIpAgent: getLocationFromIpAgentInfo,
  getWeatherFromOpenMeteoAgent: getWeatherFromOpenMeteoAgentInfo,
  getGithubIssuesAgent: getGithubIssuesAgentInfo,
  createGithubIssueAgent: createGithubIssueAgentInfo,
  editGithubIssueAgent: editGithubIssueAgentInfo,
  closeGithubIssueAgent: closeGithubIssueAgentInfo,
};
