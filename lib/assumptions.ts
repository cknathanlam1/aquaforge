/**
 * ALL engine constants live here. Every entry carries a unit, a source note and a status:
 *   - "sourced":      secondary-source figure from the Taiwan case study. Verify before presenting.
 *   - "illustrative": placeholder. Editable. Replace with site data.
 * Nothing outside this file should hard-code a number that changes a dollar or m³ result.
 */

export type AssumptionStatus = "sourced" | "illustrative";

export const STATUS_LABEL: Record<AssumptionStatus, string> = {
  sourced: "sourced, secondary, verify before presenting",
  illustrative: "illustrative, replace with site data",
};

export type AssumptionGroup =
  | "Currency & units"
  | "Water prices"
  | "Policy"
  | "Energy"
  | "Treatment performance"
  | "Capacity"
  | "Capex"
  | "O&M"
  | "Demand"
  | "Downtime"
  | "Drought response"
  | "Scenarios"
  | "Disruption risk"
  | "Energy-water coupling"
  | "Finance";

export interface Assumption {
  value: number;
  unit: string;
  label: string;
  group: AssumptionGroup;
  status: AssumptionStatus;
  source: string;
  note?: string;
}

const ILL = "Illustrative placeholder, editable. Replace with site data.";

function ill(value: number, unit: string, label: string, group: AssumptionGroup, note?: string): Assumption {
  return { value, unit, label, group, status: "illustrative", source: ILL, note };
}

function src(value: number, unit: string, label: string, group: AssumptionGroup, source: string, note?: string): Assumption {
  return { value, unit, label, group, status: "sourced", source, note };
}

