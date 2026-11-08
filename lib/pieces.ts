/**
 * Piece catalog. Structure only: every number is an assumption key (lib/assumptions.ts),
 * and tier requirements live in lib/rules.ts as data.
 */

import type { AssumptionKey } from "./assumptions";
import type { EdgeKind, PaletteGroup, PieceType, Tier } from "./contract";

export type Role =
  | "source"
  | "treatment" // supply in -> supply out
  | "reuse" // wastewater in -> supply out (recycling loop, WWT)
  | "consumer" // supply in -> wastewater (+ cooling) out
  | "server" // cooling in only; goes offline without cooling
  | "storage"
  | "junction"
  | "sink"
  | "efficiency"
  | "inert";

export type SourceClass = "municipal" | "surface" | "groundwater" | "seawater" | "rain" | "reclaimed" | "recycled";

/** How a source behaves on drought days. */
export type DroughtExposure = "mandatedCut" | "groundwater" | "rain" | "none";

export type ConsumerKind = "fab" | "fabArea" | "datacenter" | "cooling" | "support";

export interface SourceSpec {
  cls: SourceClass;
  tier: Tier;
  capacityKey: AssumptionKey;
  priceKey: AssumptionKey;
  energyKey?: AssumptionKey;
  /** Merit order: lower is used first. Trucked water is 6. */
  priority: number;
  drought: DroughtExposure;
}

export interface TreatmentSpec {
  outTier: Tier;
  capacityKey: AssumptionKey;
  /** Product ÷ feed. Desal uses brineFractionKey instead (recovery = 1 − brine fraction). */
  recoveryKey?: AssumptionKey;
  brineFractionKey?: AssumptionKey;
  /** kWh per m³ of product. */
  energyKey: AssumptionKey;
  /** Non-energy variable opex, USD per m³ of product. */
  varcostKey: AssumptionKey;
  reject: "discharge" | "brine";
  /** Hit by the energy-water coupling toggle on drought days. */
  energyIntensive: boolean;
}

export interface ConsumerSpec {
  kind: ConsumerKind;
  demandKey?: AssumptionKey;
  consumptiveKey?: AssumptionKey;
  downtimeKey?: AssumptionKey;
}

export interface EfficiencySpec {
  reductionKey: AssumptionKey;
  appliesTo: "all" | "fab";
}

export interface PieceDef {
  type: PieceType;
  name: string;
  group: PaletteGroup;
  role: Role;
  description: string;
  ports: { in: EdgeKind[]; out: EdgeKind[] };
  source?: SourceSpec;
  treatment?: TreatmentSpec;
  consumer?: ConsumerSpec;
  storageVolumeKey?: AssumptionKey;
  efficiency?: EfficiencySpec;
  sinkKind?: "discharge" | "brine";
  capexKey?: AssumptionKey;
  omKey?: AssumptionKey;
  tradeoffs: string[];
}

const SUPPLY_OUT = { in: [] as EdgeKind[], out: ["supply"] as EdgeKind[] };
const PASS = { in: ["supply"] as EdgeKind[], out: ["supply"] as EdgeKind[] };
const USE = { in: ["supply"] as EdgeKind[], out: ["wastewater"] as EdgeKind[] };
const COOL = { in: ["supply"] as EdgeKind[], out: ["cooling", "wastewater"] as EdgeKind[] };
const NONE = { in: [] as EdgeKind[], out: [] as EdgeKind[] };

function source(
  type: PieceType,
  name: string,
  description: string,
  spec: SourceSpec,
  extra: Partial<PieceDef> = {},
): PieceDef {
  return { type, name, group: "src", role: "source", description, ports: SUPPLY_OUT, source: spec, tradeoffs: [], ...extra };
}

function consumer(
  type: PieceType,
  name: string,
  group: PaletteGroup,
  description: string,
  spec: ConsumerSpec,
  ports = USE,
): PieceDef {
  return { type, name, group, role: "consumer", description, ports, consumer: spec, tradeoffs: [] };
}

function inert(type: PieceType, name: string, group: PaletteGroup, description: string): PieceDef {
  return { type, name, group, role: "inert", description, ports: NONE, tradeoffs: [] };
}

