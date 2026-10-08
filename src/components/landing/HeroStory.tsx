"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CalendarDays, Check, Info, Landmark, ListTodo, Mail, MessageCircle, Paperclip } from "lucide-react";
import { use3DTilt } from "@/hooks/use3DTilt";
import { signatureFont } from "@/lib/fonts";
import { nextEmp201Due, nextVat201Due } from "@/lib/complianceDates";

// ── The hero story ────────────────────────────────────────────────────────────────
// One owner's month told in three beats:
//   chaos    → the pile builds: till slips, bank lines, SARS reminders, a message
//              from home, an overdue invoice, a payslip, a sticky note
//   order    → the month's transactions are reconciled one by one, then the
//              returns are filed
//   decision → the month's report arrives by email with one plain recommendation,
//              to talk through at the owner's next review
// Then it fades to the next owner's story. It keeps running on hover (Zjak,
// 2026-10-07). Every figure, name and business is invented and the panel
// says so twice (static "Example" badge and footnote), as decided for the hero
// panel in website-v2 (Zjak, 2026-10-05). The decision arrives as an email, not a
// chat, so the panel doesn't promise instant replies.

// The story starts straight into the chaos beat: the old 2-second "intro"
// loading bar read as an empty card (funnel review F07, 2026-10-08).
//
// ⚠️ Smooth first load and phones (hero-smooth-load, 2026-10-08). Measured
// before: the server HTML shipped every pile piece at opacity 0 (an empty card
// until hydration), phones got the desktop pile and then jumped to the narrow
// one, and pieces, ledger rows and the email animated left/top/height: layout
// work every frame, layout shift from the animation itself, and a third of
// frames dropped on a throttled phone. So:
//   - The first story renders its pile already built, so the first frame is
//     settled; the pile only "arrives" on later loops.
//   - Pile layout is CSS (custom properties per breakpoint), never a JS switch,
//     so server and client agree on every screen size.
//   - Every beat animates transform and opacity only, as CSS transitions keyed
//     off `data-phase`; React re-renders on a phase change and, in the order
//     beat, only the ledger re-renders, once per line.
//   - Phones get a calmer cut: five pieces, a dozen lines, a 12 s loop (18 s
//     on desktop), no drifting and no backdrop blur (TIMING.narrow, `.hero-pile-wide`).
// Do not move pieces with left/top/height animations or back into `motion`
// (it keeps only the mouse tilt and the step pill).
type StoryPhase = "chaos" | "order" | "arriving" | "decision" | "leaving";

interface Timing {
  /** First chaos beat: the pile is already there, so it only holds. */
  chaosFirst: number;
  /** Later chaos beats: the pile arrives, then holds. */
  chaos: number;
  /** Lines reconciled in the order beat, one count per story. */
  txCounts: number[];
  /** Pace of the order beat: one statement line every perTx ms. */
  perTx: number;
  /** Time after the last line for the filed chips. */
  orderTail: number;
  arriving: number;
  decision: number;
  /** Delay between pile pieces arriving. */
  arriveStep: number;
}

const TIMING: Record<"wide" | "narrow", Timing> = {
  wide: {
    chaosFirst: 2600,
    chaos: 4800,
    txCounts: [23, 29, 18],
    perTx: 140,
    orderTail: 1700,
    arriving: 1300,
    decision: 7500,
    arriveStep: 0.3,
  },
  narrow: {
    chaosFirst: 1800,
    chaos: 3000,
    txCounts: [12, 13, 11],
    perTx: 110,
    orderTail: 1200,
    arriving: 900,
    decision: 5500,
    arriveStep: 0.28,
  },
};
/** The scene fades out for this long before the next owner's story. */
const LEAVE_MS = 500;
const ROW_PX = 26;

function phaseMs(phase: StoryPhase, scene: number, t: Timing, looped: boolean): number {
  switch (phase) {
    case "chaos":
      return looped ? t.chaos : t.chaosFirst;
    case "order":
      return t.txCounts[scene] * t.perTx + t.orderTail;
    case "arriving":
      return t.arriving;
    case "decision":
      return t.decision;
    case "leaving":
      return LEAVE_MS;
  }
}

const NEXT_PHASE: Record<StoryPhase, StoryPhase | null> = {
  chaos: "order",
  order: "arriving",
  arriving: "decision",
  decision: "leaving",
  leaving: null,
};

const EASE = [0.16, 1, 0.3, 1] as const;

// ── Dates (kept current so the story never reads as stale) ────────────────────────
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface StoryDates {
  month: string;
  period: string;
  vatDue: string;
  emp201Due: string;
}