export const DEFAULT_ASSUMPTIONS = {
  // ---------- Currency & units ----------
  "fx.twdPerUsd": src(
    32,
    "NT$/USD",
    "Exchange rate",
    "Currency & units",
    "TrendForce/Wise: 2026 mid-market range 31.77-32.63 (https://datatrack.trendforce.com/Chart/content/1012/taiwan-ntdusd)",
  ),

  // ---------- Water prices (USD per m³) ----------
  "price.municipal": src(
    0.38,
    "USD/m³",
    "Reservoir / municipal water tariff",
    "Water prices",
    "Taiwan Water Corp top tier NT$12.075/m3 (Taiwan News 2024); WRA 2021 avg NT$9.24/t (AmCham 2023) (https://www.taiwannews.com.tw/news/6060912)",
  ),
  "price.groundwater": ill(0.1, "USD/m³", "Groundwater extraction fee", "Water prices"),
  "price.seawater": ill(0, "USD/m³", "Seawater intake fee", "Water prices"),
  "price.river": ill(0.05, "USD/m³", "River abstraction fee", "Water prices"),
  "price.rain": ill(0, "USD/m³", "Rainwater (no fee)", "Water prices"),
  "price.reclaimed": src(
    0.7,
    "USD/m³",
    "Neighbor reclaimed-water price",
    "Water prices",
    "Reclaimed water cost NT$18.8-30.9/t excl. construction; Fengshan O&M NT$11.5/m3 (Sustainable Environment Research, 2023). Cost proxy; contract prices not public. (https://sustainenvironres.biomedcentral.com/articles/10.1186/s42834-023-00177-8)",
  ),
  "price.discharge": src(
    0.48,
    "USD/m³",
    "Sewer / discharge fee",
    "Water prices",
    "Taichung Tanzi Technology Industrial Park sewer fee NT$15.42/m3 (2024 regulation). Single park only. (https://www.laws.taipei.gov.tw/lawatt/Law/A040100071005100-20240221-3000-004.pdf)",
  ),
  "price.brine": ill(0.05, "USD/m³", "Brine disposal fee", "Water prices"),
  "price.electricity": src(
    0.134,
    "USD/kWh",
    "Electricity price",
    "Energy",
    "Taipower industrial avg ~NT$4.29/kWh after +12.5% (16 Oct 2024), Taipei Times 1 Oct 2024; rates frozen through 2026 (https://www.taipeitimes.com/News/front/archives/2024/10/01/2003824615)",
  ),

  // ---------- Policy ----------
  "policy.surchargeThreshold": src(
    9000,
    "m³/month per user",
    "Water consumption fee threshold",
    "Policy",
    "Taiwan MOEA dry-season water consumption fee (耗水費), national, not park-specific (Focus Taiwan, 6 Jan 2023: https://focustaiwan.tw/business/202301060016)",
  ),
  "policy.surchargeSeasonDays": src(
    181,
    "days/yr",
    "Days per year the fee applies (Nov–Apr)",
    "Policy",
    "The MOEA fee applies only in the dry season, November to April (Focus Taiwan, 6 Jan 2023: https://focustaiwan.tw/business/202301060016)",
  ),
  "policy.surchargeRate": src(
    0.094,
    "USD/m³",
    "Water consumption fee above threshold",
    "Policy",
    "NT$3/m3, reduced to NT$2/NT$1 for recycling benchmarks; halved through 2025, full from 2026 (UDN 2026). Applies Nov-Apr only. (https://udn.com/news/story/7238/9579443)",
  ),

  // ---------- Energy (kWh per m³ of product water) ----------
  "energy.filter": ill(0.05, "kWh/m³", "Basic filter energy", "Energy"),
  "energy.process": ill(0.2, "kWh/m³", "Process treatment (UF) energy", "Energy"),
  "energy.ro": src(
    0.9,
    "kWh/m³",
    "RO unit energy",
    "Energy",
    "RO on tap/groundwater feed 0.83-1.20 kWh/m3 (Sustainable Environment Research 2022, Table 3) (https://sustainenvironres.biomedcentral.com/articles/10.1186/s42834-022-00145-8)",
  ),
  "energy.desal": src(
    3.5,
    "kWh/m³",
    "Desal (SWRO) energy",
    "Energy",
    "Full-plant SWRO 3.5-4.5 kWh/m3 (Canary Islands study, Water 16:910, 2024) (https://accedacris.ulpgc.es/bitstream/10553/129736/1/water-16-00910.pdf)",
  ),
  "energy.polish": src(
    0.5,
    "kWh/m³",
    "UPW polishing (EDI/UV) energy",
    "Energy",
    "EDI 0.35-0.66 kWh/m3 (OSTI resin-wafer EDI) plus UV; low confidence (https://www.osti.gov/biblio/1638484)",
  ),
  "energy.recycle": ill(1.2, "kWh/m³", "Recycling plant energy", "Energy"),
  "energy.groundwaterPump": ill(0.4, "kWh/m³", "Groundwater pumping energy", "Energy"),
  "energy.seawaterPump": ill(0.3, "kWh/m³", "Seawater intake pumping energy", "Energy"),
  "energy.riverPump": ill(0.1, "kWh/m³", "River intake pumping energy", "Energy"),
  "energy.softener": ill(0.1, "kWh/m³", "Softener energy", "Energy"),
  "energy.wwt": ill(0.8, "kWh/m³", "Wastewater treatment energy", "Energy"),
  "recovery.softener": ill(0.97, "fraction", "Softener recovery", "Treatment performance"),
  "recovery.wwt": ill(0.6, "fraction", "Wastewater treatment recovery", "Treatment performance"),
  "varcost.softener": ill(0.03, "USD/m³", "Softener salt & resin", "Treatment performance"),
  "varcost.wwt": ill(0.1, "USD/m³", "Wastewater treatment chemicals", "Treatment performance"),
  "cap.river": ill(30000, "m³/day", "River intake capacity", "Capacity"),
  "cap.rain": ill(300, "m³/day", "Rainwater harvesting yield (average)", "Capacity"),
  "cap.softener": ill(30000, "m³/day", "Softener capacity", "Capacity"),
  "cap.wwt": ill(15000, "m³/day", "Wastewater treatment capacity", "Capacity"),
  "rain.droughtAvail": ill(0.2, "fraction", "Rainwater yield on drought days", "Scenarios"),

  // ---------- Treatment performance ----------
  "recovery.filter": ill(0.98, "fraction", "Basic filter recovery", "Treatment performance"),
  "recovery.process": ill(0.95, "fraction", "Process treatment recovery", "Treatment performance"),
  "recovery.ro": src(
    0.75,
    "fraction",
    "RO recovery",
    "Treatment performance",
    "Conventional 2-stage RO ~75%; high-recovery semicon systems up to 96% (Gradiant) (https://gradiant.com/success-stories/one-integrated-platform-zero-discharge-indias-first-semiconductor-fab/)",
  ),
  "recovery.polish": ill(0.95, "fraction", "UPW polishing recovery", "Treatment performance"),
  "recovery.recycle": src(
    0.7,
    "fraction",
    "Recycling plant recovery",
    "Treatment performance",
    "TSMC recycled ~87% of manufacturing water in 2019 (Fortune); single-plant recovery up to 96% (Gradiant). 0.7 is a mid-plant default. (https://fortune.com/2021/06/12/chip-shortage-taiwan-drought-tsmc-water-usage/)", "Context: TSMC reports reusing each drop about 3.5 times (Fortune, 2021).",
  ),
  "desal.brineFraction": src(
    0.55,
    "fraction of feed",
    "Desal brine volume fraction",
    "Treatment performance",
    "SWRO recovery ~40-50% => brine 50-60% of feed (https://accedacris.ulpgc.es/bitstream/10553/129736/1/water-16-00910.pdf)",
  ),
  "varcost.filter": ill(0.01, "USD/m³", "Filter chemicals & media", "Treatment performance"),
  "varcost.process": ill(0.02, "USD/m³", "Process treatment chemicals", "Treatment performance"),
  "varcost.ro": ill(0.05, "USD/m³", "RO chemicals & membranes", "Treatment performance"),
  "varcost.desal": ill(0.53, "USD/m³", "Desal non-energy operating cost", "Treatment performance", "Default chosen so desal's all-in operating cost (energy + this) equals the US$1/t anchor at the default electricity price."),
  "varcost.polish": ill(0.1, "USD/m³", "Polishing resins & UV lamps", "Treatment performance"),
  "varcost.recycle": src(
    0.15,
    "USD/m³",
    "Recycling chemicals & membranes",
    "Treatment performance",
    "Singapore PUB wafer-fab guide: total recycling opex US$0.20-1.40/m3 incl. energy; low confidence (https://info.pub.gov.sg/Documents/Water_Efficiency_Wafer_Fabrication_Semiconductor_v2.pdf)",
  ),
  "desal.costAnchor": src(
    1,
    "USD/t",
    "Desalinated water cost anchor",
    "Treatment performance",
    "Al Jazeera, E. Hale, 20 Aug 2021: 'about $1 per tonne' (verified on page) (https://www.aljazeera.com/news/2021/8/20/taiwan-water-woes)", "Reference only. Desal cost in the engine is energy + non-energy opex, which defaults to this anchor.",
  ),

  // ---------- Capacity (m³/day of product) ----------
  "cap.municipal": ill(200000, "m³/day", "Municipal allocation available to the site", "Capacity"),
  "cap.groundwater": ill(5000, "m³/day", "Groundwater well capacity", "Capacity"),
  "cap.seawater": ill(100000, "m³/day", "Seawater intake capacity", "Capacity", "Sized to feed two 13,000 m³/day desal units (desal feed = product ÷ recovery)."),
  "cap.reclaimed": ill(15000, "m³/day", "Neighbor reclaimed-water supply", "Capacity"),
  "cap.filter": ill(40000, "m³/day", "Basic filter capacity", "Capacity"),
  "cap.process": ill(30000, "m³/day", "Process treatment capacity", "Capacity"),
  "cap.ro": ill(35000, "m³/day", "RO unit capacity", "Capacity"),
  "cap.desal": src(
    13000,
    "m³/day",
    "Desal plant capacity",
    "Capacity",
    "WRA: emergency Hsinchu desal unit 13,000 t/day (2021); 100,000 m3/day plant due ~2028 (https://www.wra.gov.tw/wrapen/cp.aspx?n=44729)",
  ),
  "cap.polish": ill(30000, "m³/day", "UPW polishing capacity", "Capacity"),
  "cap.recycle": src(
    20000,
    "m³/day",
    "Recycling plant capacity",
    "Capacity",
    "CTCI: TSMC STSP reclamation plant started 19 Sep 2022 at 5,000 t/day, 20,000 a year later, 30,000 by 2026 (https://technode.global/prnasia/ctci-helps-top-chipmaker-tsmc-save-water-with-the-industrys-first-industrial-wastewater-reclamation-plant-for-chip-use/)",
  ),
  "storage.volume": ill(20000, "m³", "Storage tank volume", "Capacity"),

  // ---------- Capex (USD) ----------
  "capex.filter": ill(2_000_000, "USD", "Basic filter capex", "Capex"),
  "capex.process": ill(4_000_000, "USD", "Process treatment capex", "Capex"),
  "capex.ro": ill(12_000_000, "USD", "RO unit capex", "Capex"),
  "capex.desal": src(
    40000000,
    "USD",
    "Desal plant capex",
    "Capex",
    "Range: US$1,500 per m3/day (small-plant low end) to ~US$5,400 per m3/day (Hsinchu NT$17.7B / 100,000 m3/day contract incl. O&M); 40M = ~US$3,080 per m3/day (https://www.taiwannews.com.tw/en/news/5895709)",
  ),
  "capex.polish": src(
    15000000,
    "USD",
    "UPW polishing capex",
    "Capex",
    "Veolia: complete fab UPW system US$25-40M; polishing is a share. Low confidence. (https://www.middle-east.veoliawatertechnologies.com/sites/g/files/dvc3051/files/document/2021/07/190432_VWT_SEA_Microelectronics_Industry_Brochure_LR.pdf)",
  ),
  "capex.recycle": ill(25_000_000, "USD", "Recycling plant capex", "Capex"),
  "capex.storage": ill(3_000_000, "USD", "Storage tank capex", "Capex"),
  "capex.brine": ill(5_000_000, "USD", "Brine outfall capex", "Capex"),
  "capex.seawater": ill(8_000_000, "USD", "Seawater intake capex", "Capex"),
  "capex.groundwater": ill(1_500_000, "USD", "Groundwater well capex", "Capex"),
  "capex.reclaimed": ill(1_000_000, "USD", "Reclaimed-water connection capex", "Capex"),
  "capex.river": ill(2_000_000, "USD", "River intake capex", "Capex"),
  "capex.rain": ill(400_000, "USD", "Rainwater harvesting capex", "Capex"),
  "capex.softener": ill(1_500_000, "USD", "Softener capex", "Capex"),
  "capex.wwt": ill(10_000_000, "USD", "Wastewater treatment capex", "Capex"),
  "capex.leak": ill(220_000, "USD", "Leak detection sensors capex", "Capex"),
  "capex.meter": ill(90_000, "USD", "Smart meters capex", "Capex"),
  "capex.opt": ill(300_000, "USD", "Process optimization capex", "Capex"),

  // ---------- O&M (USD per year, fixed) ----------
  "om.filter": ill(150_000, "USD/yr", "Basic filter O&M", "O&M"),
  "om.process": ill(300_000, "USD/yr", "Process treatment O&M", "O&M"),
  "om.ro": ill(800_000, "USD/yr", "RO unit O&M", "O&M"),
  "om.desal": ill(1_500_000, "USD/yr", "Desal plant O&M", "O&M"),
  "om.polish": ill(1_000_000, "USD/yr", "UPW polishing O&M", "O&M"),
  "om.recycle": ill(1_200_000, "USD/yr", "Recycling plant O&M", "O&M"),
  "om.storage": ill(50_000, "USD/yr", "Storage tank O&M", "O&M"),
  "om.brine": ill(200_000, "USD/yr", "Brine outfall O&M", "O&M"),
  "om.seawater": ill(300_000, "USD/yr", "Seawater intake O&M", "O&M"),
  "om.groundwater": ill(100_000, "USD/yr", "Groundwater well O&M", "O&M"),
  "om.reclaimed": ill(50_000, "USD/yr", "Reclaimed connection O&M", "O&M"),
  "om.river": ill(100_000, "USD/yr", "River intake O&M", "O&M"),
  "om.rain": ill(20_000, "USD/yr", "Rainwater harvesting O&M", "O&M"),
  "om.softener": ill(100_000, "USD/yr", "Softener O&M", "O&M"),
  "om.wwt": ill(600_000, "USD/yr", "Wastewater treatment O&M", "O&M"),
  "om.leak": ill(25_000, "USD/yr", "Leak sensors O&M", "O&M"),
  "om.meter": ill(10_000, "USD/yr", "Smart meters O&M", "O&M"),
  "om.opt": ill(30_000, "USD/yr", "Process optimization O&M", "O&M"),

  // ---------- Efficiency (site-wide demand reductions while the piece is on the board) ----------
  "eff.leak": ill(0.05, "fraction", "Leak sensors: demand cut, all consumers", "Demand"),
  "eff.meter": ill(0.02, "fraction", "Smart meters: demand cut, all consumers", "Demand"),
  "eff.opt": ill(0.1, "fraction", "Process optimization: demand cut, fab areas", "Demand"),

  // ---------- Demand (m³/day delivered) ----------
  "demand.fab": src(
    20000,
    "m³/day",
    "Semiconductor fab demand",
    "Demand",
    "Fortune citing China Water Risk, 12 Jun 2021 (verified); TSMC STSP site up to 99,000 t/day (https://fortune.com/2021/06/12/chip-shortage-taiwan-drought-tsmc-water-usage/)",
  ),
  "demand.fabWet": ill(8000, "m³/day", "Wet process bay demand", "Demand"),
  "demand.fabCmp": ill(3000, "m³/day", "CMP bay demand", "Demand"),
  "demand.fabCleanroom": ill(1000, "m³/day", "Cleanroom demand", "Demand"),
  "demand.coolingTower": ill(4000, "m³/day", "Cooling tower makeup", "Demand"),
  "demand.office": ill(150, "m³/day", "Office demand", "Demand"),
  "demand.fire": ill(20, "m³/day", "Fire suppression standby", "Demand"),
  "demand.evap": ill(3500, "m³/day", "Evaporative cooling demand", "Demand"),
  "demand.gate": ill(5, "m³/day", "Security gatehouse demand", "Demand"),
  "demand.dcLiquid": ill(400, "m³/day", "Closed-loop liquid cooling makeup", "Demand"),
  "demand.chiller": ill(800, "m³/day", "Chiller makeup", "Demand"),
  "demand.neighborFab": ill(20000, "m³/day", "Neighbor fab demand", "Demand", "Defaults to the single-fab figure."),
  "demand.neighborDc": ill(3000, "m³/day", "Neighbor data center demand", "Demand"),

  "consumptive.fab": ill(0.2, "fraction", "Fab consumptive (evaporated/embedded) share", "Demand"),
  "consumptive.coolingTower": ill(0.75, "fraction", "Cooling tower consumptive share", "Demand"),
  "consumptive.office": ill(0.1, "fraction", "Office consumptive share", "Demand"),
  "consumptive.fire": ill(0, "fraction", "Fire suppression consumptive share", "Demand"),
  "consumptive.evap": ill(0.85, "fraction", "Evaporative cooling consumptive share", "Demand"),
  "consumptive.gate": ill(0.1, "fraction", "Gatehouse consumptive share", "Demand"),
  "consumptive.dcLiquid": ill(0.1, "fraction", "Liquid cooling consumptive share", "Demand"),
  "consumptive.chiller": ill(0.7, "fraction", "Chiller consumptive share", "Demand"),

  // ---------- Downtime ----------
  "downtime.fab": src(
    1000000,
    "USD/hour",
    "Fab downtime cost",
    "Downtime",
    "Schneider Electric 2026: >US$1-2M/hour for advanced fabs; TSMC 2018 virus ~NT$2.6B booked Q3 2018 for ~3 days (~US$1.2M/h, TSMC 2018 Annual Report p.230) (https://blog.se.com/energy-management-energy-efficiency/2026/07/30/why-is-power-quality-so-critical-in-semiconductor-fabs/)",
  ),
  "downtime.datacenter": src(
    300000,
    "USD/hour",
    "Data center downtime cost",
    "Downtime",
    "Ponemon 2016: US$8,851/min (~US$531k/h) average; Uptime 2024: 54% of last major outages >US$100k, 20% >US$1M (https://statista.com/statistics/666816/united-states-data-centers-unplanned-outage-cost-per-minute)",
  ),
  "downtime.support": ill(5_000, "USD/hour", "Support building downtime cost", "Downtime"),
  "downtime.fabArea": ill(300000, "USD/hour", "Fab sub-area (wet, CMP, cleanroom) downtime cost", "Downtime"),
  "downtime.datacenterXL": ill(600000, "USD/hour", "Server hall XL downtime cost", "Downtime"),

  // ---------- Drought response ----------
  "truck.capacity": src(
    20,
    "m³/tanker",
    "Tanker truck capacity",
    "Drought response",
    "DVHardware 19 Mar 2021; Wccftech 24 Feb 2021; Bloomberg Opinion: ~20 t per delivery (https://www.dvhardware.net/article74998.html)",
  ),
  "truck.tripCost": src(
    1000,
    "USD/trip",
    "Trucked water cost per tanker trip",
    "Drought response",
    "Wccftech citing Liberty Times, 24 Feb 2021: 20 t tanker at $1,000/truck (NT$30,000). Single secondary source. (https://wccftech.com/tsmc-using-water-tankers-for-chip-production-as-5nm-plant-faces-rationing/)",
  ),
  "truck.maxPerDay": ill(200, "tankers/day", "Max tankers the site can receive per day", "Drought response"),

  // ---------- Scenarios ----------
  "scenario.normal.priceMultiplier": ill(1, "×", "Normal year: price multiplier", "Scenarios"),
  "scenario.normal.droughtDays": ill(0, "days/yr", "Normal year: drought days", "Scenarios"),
  "scenario.normal.cut": ill(0, "fraction", "Normal year: mandated cut", "Scenarios"),
  "scenario.normal.groundwaterAvail": ill(1, "fraction", "Normal year: groundwater availability", "Scenarios"),

  "scenario.drought2021.priceMultiplier": ill(1, "×", "2021-type drought: price multiplier", "Scenarios"),
  "scenario.drought2021.droughtDays": src(
    125,
    "days/yr",
    "2021-type drought: days under mandated cuts",
    "Scenarios",
    "Hsinchu industrial cuts in force by 24 Feb 2021 (Wccftech), lifted 30 Jun-1 Jul 2021 (Taipei Times) (https://taipeitimes.com/News/biz/archives/2021/07/01/2003760077)",
  ),
  "scenario.drought2021.cut": src(
    0.11,
    "fraction",
    "2021-type drought: mandated industrial cut",
    "Scenarios",
    "Wccftech 24 Feb 2021: Hsinchu industrial cut 11% after an earlier 6% (https://wccftech.com/tsmc-using-water-tankers-for-chip-production-as-5nm-plant-faces-rationing/)",
  ),
  "scenario.drought2021.cutEscalated": src(
    0.15,
    "fraction",
    "2021-type drought: escalated cut",
    "Scenarios",
    "Taipei Times 1 Jun 2021: 15% industrial cut in Hsinchu under orange alert; 17% planned then postponed (https://www.taipeitimes.com/News/front/archives/2021/06/01/2003758391)",
  ),
  "scenario.drought2021.groundwaterAvail": ill(0.9, "fraction", "2021-type drought: groundwater availability", "Scenarios"),

  "scenario.stress2035.priceMultiplier": ill(1.3, "×", "2035 stress: price multiplier", "Scenarios"),
  "scenario.stress2035.droughtDays": ill(60, "days/yr", "2035 stress: drought days", "Scenarios"),
  "scenario.stress2035.cut": ill(0.1, "fraction", "2035 stress: mandated cut", "Scenarios"),
  "scenario.stress2035.groundwaterAvail": ill(0.9, "fraction", "2035 stress: groundwater availability", "Scenarios"),

  "scenario.stress2050.priceMultiplier": ill(1.7, "×", "2050 stress: price multiplier", "Scenarios"),
  "scenario.stress2050.droughtDays": ill(150, "days/yr", "2050 stress: drought days", "Scenarios"),
  "scenario.stress2050.cut": ill(0.2, "fraction", "2050 stress: mandated cut", "Scenarios"),
  "scenario.stress2050.groundwaterAvail": ill(0.8, "fraction", "2050 stress: groundwater availability", "Scenarios"),

  // ---------- Disruption risk (annual probability of an acute outage, and its length) ----------
  "risk.hours.municipal": ill(48, "hours", "Reservoir/municipal outage length", "Disruption risk"),
  "risk.hours.groundwater": ill(72, "hours", "Groundwater outage length", "Disruption risk"),
  "risk.hours.seawater": ill(24, "hours", "Seawater intake outage length", "Disruption risk"),
  "risk.hours.recycled": ill(24, "hours", "Recycling plant outage length", "Disruption risk"),
  "risk.hours.reclaimed": ill(24, "hours", "Reclaimed supply outage length", "Disruption risk"),

  "risk.p.municipal.normal": ill(0.05, "per year", "Normal: municipal outage probability", "Disruption risk"),
  "risk.p.municipal.drought2021": ill(0.25, "per year", "2021 drought: municipal outage probability", "Disruption risk"),
  "risk.p.municipal.stress2035": ill(0.15, "per year", "2035: municipal outage probability", "Disruption risk"),
  "risk.p.municipal.stress2050": ill(0.3, "per year", "2050: municipal outage probability", "Disruption risk"),
  "risk.p.groundwater.normal": ill(0.03, "per year", "Normal: groundwater outage probability", "Disruption risk"),
  "risk.p.groundwater.drought2021": ill(0.1, "per year", "2021 drought: groundwater outage probability", "Disruption risk"),
  "risk.p.groundwater.stress2035": ill(0.08, "per year", "2035: groundwater outage probability", "Disruption risk"),
  "risk.p.groundwater.stress2050": ill(0.15, "per year", "2050: groundwater outage probability", "Disruption risk"),
  "risk.p.seawater.normal": ill(0.02, "per year", "Normal: seawater intake outage probability", "Disruption risk"),
  "risk.p.seawater.drought2021": ill(0.02, "per year", "2021 drought: seawater outage probability", "Disruption risk"),
  "risk.p.seawater.stress2035": ill(0.02, "per year", "2035: seawater outage probability", "Disruption risk"),
  "risk.p.seawater.stress2050": ill(0.03, "per year", "2050: seawater outage probability", "Disruption risk"),
  "risk.p.recycled.normal": ill(0.05, "per year", "Normal: recycling plant outage probability", "Disruption risk"),
  "risk.p.recycled.drought2021": ill(0.05, "per year", "2021 drought: recycling outage probability", "Disruption risk"),
  "risk.p.recycled.stress2035": ill(0.05, "per year", "2035: recycling outage probability", "Disruption risk"),
  "risk.p.recycled.stress2050": ill(0.05, "per year", "2050: recycling outage probability", "Disruption risk"),
  "risk.p.reclaimed.normal": ill(0.05, "per year", "Normal: reclaimed supply outage probability", "Disruption risk"),
  "risk.p.reclaimed.drought2021": ill(0.1, "per year", "2021 drought: reclaimed outage probability", "Disruption risk"),
  "risk.p.reclaimed.stress2035": ill(0.08, "per year", "2035: reclaimed outage probability", "Disruption risk"),
  "risk.p.reclaimed.stress2050": ill(0.12, "per year", "2050: reclaimed outage probability", "Disruption risk"),

  // ---------- Energy-water coupling (off by default) ----------
  "coupling.elecMultiplier": ill(
    1.25,
    "×",
    "Drought-day electricity price multiplier",
    "Energy-water coupling",
    "Context: the 2021 drought also caused blackouts via reduced hydropower (Earth.org, Verdict). Magnitude here is illustrative.",
  ),
  "coupling.energyIntensiveAvail": ill(
    0.85,
    "fraction",
    "Drought-day availability of desal & recycling",
    "Energy-water coupling",
  ),

  // ---------- Finance ----------
  "finance.discountRate": ill(0.08, "fraction/yr", "Discount rate", "Finance"),
  "finance.horizonYears": ill(10, "years", "Project horizon", "Finance"),
} as const satisfies Record<string, Assumption>;

