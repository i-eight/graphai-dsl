import * as defaultAgents from '@graphai/agents';
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

export const agents: AgentFunctionInfoDictionary = {
  ...defaultAgents,
  identityAgent: identityAgentInfo,
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
  concatStringAgent: concatStringAgentInfo,
  getArrayElementAgent: getArrayElementAgentInfo,
  getObjectMemberAgent: getObjectMemberAgentInfo,
  defAgent: defAgentInfo,
  caseAgent: caseAgentInfo,
  loopAgent: loopAgentInfo,
  recurAgent: recurAgentInfo,
};
