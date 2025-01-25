import { AgentFunctionInfoDictionary, GraphAI, GraphData } from 'graphai';
import { Json } from './compiler';

export const runFromJson = async (json: Json, agents: AgentFunctionInfoDictionary) =>
  new GraphAI(json as GraphData, agents).run();
