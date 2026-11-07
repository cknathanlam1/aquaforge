/**
 * The ONE place the UI imports the engine from. The real engine (lib/engine.ts) has landed;
 * to fall back to a mock, point this at any object implementing EngineApi.
 */
import type { EngineApi } from "@/lib/contract";
import { engine as realEngine } from "@/lib/engine";

export const engine: EngineApi = realEngine;
export const ENGINE_IS_MOCK = false;
