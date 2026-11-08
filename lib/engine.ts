/** The engine facade the UI and API import. Implements EngineApi from lib/contract.ts. */

import { advise } from "./advisor";
import type { EngineApi, PieceInfo } from "./contract";
import { PIECE_TYPES } from "./contract";
import { compare } from "./finance";
import { nominalOutputTier, PIECES } from "./pieces";
import { PRESETS } from "./presets";
import { applyRecommendation, checkConnection, evaluateRules, requiredTier } from "./rules";
import { suggestions } from "./suggestions";
import { weakPoints } from "./weakpoints";

const CATALOG: PieceInfo[] = PIECE_TYPES.map((type) => {
  const d = PIECES[type];
  const info: PieceInfo = {
    type,
    name: d.name,
    group: d.group,
    description: d.description,
    outputTier: nominalOutputTier(type),
    requiredTier: requiredTier(type),
    tradeoffs: d.tradeoffs,
  };
  if (d.capexKey) info.capexKey = d.capexKey;
  if (d.omKey) info.omKey = d.omKey;
  return info;
});

export const engine: EngineApi = {
  pieceCatalog: () => CATALOG,
  presets: () => PRESETS,
  checkConnection,
  evaluateRules,
  compare,
  applyRecommendation,
  advise,
  weakPoints,
  suggestions,
};

export { DEMO_PARK_TENANTS, DEMO_STEPS, demoNext, demoStart, demoStateAt, demoTrigger } from "./demo";
export type { DemoPanel, DemoState, DemoStep, DemoStepId } from "./demo";