// Due dates follow the site's own compliance calendar (VAT201 on eFiling: the
// last business day; EMP201: the 7th or the business day before), F06.
function computeStoryDates(): StoryDates {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const vat = nextVat201Due(now);
  const emp = nextEmp201Due(now);
  return {
    month: MONTH_FULL[prev.getMonth()],
    period: `${MONTH_SHORT[prev.getMonth()]} ${prev.getFullYear()}`,
    vatDue: `${vat.getDate()} ${MONTH_FULL[vat.getMonth()]}`,
    emp201Due: `${emp.getDate()} ${MONTH_FULL[emp.getMonth()]}`,
  };
}

// ── Scenes ───────────────────────────────────────────────────────────────────────
interface Receipt {
  store: string;
  place: string;
  lines: [string, string][];
  total: string;
  vat: string;
}
interface BankRow {
  date: string;
  desc: string;
  amount: string;
  unmatched?: boolean;
}
interface Notice {
  app: "Reminders" | "Messages" | "Mail" | "Calendar";
  time: string;
  title: string;
  body: string;
}
interface Invoice {
  number: string;
  billTo: string;
  amount: string;
  overdue: string;
}
interface Payslip {
  name: string;
  lines: [string, string][];
  net: string;
}

interface Scene {
  business: string;
  receipt: Receipt;
  bank: BankRow[];
  reminder: Notice;
  message: Notice;
  mail: Notice;
  invoice: Invoice;
  payslip: Payslip;
  sticky: string;
  /** Statement descriptions for the order beat; income is flagged with a leading "+". */
  pool: string[];
  filed: string[];
  email: { subject: string; preview: string; before: string; figure: string; after: string };
}