export type AssumptionKey = keyof typeof DEFAULT_ASSUMPTIONS;
export type AssumptionValues = Record<AssumptionKey, number>;

export const ASSUMPTION_KEYS = Object.keys(DEFAULT_ASSUMPTIONS) as AssumptionKey[];

export function defaultValues(): AssumptionValues {
  const out = {} as AssumptionValues;
  for (const key of ASSUMPTION_KEYS) out[key] = DEFAULT_ASSUMPTIONS[key].value;
  return out;
}

/** Merge user overrides onto defaults, ignoring unknown keys and non-finite numbers. */
export function withOverrides(overrides: Partial<Record<string, number>> | undefined): AssumptionValues {
  const values = defaultValues();
  if (!overrides) return values;
  for (const key of ASSUMPTION_KEYS) {
    const v = overrides[key];
    if (typeof v === "number" && Number.isFinite(v)) values[key] = v;
  }
  return values;
}

/** Sourced Taiwan case-study facts. Context for the UI and README, not all drive calculations. */
export interface CaseStudyFact {
  id: string;
  text: string;
  source: string;
  year: number;
  url?: string;
}

export const CASE_STUDY_FACTS: CaseStudyFact[] = [
  { id: "drought-2021", text: "2021 was Taiwan's worst drought in over 50 years (\"worst in 56 years\"). In 2020 no typhoon made landfall for the first time since 1964.", source: "Earth.org", year: 2022, url: "https://earth.org/the-taiwan-water-shortage-dilemma/" },
  { id: "tsmc-use", text: "TSMC used about 156,000 metric tons of water a day across its operations in 2019.", source: "Verdict, citing TSMC's 2019 CSR report", year: 2021, url: "https://www.verdict.co.uk/taiwan-drought-chip-supply/" },
  { id: "park-use", text: "Hsinchu Science Park uses about 170,000 t/day; Southern Taiwan Science Park about 175,000 t/day.", source: "Earth.org; Tom's Hardware citing DigiTimes", year: 2021, url: "https://www.tomshardware.com/news/tsmc-umc-hit-by-drought-trucking-in-water" },
  { id: "fab-use", text: "An average semiconductor fab consumes roughly 20,000 t/day.", source: "Fortune, citing China Water Risk", year: 2021, url: "https://fortune.com/2021/06/12/chip-shortage-taiwan-drought-tsmc-water-usage/" },
  { id: "recycling", text: "TSMC recycled about 87% of its manufacturing water in 2019 and reuses each drop about 3.5 times.", source: "Fortune", year: 2021, url: "https://fortune.com/2021/06/12/chip-shortage-taiwan-drought-tsmc-water-usage/" },
  { id: "cuts", text: "Hsinchu-area industrial cuts reached 11% in Feb 2021 and 15% by June. One tanker carries about 20 t, so an 11% cut at one 20,000 t/day fab is about 110 tanker trips a day.", source: "Wccftech; Taipei Times; DV Hardware", year: 2021, url: "https://www.taipeitimes.com/News/front/archives/2021/06/01/2003758391" },
  { id: "trucked", text: "TSMC and UMC trucked in about 3,600 t, roughly 2% of a day's use in the Southern park.", source: "Tom's Hardware", year: 2021, url: "https://www.tomshardware.com/news/tsmc-umc-hit-by-drought-trucking-in-water" },
  { id: "reservoir", text: "Baoshan II reservoir (Hsinchu) was at 14.62% storage in Feb 2021.", source: "The Register", year: 2021, url: "https://www.theregister.com/2021/02/24/tsmc_drought/" },
  { id: "desal-plant", text: "An emergency desalination unit completed in Hsinchu during the drought treats about 13,000 t/day, small relative to park demand.", source: "Taiwan Water Resources Agency", year: 2021, url: "https://www.wra.gov.tw/wrapen/cp.aspx?n=44729" },
  { id: "desal-cost", text: "Desalinated water was cited at about US$1 per tonne, affordable mainly to companies like TSMC.", source: "Al Jazeera", year: 2021, url: "https://www.aljazeera.com/news/2021/8/20/taiwan-water-woes" },
  { id: "tsmc-reclaim", text: "TSMC's Southern Taiwan Science Park reclamation plant started in Sept 2022 at 5,000 t/day, reached 20,000 t/day about a year later, and targets 30,000 t/day by 2026.", source: "CTCI (operator)", year: 2022, url: "https://www.ctci.com/e-newsletter/EN/481/discover-reliable/article-01.html" },
  { id: "blackouts", text: "Drought-reduced hydropower was cited as a factor in May 2021 power rationing (the 13 May blackout is usually attributed to a power plant fault).", source: "Verdict", year: 2021, url: "https://www.verdict.co.uk/taiwan-drought-chip-supply/" },
];
