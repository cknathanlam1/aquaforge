"use client";
import { SCENARIO_LABELS } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { fmtNumber } from "@/lib/ui/format";
import { useComparison, useFmt } from "../hooks";
import { Corners, Icon } from "../ui/Icon";
import { InfoButton } from "../ui/InfoButton";
import { CostChart } from "./CostChart";
import { MetricCard, SubMetric, useHighlight } from "./MetricCard";
import { RiskGauge } from "./RiskGauge";

const POS = "var(--green-deep)";
const NEG = "var(--red-deep)";
const capexSub = (n: number) => (n === 0 ? "nothing new built" : `${n} new piece${n === 1 ? "" : "s"}`);
const signColor =(v: number | null) => (v === null || v === 0 ? undefined : v > 0 ? POS : NEG);

function SavingsHero() {
  const { metrics: m } = useComparison();
  const fmt = useFmt();
  const openDetail = useNature((s) => s.openDetail);
  const [hl, ref] = useHighlight("netAnnualSavings");
  const [hl2] = useHighlight("riskAdjustedSavings");
  const net = m.netAnnualSavings;
  return (
    <div ref={ref} className={`blueprint bp-card is-hit ${hl || hl2 ? "is-highlight" : ""}`} style={{ borderWidth: 2.5, padding: "10px 12px" }}>
      <Corners />
      <button type="button" className="card-hit" aria-label={`Net annual savings ${fmt.value(net.value, net.unit)}. Open details`} onClick={() => openDetail("netAnnualSavings")} />
      <div className="above">
        <div className="flex items-center justify-between">
          <span className="kicker" style={{ color: "var(--color-text)" }}>Net annual savings</span>
          <InfoButton metrics={[net]} />
        </div>
        <div className="heading text-[44px] leading-none" style={{ color: signColor(net.value) }}>
          {fmt.money(net.value ?? 0, { signed: true })}<span className="ml-1 text-[18px] text-[var(--muted)]">/yr</span>
        </div>
        <div className="mt-1 text-[13px]"><SubMetric metric={m.riskAdjustedSavings} prefix="Risk-adjusted: " color={signColor(m.riskAdjustedSavings.value)} /></div>
      </div>
    </div>
  );
}

function DoNothingHero() {
  const c = useComparison();
  const fmt = useFmt();
  const scenarioId = useNature((s) => s.settings.scenarioId);
  const on2050 = useNature((s) => s.doNothing2050);
  const setDoNothing2050 = useNature((s) => s.setDoNothing2050);
  const [hl, ref] = useHighlight("costOfDoingNothing");
  const drought = scenarioId !== "normal";
  const toggle = (
    <button type="button" className="nbtn nbtn-sm pe" aria-pressed={on2050} onClick={() => setDoNothing2050(!on2050)}>
      Do nothing in 2050
    </button>
  );
  if (!drought && !on2050) return <div className="flex items-center justify-between text-[12.5px] text-[var(--muted)]"><span>What if you wait?</span>{toggle}</div>;
  const metric = on2050 ? c.metrics.doNothing2050 : c.metrics.costOfDoingNothing;
  const tankers = metric.inputs.find((i) => i.unit === "tankers/day");
  return (
    <div ref={ref} className={`blueprint bp-card ${hl ? "is-highlight" : ""}`} style={{ background: "var(--red-tint)", borderColor: "var(--red)" }}>
      <Corners />
      <div className="flex items-center justify-between gap-1">
        <span className="kicker" style={{ color: "var(--red-deep)" }}>Cost of doing nothing · {on2050 ? SCENARIO_LABELS.stress2050 : SCENARIO_LABELS[scenarioId]}</span>
        <InfoButton metrics={[metric]} />
      </div>
      <div className="heading text-[34px] leading-none text-[var(--red-deep)]">{fmt.money(metric.value ?? 0)}<span className="ml-1 text-[16px]">/yr</span></div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
        {tankers && (
          <span className="inline-flex items-center gap-1"><Icon name="truck" size={16} /> <b>{fmtNumber(tankers.value)}</b> tankers/day if you do nothing</span>
        )}
        {!on2050 && <SubMetric metric={c.metrics.tankersPerDay} prefix="With your design: " />}
      </div>
      <div className="mt-1.5">{toggle}</div>
    </div>
  );
}

export function Dashboard() {
  const c = useComparison();
  const fmt = useFmt();
  const m = c.metrics;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="kicker">Impact · tap a card for details</div>
      <SavingsHero />
      <DoNothingHero />
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard metricKey="payback" metric={m.payback} sub={m.payback.value === null ? "needs capex + savings" : `on ${fmt.money(m.capex.value ?? 0)} capex`} />
        <MetricCard metricKey="npv" metric={m.npv} valueColor={signColor(m.npv.value)} sub={<SubMetric metric={m.npvRiskAdjusted} prefix="Risk-adj.: " />} />
        <MetricCard metricKey="capex" metric={m.capex} sub={capexSub(m.capex.inputs.filter((i) => i.value > 0).length)} />
        <MetricCard metricKey="annualCost" metric={m.annualCost} sub={`do nothing: ${fmt.money(c.baseline.annual.total)}`} />
        <MetricCard metricKey="waterWithdrawn" metric={m.waterWithdrawn} sub={<><span>m³/day · </span><SubMetric metric={m.recycledPct} prefix="" color="var(--teal)" /> recycled</>} />
        <MetricCard metricKey="treatmentEnergy" metric={m.treatmentEnergy} sub="kWh/day · treatment + pumping" />
      </div>
      <RiskGauge risk={m.supplyRisk} disruption={m.expectedDisruption} />
      <CostChart comparison={c} />
    </div>
  );
}