function buildScenes(d: StoryDates): Scene[] {
  return [
    {
      business: "Building contractor · 14 staff",
      receipt: {
        store: "HARDWARE & TIMBER CC",
        place: "Centurion",
        lines: [
          ["20 × Cement 50kg", "2 380.00"],
          ["40 × Rebar Y12 6m", "4 520.00"],
          ["2 × Tie wire 1kg", "480.00"],
        ],
        total: "R 7 380.00",
        vat: "962.61",
      },
      bank: [
        { date: "03", desc: "DEBIT ORDER 0045821", amount: "−4 850.00", unmatched: true },
        { date: "02", desc: "CARD SETTLEMENT", amount: "+12 310.40" },
        { date: "02", desc: "CASH WITHDRAWAL", amount: "−2 000.00", unmatched: true },
        { date: "01", desc: "BANK CHARGES", amount: "−186.50" },
      ],
      reminder: { app: "Reminders", time: "07:30", title: "VAT201 return", body: `Due ${d.vatDue}` },
      message: { app: "Messages", time: "07:42", title: "Sam", body: "Did you pay SARS yet?" },
      mail: { app: "Mail", time: "07:58", title: "Supplier statement", body: "Overdue balance: R 12 880.00" },
      invoice: { number: "INV-0147", billTo: "Midrand Logistics Park", amount: "R 26 400.00", overdue: "47 days overdue" },
      payslip: {
        name: "T. Mokoena",
        lines: [["Basic salary", "16 500.00"], ["PAYE", "−2 125.00"], ["UIF", "−165.00"]],
        net: "14 210.00",
      },
      sticky: "Where are the fuel slips??",
      pool: [
        "HARDWARE & TIMBER", "+CLIENT PMT MIDRAND", "PLANT HIRE", "DIESEL SITE BAKKIE", "SALARIES",
        "TOLL GATES", "CEMENT SUPPLIER", "+CARD SETTLEMENT", "SUBCONTRACTOR", "BANK CHARGES",
        "INSURANCE PREMIUM", "+CLIENT PMT ROOIHUIS", "CELL CONTRACT", "SAFETY GEAR",
      ],
      filed: ["Books closed", "EMP201 filed", "VAT201 filed"],
      email: {
        subject: `${d.month} Insights Report: cash covers 4.2 months`,
        preview: "Books are closed and VAT201 is filed. Cash covers 4.2 months…",
        before: "Books are closed and VAT201 is filed. Cash covers ",
        figure: "4.2 months",
        after: ". If the Midrand contract lands, the second site manager is affordable from next quarter. Let’s talk it through at your review.",
      },
    },
    {
      business: "Online and retail store · 9 staff",
      receipt: {
        store: "COURIER EXPRESS",
        place: "Waybill summary",
        lines: [
          ["38 × Parcel · Gauteng", "2 470.00"],
          ["6 × Parcel · Cape Town", "690.00"],
          ["Fuel levy", "260.00"],
        ],
        total: "R 3 420.00",
        vat: "446.09",
      },
      bank: [
        { date: "05", desc: "SPEEDPOINT SETTLE", amount: "+61 230.18" },
        { date: "04", desc: "EFT 88213 STOCK?", amount: "−18 900.00", unmatched: true },
        { date: "04", desc: "ONLINE STORE PAYOUT", amount: "+24 118.60" },
        { date: "03", desc: "CARD FEES", amount: "−1 466.21", unmatched: true },
      ],
      reminder: { app: "Reminders", time: "08:05", title: "UIF declaration", body: "Outstanding for this month" },
      message: { app: "Messages", time: "08:11", title: "Sam", body: "Did the salaries go off?" },
      mail: { app: "Mail", time: "08:20", title: "Coastal Textiles", body: "Reminder: SUP-2291 due in 5 days" },
      invoice: { number: "SUP-2291", billTo: "From: Coastal Textiles", amount: "R 94 500.00", overdue: "Due in 5 days" },
      payslip: {
        name: "N. Dlamini",
        lines: [["Basic salary", "13 400.00"], ["PAYE", "−1 406.00"], ["UIF", "−134.00"]],
        net: "11 860.00",
      },
      sticky: "Stock count before Friday!",
      pool: [
        "+SPEEDPOINT SETTLE", "COURIER", "STOCK COASTAL TEXTILES", "+ONLINE STORE PAYOUT", "PACKAGING",
        "SALARIES", "RENT", "ELECTRICITY", "CARD FEES", "ADVERTISING", "+SPEEDPOINT SETTLE",
        "REFUND CUSTOMER", "BANK CHARGES", "SHOPFITTING",
      ],
      filed: ["Books closed", "EMP201 filed", "UIF declared"],
      email: {
        subject: `${d.month} Insights Report: margin held at 38%`,
        preview: "Books are closed and your margin held at 38%…",
        before: "Books are closed and your margin held at ",
        figure: "38%",
        after: ". You can fund next month’s stock run up to R 180 000 without touching the overdraft. Let’s plan the order at your review.",
      },
    },
    {
      business: "Engineering consultancy · 22 staff",
      receipt: {
        store: "FUEL STOP N4",
        place: "Rustenburg",
        lines: [
          ["Diesel 50ppm 52.3L", "1 204.40"],
          ["Toll gates × 4", "760.00"],
        ],
        total: "R 1 964.40",
        vat: "256.23",
      },
      bank: [
        { date: "01", desc: "DEBIT ORDER SOFTWARE", amount: "−8 140.00", unmatched: true },
        { date: "01", desc: "EFT RETAINER 0391", amount: "+28 750.00" },
        { date: "01", desc: "PROF INDEMNITY", amount: "−3 912.00" },
        { date: "01", desc: "EFT 7731 UNKNOWN", amount: "+6 400.00", unmatched: true },
      ],
      reminder: { app: "Reminders", time: "07:15", title: "IRP6 provisional tax", body: "Estimate needed this month" },
      message: { app: "Messages", time: "07:51", title: "Sam", body: "Did you pay SARS yet?" },
      mail: { app: "Mail", time: "08:03", title: "Platinum Belt Mining", body: "Re: INV-0388 · querying the hours" },
      invoice: { number: "INV-0388", billTo: "Platinum Belt Mining", amount: "R 42 000.00", overdue: "63 days overdue" },
      payslip: {
        name: "K. van Wyk",
        lines: [["Basic salary", "42 000.00"], ["PAYE", "−9 372.88"], ["UIF", "−177.12"]],
        net: "32 450.00",
      },
      sticky: "Chase Platinum Belt AGAIN",
      pool: [
        "+CLIENT RETAINER", "SOFTWARE SUBSCRIPTION", "FUEL", "TOLL GATES", "SALARIES", "RENT",
        "PROF INDEMNITY", "+CLIENT FEE", "BANK CHARGES", "TRAINING", "OFFICE SUPPLIES",
        "+CLIENT RETAINER", "COURIER", "CELL CONTRACTS",
      ],
      filed: ["Books closed", "EMP201 filed", "IRP6 estimate ready"],
      email: {
        subject: `${d.month} Insights Report: R 60 500 is 60+ days late`,
        preview: "Books are closed. Two clients owe R 60 500 and are more than 60 days late…",
        before: "Books are closed. Two clients owe ",
        figure: "R 60 500",
        after: " and are more than 60 days late. Collect it this month and next month’s payroll is covered without the overdraft. The list is in the report.",
      },
    },
  ];
}

// ── The month's statement (order beat) ────────────────────────────────────────────
interface Tx {
  id: number;
  date: string;
  desc: string;
  amount: string;
}