const DEFS: PieceDef[] = [
  // ---------------- Water sources ----------------
  source("municipal", "Municipal supply", "Reservoir-fed city water. Reliable, but cut first in a drought.", {
    cls: "municipal", tier: 2, capacityKey: "cap.municipal", priceKey: "price.municipal", priority: 3, drought: "mandatedCut",
  }),
  source("river", "River intake", "Raw surface water. Cheap, needs filtering, drought-exposed.", {
    cls: "surface", tier: 1, capacityKey: "cap.river", priceKey: "price.river", energyKey: "energy.riverPump", priority: 3, drought: "mandatedCut",
  }, { capexKey: "capex.river", omKey: "om.river", tradeoffs: ["needs filtering", "drought-exposed"] }),
  source("well", "Groundwater well", "Raw groundwater. Small, steady backup supply.", {
    cls: "groundwater", tier: 1, capacityKey: "cap.groundwater", priceKey: "price.groundwater", energyKey: "energy.groundwaterPump", priority: 4, drought: "groundwater",
  }, { capexKey: "capex.groundwater", omKey: "om.groundwater", tradeoffs: ["needs filtering", "+ pumping energy"] }),
  source("rain", "Rainwater harvesting", "Free but small, and scarce exactly when you need it.", {
    cls: "rain", tier: 1, capacityKey: "cap.rain", priceKey: "price.rain", priority: 1, drought: "rain",
  }, { capexKey: "capex.rain", omKey: "om.rain", tradeoffs: ["small yield", "dries up in drought"] }),
  source("seawater", "Seawater intake", "Unlimited, drought-proof raw water for a desal plant.", {
    cls: "seawater", tier: 1, capacityKey: "cap.seawater", priceKey: "price.seawater", energyKey: "energy.seawaterPump", priority: 5, drought: "none",
  }, { capexKey: "capex.seawater", omKey: "om.seawater", tradeoffs: ["only useful with desal", "+ pumping energy"] }),
  {
    type: "desal", name: "Desalination plant", group: "src", role: "treatment",
    description: "Strips dissolved salts: Tier 4 water from seawater or any raw source. Drought-proof with a seawater intake.",
    ports: { in: ["supply"], out: ["supply", "brine"] },
    treatment: {
      outTier: 4, capacityKey: "cap.desal", brineFractionKey: "desal.brineFraction", energyKey: "energy.desal",
      varcostKey: "varcost.desal", reject: "brine", energyIntensive: true,
    },
    capexKey: "capex.desal", omKey: "om.desal",
    tradeoffs: ["+ big energy use", "needs brine disposal"],
  },
  {
    type: "harmony", name: "Harmony desalination", group: "src", role: "treatment",
    description: "Batch reverse osmosis: less energy and less brine than regular desal, but it stops at Tier 3 (process-grade). Right for cooling, not for chips.",
    ports: { in: ["supply"], out: ["supply", "brine"] },
    treatment: {
      outTier: 3, capacityKey: "cap.harmony", brineFractionKey: "harmony.brineFraction", energyKey: "harmony.energy",
      varcostKey: "varcost.harmony", reject: "brine", energyIntensive: true,
    },
    capexKey: "capex.harmony", omKey: "om.harmony",
    tradeoffs: ["only reaches Tier 3", "needs brine disposal", "pilot-scale today"],
  },
  source("nearby", "Nearby plant (shared)", "A neighbor's reclaimed-water plant: Tier 3, a second supplier.", {
    cls: "reclaimed", tier: 3, capacityKey: "cap.reclaimed", priceKey: "price.reclaimed", priority: 2, drought: "none",
  }, { group: "src", capexKey: "capex.reclaimed", omKey: "om.reclaimed", tradeoffs: ["shared contract", "Tier 3 only"] }),

  // ---------------- Treatment ----------------
  {
    type: "filter", name: "Basic filter", group: "trt", role: "treatment",
    description: "Removes sediment: raw water to Tier 2.", ports: PASS,
    treatment: { outTier: 2, capacityKey: "cap.filter", recoveryKey: "recovery.filter", energyKey: "energy.filter", varcostKey: "varcost.filter", reject: "discharge", energyIntensive: false },
    capexKey: "capex.filter", omKey: "om.filter", tradeoffs: ["only reaches Tier 2"],
  },
  {
    type: "softener", name: "Softener", group: "trt", role: "treatment",
    description: "Removes hardness: Tier 2, protects cooling equipment from scale.", ports: PASS,
    treatment: { outTier: 2, capacityKey: "cap.softener", recoveryKey: "recovery.softener", energyKey: "energy.softener", varcostKey: "varcost.softener", reject: "discharge", energyIntensive: false },
    capexKey: "capex.softener", omKey: "om.softener", tradeoffs: ["only reaches Tier 2", "salt costs"],
  },
  {
    type: "ro", name: "RO unit", group: "trt", role: "treatment",
    description: "Reverse osmosis: filtered fresh water to Tier 4.", ports: PASS,
    treatment: { outTier: 4, capacityKey: "cap.ro", recoveryKey: "recovery.ro", energyKey: "energy.ro", varcostKey: "varcost.ro", reject: "discharge", energyIntensive: false },
    capexKey: "capex.ro", omKey: "om.ro", tradeoffs: ["rejects ~25% as concentrate", "+ energy"],
  },
  {
    type: "wwt", name: "Wastewater treatment", group: "trt", role: "reuse",
    description: "Treats used water to Tier 3 for reuse.", ports: { in: ["wastewater"], out: ["supply"] },
    treatment: { outTier: 3, capacityKey: "cap.wwt", recoveryKey: "recovery.wwt", energyKey: "energy.wwt", varcostKey: "varcost.wwt", reject: "discharge", energyIntensive: true },
    capexKey: "capex.wwt", omKey: "om.wwt", tradeoffs: ["+ energy", "Tier 3 only"],
  },
  {
    type: "recycle", name: "Recycling loop", group: "trt", role: "reuse",
    description: "Re-treats process wastewater to Tier 3 so you can use it again.", ports: { in: ["wastewater"], out: ["supply"] },
    treatment: { outTier: 3, capacityKey: "cap.recycle", recoveryKey: "recovery.recycle", energyKey: "energy.recycle", varcostKey: "varcost.recycle", reject: "discharge", energyIntensive: true },
    capexKey: "capex.recycle", omKey: "om.recycle", tradeoffs: ["+ energy", "needs RO + polishing before the fab"],
  },
  {
    type: "polish", name: "Ultrapure polishing (EDI+UV)", group: "trt", role: "treatment",
    description: "Finishing step: Tier 4 to Tier 5 ultrapure.", ports: PASS,
    treatment: { outTier: 5, capacityKey: "cap.polish", recoveryKey: "recovery.polish", energyKey: "energy.polish", varcostKey: "varcost.polish", reject: "discharge", energyIntensive: false },
    capexKey: "capex.polish", omKey: "om.polish", tradeoffs: ["needs Tier 4 feed"],
  },
  {
    type: "brine", name: "Brine disposal", group: "trt", role: "sink", sinkKind: "brine",
    description: "Takes the salty leftovers from a desal plant.", ports: { in: ["brine"], out: [] },
    capexKey: "capex.brine", omKey: "om.brine", tradeoffs: [],
  },

  // ---------------- Semiconductor fab ----------------
  consumer("fab", "Fab building", "fab", "Whole fab: needs ultrapure Tier 5 water.", { kind: "fab", demandKey: "demand.fab", consumptiveKey: "consumptive.fab", downtimeKey: "downtime.fab" }),
  consumer("clean", "Cleanroom wing", "fab", "Humidification and rinse: Tier 5.", { kind: "fabArea", demandKey: "demand.fabCleanroom", consumptiveKey: "consumptive.fab", downtimeKey: "downtime.fabArea" }),
  consumer("wet", "Wet process bay", "fab", "Wafer rinsing and wet etch: Tier 5.", { kind: "fabArea", demandKey: "demand.fabWet", consumptiveKey: "consumptive.fab", downtimeKey: "downtime.fabArea" }),
  consumer("cmp", "CMP / polishing bay", "fab", "Chemical-mechanical planarization: Tier 5.", { kind: "fabArea", demandKey: "demand.fabCmp", consumptiveKey: "consumptive.fab", downtimeKey: "downtime.fabArea" }),
  {
    type: "upw", name: "UPW plant", group: "fab", role: "treatment",
    description: "The fab's ultrapure water plant: Tier 4 in, Tier 5 out.", ports: PASS,
    treatment: { outTier: 5, capacityKey: "cap.polish", recoveryKey: "recovery.polish", energyKey: "energy.polish", varcostKey: "varcost.polish", reject: "discharge", energyIntensive: false },
    capexKey: "capex.polish", omKey: "om.polish", tradeoffs: ["needs Tier 4 feed"],
  },
  inert("chem", "Chemical storage", "fab", "No water connection."),

  // ---------------- Data center campus ----------------
  consumer("datacenter", "Data center campus", "dc", "Hyperscale campus: cooling makeup needs process-grade (Tier 3) water.", { kind: "datacenter", demandKey: "demand.datacenter", consumptiveKey: "consumptive.datacenter", downtimeKey: "downtime.datacenter" }),
  { type: "server", name: "Server hall", group: "dc", role: "server", description: "Needs cooling, not water. Offline without a working cooling piece.", ports: { in: ["cooling"], out: [] }, consumer: { kind: "datacenter", downtimeKey: "downtime.datacenter" }, tradeoffs: [] },
  { type: "server2", name: "Server hall XL", group: "dc", role: "server", description: "Bigger hall, bigger downtime cost.", ports: { in: ["cooling"], out: [] }, consumer: { kind: "datacenter", downtimeKey: "downtime.datacenterXL" }, tradeoffs: [] },
  consumer("tower", "Cooling tower", "dc", "Evaporative tower makeup: Tier 2+.", { kind: "cooling", demandKey: "demand.coolingTower", consumptiveKey: "consumptive.coolingTower" }, COOL),
  consumer("chiller", "Chiller plant", "dc", "Chiller makeup: Tier 2+.", { kind: "cooling", demandKey: "demand.chiller", consumptiveKey: "consumptive.chiller" }, COOL),
  consumer("evap", "Evaporative cooling", "dc", "Thirsty in a drought: Tier 2+.", { kind: "cooling", demandKey: "demand.evap", consumptiveKey: "consumptive.evap" }, COOL),
  consumer("closed", "Closed-loop liquid cooling", "dc", "Sealed loop, small makeup: Tier 3+.", { kind: "cooling", demandKey: "demand.dcLiquid", consumptiveKey: "consumptive.dcLiquid" }, COOL),
  {
    type: "tank", name: "Water storage tank", group: "dc", role: "storage",
    description: "Buffer that rides through short outages.", ports: PASS, storageVolumeKey: "storage.volume",
    capexKey: "capex.storage", omKey: "om.storage", tradeoffs: ["no savings in a normal year"],
  },
  inert("gen", "Backup generator yard", "dc", "No water connection."),
  inert("ups", "Battery / UPS room", "dc", "No water connection."),
  inert("sub", "Electrical substation", "dc", "No water connection."),
  inert("net", "Network / telecom room", "dc", "No water connection."),
  consumer("fire", "Fire suppression tank", "dc", "Standby makeup: Tier 2+.", { kind: "support", demandKey: "demand.fire", consumptiveKey: "consumptive.fire" }),
  consumer("gate", "Security gatehouse", "dc", "Potable use: Tier 2+.", { kind: "support", demandKey: "demand.gate", consumptiveKey: "consumptive.gate", downtimeKey: "downtime.support" }),
  consumer("office", "Office / ops center", "dc", "Potable use: Tier 2+.", { kind: "support", demandKey: "demand.office", consumptiveKey: "consumptive.office", downtimeKey: "downtime.support" }),

  // ---------------- Efficiency (site-wide, no pipes) ----------------
  { type: "leak", name: "Leak detection sensors", group: "eff", role: "efficiency", description: "Find leaks in hours, not months.", ports: NONE, efficiency: { reductionKey: "eff.leak", appliesTo: "all" }, capexKey: "capex.leak", omKey: "om.leak", tradeoffs: ["sensor upkeep"] },
  { type: "meter", name: "Smart meters", group: "eff", role: "efficiency", description: "See where water goes.", ports: NONE, efficiency: { reductionKey: "eff.meter", appliesTo: "all" }, capexKey: "capex.meter", omKey: "om.meter", tradeoffs: ["small effect alone"] },
  { type: "opt", name: "Process optimization", group: "eff", role: "efficiency", description: "Tighter rinse recipes in the fab.", ports: NONE, efficiency: { reductionKey: "eff.opt", appliesTo: "fab" }, capexKey: "capex.opt", omKey: "om.opt", tradeoffs: ["process requalification"] },

  // ---------------- Connectors ----------------
  { type: "valve", name: "Valve", group: "con", role: "junction", description: "Joins or splits pipes.", ports: PASS, tradeoffs: [] },
  { type: "pump", name: "Pump", group: "con", role: "junction", description: "Joins or splits pipes.", ports: PASS, tradeoffs: [] },
  { type: "discharge", name: "Discharge outfall", group: "con", role: "sink", sinkKind: "discharge", description: "Sends used water to the sewer.", ports: { in: ["wastewater"], out: [] }, tradeoffs: [] },

  // ---------------- Neighbors ----------------
  consumer("neighbor_fab", "Neighbor fab", "nbr", "Another company's fab in the park: Tier 5.", { kind: "fab", demandKey: "demand.neighborFab", consumptiveKey: "consumptive.fab", downtimeKey: "downtime.fab" }),
  consumer("neighbor_dc", "Neighbor data center", "nbr", "Another company's data center: Tier 2 cooling.", { kind: "datacenter", demandKey: "demand.neighborDc", consumptiveKey: "consumptive.coolingTower", downtimeKey: "downtime.datacenter" }),
];

export const PIECES: Readonly<Record<PieceType, PieceDef>> = Object.freeze(
  Object.fromEntries(DEFS.map((d) => [d.type, d])) as Record<PieceType, PieceDef>,
);

export function pieceDef(type: PieceType): PieceDef {
  const def = PIECES[type];
  if (!def) throw new Error(`Unknown piece type: ${type}`);
  return def;
}

/** Tier a piece outputs as supply, ignoring its inputs (null = no supply output). */
export function nominalOutputTier(type: PieceType): Tier | null {
  const def = PIECES[type];
  if (def.source) return def.source.tier;
  if (def.treatment) return def.treatment.outTier;
  return null;
}
