"use client";
import { useMemo } from "react";
import { SCENARIO_LABELS, type AdvisorCard as Card } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { engine } from "@/lib/ui/engine";
import { fmtCompact } from "@/lib/ui/format";
import { TIER_COLORS } from "@/lib/ui/pieceArt";
import { useCatalog, useFmt, useValues } from "./hooks";
import { Corners, Icon } from "./ui/Icon";

export function AdvisorPanel() {
  const settings = useNature((s) => s.settings);
  const advisor = useNature((s) => s.advisor);
  const accepted = useNature((s) => s.acceptedCards);
  const question = useNature((s) => s.question);
  const answer = useNature((s) => s.answer);
  const asking = useNature((s) => s.asking);
  const { runAdvisor, setQuestion, ask, acceptAll } = useNature.getState();
  const plan = advisor?.plan;
  const planDone = plan ? accepted.includes("plan") : true;

  return (
    <div className="flex flex-col gap-3 p-3.5">
      <div className="kicker" style={{ color: "var(--orange-deep)" }}>AI Advisor · {SCENARIO_LABELS[settings.scenarioId]}</div>
      <button
        type="button"
        onClick={runAdvisor}
        className="cursor-pointer border-[2.5px] border-[var(--ink)] bg-[var(--orange)] px-2.5 py-3 font-[family-name:var(--font-heading)] text-[19px] font-bold uppercase tracking-[0.04em] text-[var(--color-text)] shadow-[0_4px_0_var(--ink)] hover:bg-[#f59a3e] active:translate-y-[2px] active:shadow-[0_2px_0_var(--ink)]"
      >
        Recommend the best setup
      </button>
      <form className="flex" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
        <label htmlFor="advisor-q" className="sr-only">Ask the advisor</label>
        <input
          id="advisor-q"
          className="ninput flex-1"
          value={question}
          maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="How do I cut my water use by 50%?"
        />
        <button type="submit" className="nbtn is-on -ml-[1.5px]" disabled={asking || !question.trim()}>{asking ? "…" : "Ask"}</button>
      </form>
      {answer && (
        <div className="border-[1.5px] border-[var(--orange)] bg-[var(--orange-tint)] p-2.5 text-[14px] leading-[1.4]" aria-live="polite">
          <div className="mb-1 text-[11px] font-bold tracking-[0.1em] text-[var(--orange-text)] uppercase">{answer.source === "claude" ? "Claude" : "Scripted answer"}</div>
          <p className="m-0 whitespace-pre-wrap">{answer.text}</p>
        </div>
      )}
      {advisor && advisor.cards.length === 0 && (
        <p className="m-0 text-[13px] text-[var(--color-neutral-700)]">No single addition improves this board under the current scenario.</p>
      )}
      {plan && <AdvisorCardView card={plan} done={planDone} highlight />}
      {advisor?.cards.map((c) => <AdvisorCardView key={c.id} card={c} done={accepted.includes(c.id)} />)}
      {plan && !planDone && (
        <button type="button" className="nbtn nbtn-orange" onClick={acceptAll}>Add the combined setup ({plan.pieces.length} pieces)</button>
      )}
      {advisor && <div className="text-[11.5px] text-[var(--color-neutral-600)]">Hover a card to preview its pieces on the board.</div>}
    </div>
  );
}

function AdvisorCardView({ card, done, highlight }: { card: Card; done: boolean; highlight?: boolean }) {
  const catalog = useCatalog();
  const fmt = useFmt();
  const { acceptCard, setPreviewCard, openShowWork } = useNature.getState();
  const settings = useNature((s) => s.settings);
  const values = useValues();
  const firstOut = card.pieces.map((t) => catalog[t]?.outputTier).find((t) => t);
  const metrics = useMemo(() => {
    const m = engine.compare(card.board, values, settings).metrics;
    return [m.netAnnualSavings, m.riskAdjustedSavings, m.capex, m.payback, m.npvRiskAdjusted, m.waterWithdrawn];
  }, [card.board, values, settings]);
  const showWork = () => openShowWork(`${card.title}: board with this applied`, metrics);

  return (
    <div
      className={`blueprint flex flex-col gap-1.5 border-[1.5px] border-[var(--ink)] p-3 ${highlight ? "bg-[var(--orange-tint)]" : "bg-[#fffaf3]"}`}
      onMouseEnter={() => !done && setPreviewCard(card.id)}
      onMouseLeave={() => setPreviewCard(null)}
      onFocus={() => !done && setPreviewCard(card.id)}
      onBlur={() => setPreviewCard(null)}
    >
      <Corners />
      <div className="flex items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-heading)] text-[18px] font-bold leading-tight">{card.title}</span>
        <span className="tag" style={{ background: firstOut ? TIER_COLORS[firstOut] : "var(--green)" }}>{firstOut ? `T${firstOut}` : "Eff"}</span>
      </div>
      <p className="m-0 text-[13.5px] leading-[1.35]">{card.why}</p>
      <div className="grid grid-cols-3 gap-1.5 border-t border-dashed border-[var(--orange-line)] pt-1.5 text-[12px]">
        <div><b className="block text-[14px]">{fmt.money(card.riskAdjustedSavings, { signed: true })}</b>risk-adj./yr</div>
        <div><b className="block text-[14px]">{card.paybackYears === null ? "—" : `${card.paybackYears.toFixed(1)} yr`}</b>payback</div>
        <div><b className="block text-[14px]">{card.waterSaved > 0 ? `−${fmtCompact(card.waterSaved)}` : "backup"}</b>{card.waterSaved > 0 ? "m³/day" : "supply"}</div>
      </div>
      <div className="flex items-center justify-between text-[12px] text-[var(--color-neutral-700)]">
        <span>Capex {fmt.money(card.capex)} · NPV {fmt.money(card.npvRiskAdjusted, { signed: true })}</span>
        <button type="button" className="info-btn" aria-label={`Show your work: ${card.title}`} onClick={showWork}><Icon name="info" size={15} /></button>
      </div>
      <div className="text-[12.5px] text-[var(--orange-text)]">Tradeoff: {card.tradeoff}</div>
      <div className="mt-0.5 flex gap-1.5">
        {done ? (
          <span className="flex flex-1 items-center justify-center gap-1 border-[1.5px] border-[var(--green)] bg-[var(--green-tint)] px-1 py-[7px] text-[13px] font-bold text-[var(--green-deep)]"><Icon name="check" size={14} /> On board</span>
        ) : (
          <button type="button" className="nbtn nbtn-sm flex-1" style={{ background: "var(--orange)", fontWeight: 700 }} onClick={() => acceptCard(card.id)}>Add to board</button>
        )}
      </div>
    </div>
  );
}