function formatRand(n: number): string {
  const [whole, cents] = n.toFixed(2).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${cents}`;
}

// Plausible monthly amounts per statement line for an SME with 9 to 22 staff,
// in rand: [min, max]. Owners know their own bank charges, so a figure like
// "BANK CHARGES −16 570.85" undercut the panel (funnel review F05, 2026-10-08).
const EXPENSE_RANGES: Record<string, [number, number]> = {
  "BANK CHARGES": [150, 900],
  "CARD FEES": [300, 2500],
  "TOLL GATES": [200, 2000],
  "SAFETY GEAR": [400, 4500],
  "DIESEL SITE BAKKIE": [800, 3500],
  FUEL: [600, 3000],
  "CELL CONTRACT": [400, 1500],
  "CELL CONTRACTS": [900, 4000],
  "INSURANCE PREMIUM": [1500, 6500],
  "PROF INDEMNITY": [1200, 4500],
  RENT: [12000, 35000],
  ELECTRICITY: [2500, 9000],
  "SOFTWARE SUBSCRIPTION": [300, 3500],
  COURIER: [150, 2500],
  PACKAGING: [500, 4000],
  ADVERTISING: [1000, 8000],
  "REFUND CUSTOMER": [150, 1800],
  SHOPFITTING: [3000, 15000],
  TRAINING: [1500, 8000],
  "OFFICE SUPPLIES": [150, 1500],
  "HARDWARE & TIMBER": [1500, 12000],
  "PLANT HIRE": [3000, 18000],
  "CEMENT SUPPLIER": [2000, 15000],
  SUBCONTRACTOR: [5000, 30000],
  "STOCK COASTAL TEXTILES": [8000, 40000],
  SALARIES: [40000, 190000],
};
const DEFAULT_EXPENSE_RANGE: [number, number] = [150, 3000];

/** A deterministic month of statement lines, so server and client render the same. */
function buildStatement(pool: string[], seed: number, count: number): Tx[] {
  let x = seed * 7919;
  const rand = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  return Array.from({ length: count }, (_, i) => {
    const raw = pool[Math.floor(rand() * pool.length)];
    const income = raw.startsWith("+");
    const desc = income ? raw.slice(1) : raw;
    const [min, max] = EXPENSE_RANGES[desc] ?? DEFAULT_EXPENSE_RANGE;
    const value = income ? 2000 + rand() * 60000 : min + rand() * (max - min);
    return {
      id: i,
      date: String(1 + Math.floor((i * 30) / count)).padStart(2, "0"),
      desc,
      amount: `${income ? "+" : "−"}${formatRand(value)}`,
    };
  });
}

// ── Timeline ─────────────────────────────────────────────────────────────────────
function useStoryTimeline(timing: Timing) {
  const reduce = useReducedMotion();
  const observeRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<StoryPhase>("chaos");
  const [scene, setScene] = useState(0);
  // False until the first story has played: that one opens on a built pile.
  const [looped, setLooped] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  // Pause off-screen and in background tabs, so the story is never mid-way when you look.
  useEffect(() => {
    const el = observeRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (reduce || !inView || !pageVisible) return;
    const timer = setTimeout(() => {
      const next = NEXT_PHASE[phase];
      if (next) {
        setPhase(next);
      } else {
        setScene((s) => (s + 1) % 3);
        setLooped(true);
        setPhase("chaos");
      }
    }, phaseMs(phase, scene, timing, looped));
    return () => clearTimeout(timer);
  }, [phase, scene, looped, timing, inView, pageVisible, reduce]);

  return {
    observeRef,
    phase: reduce ? ("decision" as const) : phase,
    scene: reduce ? 0 : scene,
    looped: !reduce && looped,
    paused: !inView || !pageVisible,
    reduce: !!reduce,
  };
}

/** Counts 0 → `total`, one step every `stepMs`, while `running`; reads `total` otherwise. */
function useCounter(running: boolean, stepMs: number, total: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setN((v) => Math.min(total, v + 1)), stepMs);
    return () => {
      clearInterval(id);
      setN(0);
    };
  }, [running, stepMs, total]);
  return running ? n : total;
}

// ── Pieces of the pile ────────────────────────────────────────────────────────────
function ReceiptSlip({ r }: { r: Receipt }) {
  return (
    <div className="hero-receipt hero-thermal px-3 pb-5 pt-2.5 font-mono text-[8.5px] leading-[1.45] text-[#3d3d3a]">
      <div className="text-center text-[9px] font-bold tracking-wider">{r.store}</div>
      <div className="text-center opacity-60">{r.place}</div>
      <div className="my-1 border-t border-dashed border-black/25" />
      {r.lines.map(([item, amt]) => (
        <div key={item} className="flex justify-between gap-2">
          <span className="truncate">{item}</span>
          <span className="shrink-0 whitespace-nowrap">{amt}</span>
        </div>
      ))}
      <div className="my-1 border-t border-dashed border-black/25" />
      <div className="flex justify-between text-[10px] font-bold">
        <span>TOTAL</span>
        <span className="whitespace-nowrap">{r.total}</span>
      </div>
      <div className="flex justify-between opacity-60">
        <span className="whitespace-nowrap">VAT 15% incl.</span>
        <span>{r.vat}</span>
      </div>
      <div className="hero-barcode mx-auto mt-1.5 h-4 w-4/5 opacity-70" />
    </div>
  );
}

function SmallSlip({ title, lines }: { title: string; lines: [string, string][] }) {
  return (
    <div className="hero-receipt hero-thermal px-2.5 pb-4 pt-2 font-mono text-[8px] leading-[1.45] text-[#3d3d3a]">
      <div className="text-center text-[8.5px] font-bold tracking-wider">{title}</div>
      <div className="my-1 border-t border-dashed border-black/25" />
      {lines.map(([a, b]) => (
        <div key={a} className="flex justify-between gap-2">
          <span className="truncate">{a}</span>
          <span className="shrink-0 whitespace-nowrap">{b}</span>
        </div>
      ))}
    </div>
  );
}

function BankStatement({ rows }: { rows: BankRow[] }) {
  return (
    <div className="hero-shadow rounded-xl border border-white/10 bg-[#0d1524] px-3 py-2.5">
      <div className="mb-1 flex justify-between text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Landmark className="h-3 w-3" /> Business cheque ··4471
        </span>
        <span>Transactions</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.desc}
          className="flex items-center gap-2 border-t border-white/[0.06] py-[5px] font-mono text-[9.5px]"
        >
          <span className="w-4 shrink-0 text-muted-foreground">{row.date}</span>
          <span className="truncate text-foreground/80">{row.desc}</span>
          {row.unmatched && (
            <span className="shrink-0 rounded-sm bg-[#f59e0b]/15 px-1 font-sans text-[8px] font-semibold uppercase tracking-wide text-[#fbbf24]">
              Unmatched
            </span>
          )}
          <span className="ml-auto shrink-0 whitespace-nowrap text-foreground/90">{row.amount}</span>
        </div>
      ))}
    </div>
  );
}

const APP_ICON: Record<Notice["app"], React.ReactNode> = {
  Messages: (
    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] bg-gradient-to-b from-[#5bd27a] to-[#2ea84f]">
      <MessageCircle className="h-2.5 w-2.5 fill-white text-white" />
    </span>
  ),
  Reminders: (
    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] bg-white">
      <ListTodo className="h-2.5 w-2.5 text-[#f08a00]" />
    </span>
  ),
  Mail: (
    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] bg-gradient-to-b from-[#4fa3ff] to-[#1f6fe0]">
      <Mail className="h-2.5 w-2.5 text-white" />
    </span>
  ),
  Calendar: (
    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] bg-white">
      <CalendarDays className="h-2.5 w-2.5 text-[#e5484d]" />
    </span>
  ),
};

function PhoneNotification({ n }: { n: Notice }) {
  return (
    <div className="hero-shadow rounded-[14px] border border-white/10 bg-[rgba(52,56,66,0.94)] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-white/55">
        {APP_ICON[n.app]}
        {n.app}
        <span className="ml-auto normal-case">{n.time}</span>
      </div>
      <div className="mt-1 truncate text-[11px] font-semibold text-white">{n.title}</div>
      <div className="truncate text-[11px] leading-snug text-white/80" suppressHydrationWarning>
        {n.body}
      </div>
    </div>
  );
}

function InvoiceDoc({ inv }: { inv: Invoice }) {
  const late = inv.overdue.includes("overdue");
  return (
    <div className="hero-paper hero-shadow rounded-[2px] px-3 py-2.5 text-[8.5px] text-[#1f2937]">
      <div className="flex items-start justify-between">
        <span className="text-[9.5px] font-bold tracking-wider">TAX INVOICE</span>
        <span className="font-mono opacity-70">{inv.number}</span>
      </div>
      <div className="mt-1 opacity-50">Bill to</div>
      <div className="truncate text-[9.5px] font-semibold">{inv.billTo}</div>
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-black/10 pt-1.5">
        <span
          className="whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[8px] font-semibold"
          style={{
            background: late ? "#fee2e2" : "#fef3c7",
            color: late ? "#b91c1c" : "#92400e",
          }}
        >
          {inv.overdue}
        </span>
        <span className="whitespace-nowrap font-mono text-[10px] font-bold">{inv.amount}</span>
      </div>
    </div>
  );
}

function PayslipDoc({ p, period }: { p: Payslip; period: string }) {
  return (
    <div className="hero-paper hero-shadow rounded-[2px] px-3 py-2.5 text-[8.5px] text-[#1f2937]">
      <div className="flex justify-between">
        <span className="text-[9.5px] font-bold tracking-wider">PAYSLIP</span>
        <span className="opacity-60" suppressHydrationWarning>
          {period}
        </span>
      </div>
      <div className="mb-1 text-[9.5px] font-semibold">{p.name}</div>
      {p.lines.map(([label, amt]) => (
        <div key={label} className="flex justify-between gap-2 font-mono opacity-75">
          <span className="truncate font-sans">{label}</span>
          <span className="shrink-0 whitespace-nowrap">{amt}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t border-black/10 pt-1 font-mono text-[9.5px] font-bold">
        <span className="font-sans">Net pay</span>
        <span className="whitespace-nowrap">{p.net}</span>
      </div>
    </div>
  );
}

function StickyNote({ text }: { text: string }) {
  return (
    <div
      className={`${signatureFont.className} hero-sticky hero-shadow flex aspect-square items-center justify-center p-2 text-center text-[15px] font-semibold leading-tight text-[#3b3415]`}
    >
      {text}
    </div>
  );
}


// Where each piece of the pile lands (percent of the stage), in the order it
// arrives; later pieces sit on top. Notifications stay level, as on a phone;
// paper lies at a slight angle. Back pieces sit a little further back and dimmer.
//
// `narrow` is the phone layout (below 640 px): five wider pieces, whose
// contents `.hero-pile-piece` zooms so receipt and statement text stays
// readable (it was 8 to 9.5 px at 375 px wide; funnel review F07, 2026-10-08).
// A piece with no `narrow` slot is hidden on phones by CSS, so the server
// render is right on every screen.
type Place = [left: number, top: number, width: string, rotate: number];

interface PileSlot {
  /** Index into the panel's `pile` array. */
  piece: number;
  wide: Place;
  narrow?: Place;
  back?: boolean;
}

const PILE: PileSlot[] = [
  { piece: 0, wide: [2, 1, "36%", -3], narrow: [2, 0, "50%", -3], back: true },
  { piece: 1, wide: [54, 0, "44%", 0], narrow: [45, 4, "54%", 0] },
  { piece: 2, wide: [22, 22, "58%", 0.6], narrow: [2, 29, "96%", 0.6] },
  { piece: 3, wide: [63, 34, "35%", 3], narrow: [43, 64, "55%", 3], back: true },
  { piece: 4, wide: [1, 42, "44%", 0] },
  { piece: 5, wide: [33, 56, "35%", -1.5], back: true },
  { piece: 6, wide: [40, 10, "24%", 4], back: true },
  { piece: 7, wide: [3, 66, "27%", -5], narrow: [6, 67, "34%", -5] },
  { piece: 8, wide: [52, 63, "46%", 0] },
  { piece: 9, wide: [72, 54, "25%", 6], back: true },
  { piece: 10, wide: [24, 80, "46%", 0] },
];

/** CSS custom properties for one slot: position, angle and stagger per breakpoint. */
function slotVars(slot: PileSlot, i: number, narrowIndex: number): React.CSSProperties {
  const [l, t, w, r] = slot.wide;
  const n = PILE.length;
  const vars: Record<string, string | number> = {
    zIndex: 10 + i,
    "--l": `${l}%`,
    "--t": `${t}%`,
    "--w": w,
    "--r": `${r}deg`,
    "--s": slot.back ? 0.95 : 1,
    // The pile builds faster as it goes.
    "--d": `${(0.1 + i * 0.36 - i * i * 0.011).toFixed(3)}s`,
    "--o": `${((n - 1 - i) * 0.035).toFixed(3)}s`,
  };
  if (slot.narrow) {
    const [ln, tn, wn, rn] = slot.narrow;
    Object.assign(vars, {
      "--ln": `${ln}%`,
      "--tn": `${tn}%`,
      "--wn": wn,
      "--rn": `${rn}deg`,
      "--dn": `${(0.1 + narrowIndex * TIMING.narrow.arriveStep).toFixed(3)}s`,
      "--on": `${((4 - narrowIndex) * 0.04).toFixed(3)}s`,
    });
  }
  return vars as React.CSSProperties;
}

const NARROW_QUERY = "(max-width: 639px)";

function subscribeNarrow(onChange: () => void) {
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * True below Tailwind's `sm` breakpoint; false on the server. Only timing and
 * the ledger's line count read it, and both are invisible until the order
 * beat, so the post-hydration switch never shows. Layout is CSS, never this.
 */
function useNarrowScreen(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}

// ── The order beat: the month's statement, reconciled line by line ───────────────
// Its own component, so the per-line counter re-renders the ledger and nothing
// else. Newest first: the list is laid out newest-at-top and slides down one
// row per reconciled line (a transform), revealing each new line at the top.
function Ledger({
  statement,
  month,
  filed,
  phase,
  perTx,
}: {
  statement: Tx[];
  month: string;
  filed: string[];
  phase: StoryPhase;
  perTx: number;
}) {
  const txCount = statement.length;
  const processing = phase === "order";
  const reconciled = useCounter(processing, perTx, txCount);
  const done = phase !== "chaos" && reconciled >= txCount;
  const rows = useMemo(() => [...statement].reverse(), [statement]);

  return (
    <div className="hero-ledger-wrap absolute inset-0 flex flex-col gap-2.5" data-done={done || undefined}>
      <div className="hero-ledger flex min-h-0 flex-1 origin-top flex-col rounded-xl border-[0.5px] border-white/10 bg-background/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-bold" suppressHydrationWarning>
            {month} bank statement
          </span>
          {/* Fixed-width count and an always-present tick, so nothing reflows per line. */}
          <span
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold tabular-nums"
            style={{ color: done ? "var(--success)" : "var(--muted-foreground)" }}
          >
            <Check className="h-3 w-3" strokeWidth={3} style={{ opacity: done ? 1 : 0 }} />
            <span>
              <span className="inline-block w-[2ch] text-right">{reconciled}</span> of {txCount} reconciled
            </span>
          </span>
        </div>
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="hero-ledger-progress h-full rounded-full"
            style={{
              transform: `scaleX(${reconciled / txCount})`,
              background: "linear-gradient(to right, var(--brand-cyan), var(--success))",
            }}
          />
        </div>
        <div className="hero-ledger-fade relative min-h-0 flex-1 overflow-hidden">
          <div
            className="hero-ledger-current pointer-events-none absolute inset-x-0 top-0 rounded-md bg-white/[0.06]"
            style={{ height: ROW_PX, opacity: processing && reconciled > 0 ? 1 : 0 }}
          />
          <ul
            className="hero-ledger-rows"
            data-moving={(processing && reconciled > 0) || undefined}
            style={{ transform: `translateY(${-(txCount - reconciled) * ROW_PX}px)` }}
          >
            {rows.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center gap-2.5 px-2 font-mono text-[12px] sm:text-[10.5px]"
                style={{ height: ROW_PX }}
              >
                <span className="w-4 shrink-0 text-muted-foreground">{tx.date}</span>
                <span className="truncate text-foreground/85">{tx.desc}</span>
                <span className="ml-auto shrink-0 whitespace-nowrap text-foreground/90">{tx.amount}</span>
                <span
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "color-mix(in oklch, var(--success) 22%, transparent)" }}
                >
                  <Check className="h-2.5 w-2.5 text-success" strokeWidth={3} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="hero-filed flex flex-wrap gap-1.5">
        {filed.map((label, i) => (
          <span
            key={label}
            className="hero-filed-chip inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success"
            style={{ "--i": i } as React.CSSProperties}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── The decision beat: the month's report lands in the inbox ─────────────────────
// Two layers cross-fade (opacity and transform only): the unread message as it
// arrives, then the opened email. The opened one sets the height, so nothing
// animates height.
function EmailHeader({ unread }: { unread: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-4 pb-2 pt-3">
      <div className="gradient-cta flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-primary-foreground">
        <span className="relative z-[2]">C</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12px] font-semibold text-[#111827]">Your accountant · Capucor</span>
          <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-[#6b7280]">
            {unread && <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" />}
            08:02
          </span>
        </div>
        <div className="text-[10.5px] text-[#6b7280]">to me</div>
      </div>
    </div>
  );
}

function EmailSubject({ subject }: { subject: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="truncate text-[14px] font-semibold text-[#111827]" suppressHydrationWarning>
        {subject}
      </span>
      <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />
    </div>
  );
}

function ReportEmail({ email, month }: { email: Scene["email"]; month: string }) {
  return (
    <div className="hero-email-wrap absolute inset-x-0 bottom-0 z-[70]">
      <div className="hero-email hero-email-open overflow-hidden rounded-xl">
        <EmailHeader unread={false} />
        <div className="px-4 pb-3.5">
          <EmailSubject subject={email.subject} />
          <div className="mt-2.5 border-t border-[#e5e7eb] pt-2.5 text-[12.5px] leading-relaxed text-[#374151]">
            <p>
              {email.before}
              <span className="font-semibold text-[#111827]">{email.figure}</span>
              {email.after}
            </p>
            <p className="mt-2 text-[#6b7280]">
              Kind regards,
              <br />
              Your accountant
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-2">
            <span className="flex h-7 w-6 items-center justify-center rounded-[3px] bg-[#dc2626] text-[7px] font-bold text-white">
              PDF
            </span>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium text-[#111827]" suppressHydrationWarning>
                {month} Insights Report.pdf
              </div>
              <div className="text-[10px] text-[#6b7280]">6 pages · 284 KB</div>
            </div>
          </div>
        </div>
      </div>
      <div className="hero-email hero-email-unread absolute inset-x-0 bottom-0 overflow-hidden rounded-xl">
        <EmailHeader unread />
        <div className="px-4 pb-3.5">
          <EmailSubject subject={email.subject} />
          <p className="truncate pt-0.5 text-[11.5px] text-[#6b7280]">{email.preview}</p>
        </div>
      </div>
    </div>
  );
}

// ── The panel ─────────────────────────────────────────────────────────────────────
const STEPS: { label: string; phases: StoryPhase[] }[] = [
  { label: "Chaos", phases: ["chaos"] },
  { label: "Order", phases: ["order"] },
  { label: "Decision", phases: ["arriving", "decision", "leaving"] },
];

export function HeroStory() {
  const narrow = useNarrowScreen();
  const timing = narrow ? TIMING.narrow : TIMING.wide;
  const { observeRef, phase, scene, looped, paused, reduce } = useStoryTimeline(timing);
  const dates = useMemo(() => computeStoryDates(), []);
  const scenes = useMemo(() => buildScenes(dates), [dates]);
  const s = scenes[scene];
  const txCount = timing.txCounts[scene];
  const statement = useMemo(() => buildStatement(s.pool, scene + 1, txCount), [s.pool, scene, txCount]);
  const { ref: tiltRef, rotateX, rotateY, lift, scale, onMouseMove, onMouseLeave } =
    use3DTilt<HTMLDivElement>({ maxTiltDeg: 3 });

  const pile = [
    <ReceiptSlip key="receipt" r={s.receipt} />,
    <PhoneNotification key="reminder" n={s.reminder} />,
    <BankStatement key="bank" rows={s.bank} />,
    <InvoiceDoc key="invoice" inv={s.invoice} />,
    <PhoneNotification key="message" n={s.message} />,
    <PayslipDoc key="payslip" p={s.payslip} period={dates.period} />,
    <SmallSlip key="parking" title="PARKING" lines={[["Menlyn P3", "R 45.00"], ["2h 14m", "PAID"]]} />,
    <StickyNote key="sticky" text={s.sticky} />,
    <PhoneNotification key="mail" n={s.mail} />,
    <SmallSlip key="card" title="CARD SLIP" lines={[["Purchase", "R 1 250.00"], ["Ref", "??"]]} />,
    <PhoneNotification
      key="calendar"
      n={{ app: "Calendar", time: "08:30", title: "EMP201 payment", body: `Due ${dates.emp201Due}` }}
    />,
  ];

  let narrowIndex = 0;

  return (
    <div ref={observeRef} className="hero-story" data-paused={paused || undefined}>
      <motion.div
        ref={tiltRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ rotateX, rotateY, y: lift, scale, transformPerspective: 1200 }}
        className="hero-story-card tilt-card premium-card relative overflow-hidden rounded-2xl border-[0.5px] border-white/10 bg-card/80 p-4 shadow-2xl sm:p-5"
        role="figure"
        aria-label="Example: a month of receipts, bank lines, payslips, overdue invoices and SARS reminders piles up, then the month's transactions are reconciled and the returns filed, and the month's Insights Report arrives by email with one recommendation to discuss at your review. Shown on the Pro package, which reports monthly. Figures are for illustration."
      >
        <div aria-hidden className="pointer-events-none absolute -inset-16 z-0 rounded-full bg-primary/10 blur-3xl" />

        {/* Header: the three beats */}
        <div aria-hidden className="relative z-50 mb-3 flex items-center justify-between gap-3">
          <ol className="flex items-center gap-1 text-[11px] font-semibold">
            {STEPS.map((step, i) => {
              const active = step.phases.includes(phase);
              return (
                <li key={step.label} className="flex items-center gap-1">
                  {i > 0 && <span className="px-0.5 text-muted-foreground/50">→</span>}
                  <span
                    className="relative rounded-full px-2.5 py-1"
                    style={{ color: active ? "var(--foreground)" : "var(--muted-foreground)" }}
                  >
                    {active && (
                      <motion.span
                        layoutId="hero-story-step"
                        className="absolute inset-0 -z-10 rounded-full border border-white/15 bg-white/[0.06]"
                        transition={{ duration: 0.5, ease: EASE }}
                      />
                    )}
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="shrink-0 rounded-md border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Example
          </div>
        </div>

        {/* Stage. Every beat is a CSS transition keyed off data-phase (globals.css,
            "Hero story"); a new scene remounts it so the next pile arrives fresh. */}
        <div aria-hidden className="relative z-10 h-[440px] sm:h-[390px]">
          <div key={scene} className="hero-stage absolute inset-0" data-phase={phase}>
            {/* Chaos: the pile. The first story opens on it already built. */}
            {!reduce && (
              <div className="hero-pile" data-arrive={looped || undefined}>
                {PILE.map((slot, i) => (
                  <div
                    key={slot.piece}
                    className={`hero-pile-slot${slot.narrow ? "" : " hero-pile-wide"}${slot.back ? " hero-pile-back" : ""}`}
                    style={slotVars(slot, i, slot.narrow ? narrowIndex++ : 0)}
                  >
                    <div className="hero-pile-card">
                      <div className="hero-pile-piece" style={{ animationDelay: `${-(i % 4) * 1.4}s` }}>
                        {pile[slot.piece]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Ledger
              statement={statement}
              month={dates.month}
              filed={s.filed}
              phase={phase}
              perTx={timing.perTx}
            />

            <ReportEmail email={s.email} month={dates.month} />
          </div>
        </div>

        {/* Footnote */}
        <div className="relative z-50 mt-3 flex items-center gap-1.5 text-[11px] sm:text-[10px] text-muted-foreground">
          <Info className="h-3 w-3 shrink-0" />
          <span>
            Example figures. Shown on Pro, which reports monthly.
          </span>
          <span className="ml-auto truncate">{s.business}</span>
        </div>
      </motion.div>
    </div>
  );
}
