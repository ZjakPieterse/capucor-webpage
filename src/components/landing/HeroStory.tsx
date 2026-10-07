"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, Check, Info, Landmark, ListTodo, Mail, MessageCircle, Paperclip } from "lucide-react";
import { use3DTilt } from "@/hooks/use3DTilt";
import { signatureFont } from "@/lib/fonts";

// ── The hero story ────────────────────────────────────────────────────────────────
// One owner's month told in three beats:
//   chaos    → the pile builds: till slips, bank lines, SARS reminders, a message
//              from home, an overdue invoice, a payslip, a sticky note
//   order    → the month's transactions are reconciled one by one, then the
//              returns are filed
//   decision → the month's report arrives by email with one plain recommendation,
//              to talk through at the owner's next review
// Then it fades to the next owner's story, and it pauses while hovered so the
// email can be read. Every figure, name and business is invented and the panel
// says so twice (static "Example" badge and footnote), as decided for the hero
// panel in website-v2 (Zjak, 2026-10-05). The decision arrives as an email, not a
// chat, so the panel doesn't promise instant replies.

type StoryPhase = "chaos" | "order" | "arriving" | "decision";

/** Lines reconciled in the order beat, one count per story. */
const TX_COUNTS = [23, 29, 18];
/** Pace of the order beat: one statement line every PER_TX_MS. */
const PER_TX_MS = 140;
const ROW_PX = 26;

/** The order beat lasts as long as its statement takes, plus time for the filed chips. */
function phaseMs(phase: StoryPhase, scene: number): number {
  switch (phase) {
    case "chaos":
      return 4800;
    case "order":
      return TX_COUNTS[scene] * PER_TX_MS + 1700;
    case "arriving":
      return 1300;
    case "decision":
      return 7500;
  }
}

const NEXT_PHASE: Record<StoryPhase, StoryPhase | null> = {
  chaos: "order",
  order: "arriving",
  arriving: "decision",
  decision: null,
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

function computeStoryDates(): StoryDates {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const vat = new Date(now.getFullYear(), now.getMonth() + (now.getDate() > 25 ? 1 : 0), 25);
  const emp = new Date(now.getFullYear(), now.getMonth() + (now.getDate() > 7 ? 1 : 0), 7);
  return {
    month: MONTH_FULL[prev.getMonth()],
    period: `${MONTH_SHORT[prev.getMonth()]} ${prev.getFullYear()}`,
    vatDue: `25 ${MONTH_FULL[vat.getMonth()]}`,
    emp201Due: `7 ${MONTH_FULL[emp.getMonth()]}`,
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
        subject: `${d.month} report: cash covers 4.2 months`,
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
        subject: `${d.month} report: margin held at 38%`,
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
        subject: `${d.month} report: R 60 500 is 60+ days late`,
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
    const value = income
      ? 2000 + rand() * 60000
      : desc === "SALARIES"
        ? 40000 + rand() * 150000
        : 120 + rand() * 18000;
    return {
      id: i,
      date: String(1 + Math.floor((i * 30) / count)).padStart(2, "0"),
      desc,
      amount: `${income ? "+" : "−"}${formatRand(value)}`,
    };
  });
}

// ── Timeline ─────────────────────────────────────────────────────────────────────
function useStoryTimeline(paused: boolean) {
  const reduce = useReducedMotion();
  const observeRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<StoryPhase>("chaos");
  const [scene, setScene] = useState(0);
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
    if (reduce || !inView || !pageVisible || paused) return;
    const timer = setTimeout(() => {
      const next = NEXT_PHASE[phase];
      if (next) {
        setPhase(next);
      } else {
        setScene((s) => (s + 1) % 3);
        setPhase("chaos");
      }
    }, phaseMs(phase, scene));
    return () => clearTimeout(timer);
  }, [phase, scene, inView, pageVisible, paused, reduce]);

  return {
    observeRef,
    phase: reduce ? ("decision" as const) : phase,
    scene: reduce ? 0 : scene,
    reduce: !!reduce,
  };
}

/** Counts 0 → `total` over `ms` while `running`; reads `total` otherwise. */
function useCounter(running: boolean, ms: number, total: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    const id = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      setN(Math.floor(t * total));
      if (t >= 1) clearInterval(id);
    }, 40);
    return () => {
      clearInterval(id);
      setN(0);
    };
  }, [running, ms, total]);
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
    <div className="hero-shadow rounded-[14px] border border-white/10 bg-[rgba(52,56,66,0.8)] px-3 py-2 backdrop-blur-xl">
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
// paper lies at a slight angle. Depth 1 sits a little further back and dimmer.
const PILE = [
  { left: 2, top: 1, width: "36%", rotate: -3, depth: 1 },
  { left: 54, top: 0, width: "44%", rotate: 0, depth: 0 },
  { left: 22, top: 22, width: "58%", rotate: 0.6, depth: 0 },
  { left: 63, top: 34, width: "35%", rotate: 3, depth: 1 },
  { left: 1, top: 42, width: "44%", rotate: 0, depth: 0 },
  { left: 33, top: 56, width: "35%", rotate: -1.5, depth: 1 },
  { left: 40, top: 10, width: "24%", rotate: 4, depth: 1 },
  { left: 3, top: 66, width: "27%", rotate: -5, depth: 0 },
  { left: 52, top: 63, width: "46%", rotate: 0, depth: 0 },
  { left: 72, top: 54, width: "25%", rotate: 6, depth: 1 },
  { left: 24, top: 80, width: "46%", rotate: 0, depth: 0 },
];

// ── The panel ─────────────────────────────────────────────────────────────────────
const STEPS: { label: string; phases: StoryPhase[] }[] = [
  { label: "Chaos", phases: ["chaos"] },
  { label: "Order", phases: ["order"] },
  { label: "Decision", phases: ["arriving", "decision"] },
];

export function HeroStory() {
  const [hovered, setHovered] = useState(false);
  const { observeRef, phase, scene, reduce } = useStoryTimeline(hovered);
  const dates = computeStoryDates();
  const s = buildScenes(dates)[scene];
  const txCount = TX_COUNTS[scene];
  const statement = buildStatement(s.pool, scene + 1, txCount);
  const { ref: tiltRef, rotateX, rotateY, lift, scale, onMouseMove, onMouseLeave } =
    use3DTilt<HTMLDivElement>({ maxTiltDeg: 3 });

  const ordered = phase !== "chaos";
  const processing = phase === "order";
  const emailIn = phase === "arriving" || phase === "decision";
  const emailOpen = phase === "decision";

  const reconciled = Math.min(txCount, useCounter(processing, txCount * PER_TX_MS, txCount));
  const allDone = ordered && reconciled >= txCount;
  // Newest first: each reconciled line slides in at the top, so the statement
  // fills from empty rather than emptying out.
  const filled = statement.slice(0, reconciled).reverse();

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

  return (
    <div ref={observeRef}>
      <motion.div
        ref={tiltRef}
        onMouseMove={onMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          onMouseLeave();
        }}
        style={{ rotateX, rotateY, y: lift, scale, transformPerspective: 1200 }}
        className="tilt-card premium-card relative overflow-hidden rounded-2xl border-[0.5px] border-white/10 bg-card/80 p-4 shadow-2xl sm:p-5"
        role="figure"
        aria-label="Example: a month of receipts, bank lines, payslips, overdue invoices and SARS reminders piles up, then the month's transactions are reconciled and the returns filed, and the month's report arrives by email with one recommendation to discuss at your review. Figures are for illustration."
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
                    className="relative rounded-full px-2.5 py-1 transition-colors duration-500"
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

        {/* Stage */}
        <div aria-hidden className="relative z-10 h-[440px] sm:h-[390px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={scene}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, filter: "blur(6px)" }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              {/* Chaos: the pile builds, faster as it goes */}
              {!reduce &&
                pile.map((piece, i) => {
                  const slot = PILE[i];
                  const back = slot.depth === 1;
                  const arrive = 0.1 + i * 0.36 - i * i * 0.011;
                  return (
                    <motion.div
                      key={i}
                      className="absolute"
                      style={{
                        width: slot.width,
                        zIndex: 10 + i,
                        filter: back ? "brightness(0.8)" : undefined,
                      }}
                      initial={{
                        opacity: 0,
                        scale: back ? 0.92 : 1.04,
                        left: `${slot.left}%`,
                        top: `${slot.top + 4}%`,
                        rotate: slot.rotate,
                      }}
                      animate={
                        ordered
                          ? { opacity: 0, scale: 0.5, left: "30%", top: "20%", rotate: 0 }
                          : {
                              opacity: 1,
                              scale: back ? 0.95 : 1,
                              left: `${slot.left}%`,
                              top: `${slot.top}%`,
                              rotate: slot.rotate,
                            }
                      }
                      transition={
                        ordered
                          ? { duration: 0.55, delay: (10 - i) * 0.035, ease: EASE }
                          : { duration: 0.7, delay: arrive, ease: EASE }
                      }
                    >
                      <motion.div
                        animate={ordered ? { y: 0 } : { y: [0, back ? -2 : -3, 0] }}
                        transition={
                          ordered
                            ? { duration: 0.3 }
                            : { duration: 6 + (i % 4) * 0.8, repeat: Infinity, ease: "easeInOut" }
                        }
                      >
                        {piece}
                      </motion.div>
                    </motion.div>
                  );
                })}

              {/* Order: the month's statement, reconciled line by line */}
              <div className="absolute inset-0 flex flex-col gap-2.5">
                <motion.div
                  className="flex min-h-0 flex-1 origin-top flex-col rounded-xl border-[0.5px] border-white/10 bg-background/60 p-3"
                  initial={false}
                  animate={{
                    opacity: ordered ? (emailIn ? 0.35 : 1) : 0,
                    y: ordered ? 0 : 14,
                    scale: emailIn ? 0.97 : 1,
                  }}
                  transition={{ duration: 0.55, delay: processing ? 0.25 : 0, ease: EASE }}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold" suppressHydrationWarning>
                      {dates.month} bank statement
                    </span>
                    <span
                      className="flex items-center gap-1.5 text-[10px] font-semibold tabular-nums transition-colors duration-300"
                      style={{ color: allDone ? "var(--success)" : "var(--muted-foreground)" }}
                    >
                      {allDone && <Check className="h-3 w-3" strokeWidth={3} />}
                      {reconciled} of {txCount} reconciled
                    </span>
                  </div>
                  <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-[width] duration-150 ease-linear"
                      style={{
                        width: `${(reconciled / txCount) * 100}%`,
                        background: "linear-gradient(to right, var(--brand-cyan), var(--success))",
                      }}
                    />
                  </div>
                  <div className="hero-ledger-fade relative min-h-0 flex-1 overflow-hidden">
                    <ul>
                      {filled.map((tx, i) => (
                        <motion.li
                          key={tx.id}
                          className="flex items-center gap-2.5 overflow-hidden rounded-md px-2 font-mono text-[10.5px]"
                          initial={reduce ? false : { opacity: 0, height: 0 }}
                          animate={{
                            opacity: 1,
                            height: ROW_PX,
                            backgroundColor:
                              i === 0 && processing ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0)",
                          }}
                          transition={{ duration: 0.3, ease: EASE }}
                        >
                          <span className="w-4 shrink-0 text-muted-foreground">{tx.date}</span>
                          <span className="truncate text-foreground/85">{tx.desc}</span>
                          <span className="ml-auto shrink-0 whitespace-nowrap text-foreground/90">{tx.amount}</span>
                          <motion.span
                            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                            style={{ background: "color-mix(in oklch, var(--success) 22%, transparent)" }}
                            initial={reduce ? false : { scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 480, damping: 20, delay: 0.15 }}
                          >
                            <Check className="h-2.5 w-2.5 text-success" strokeWidth={3} />
                          </motion.span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </motion.div>

                <motion.div
                  className="flex flex-wrap gap-1.5"
                  initial={false}
                  animate={{ opacity: emailIn ? 0.35 : 1 }}
                  transition={{ duration: 0.6 }}
                >
                  {s.filed.map((label, i) => (
                    <motion.span
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success"
                      initial={false}
                      animate={{ opacity: allDone ? 1 : 0, y: allDone ? 0 : 6, scale: allDone ? 1 : 0.9 }}
                      transition={{ duration: 0.4, delay: allDone && processing ? 0.15 + i * 0.15 : 0, ease: EASE }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                      {label}
                    </motion.span>
                  ))}
                </motion.div>
              </div>

              {/* Decision: the month's report lands in the inbox */}
              <motion.div
                className="hero-email absolute inset-x-0 bottom-0 z-[70] overflow-hidden rounded-xl"
                initial={false}
                animate={{ opacity: emailIn ? 1 : 0, y: emailIn ? 0 : 48 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <div className="flex items-center gap-2.5 px-4 pb-2 pt-3">
                  <div className="gradient-cta flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-primary-foreground">
                    <span className="relative z-[2]">C</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold text-[#111827]">
                        Your accountant · Capucor
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-[#6b7280]">
                        {!emailOpen && <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" />}
                        08:02
                      </span>
                    </div>
                    <div className="text-[10.5px] text-[#6b7280]">to me</div>
                  </div>
                </div>
                <div className="px-4 pb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold text-[#111827]" suppressHydrationWarning>
                      {s.email.subject}
                    </span>
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />
                  </div>
                  <motion.div
                    initial={false}
                    animate={{ height: emailOpen ? 0 : "auto", opacity: emailOpen ? 0 : 1 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <p className="truncate pt-0.5 text-[11.5px] text-[#6b7280]">{s.email.preview}</p>
                  </motion.div>
                  <motion.div
                    initial={false}
                    animate={{ height: emailOpen ? "auto" : 0, opacity: emailOpen ? 1 : 0 }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2.5 border-t border-[#e5e7eb] pt-2.5 text-[12.5px] leading-relaxed text-[#374151]">
                      <p>
                        {s.email.before}
                        <span className="font-semibold text-[#111827]">{s.email.figure}</span>
                        {s.email.after}
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
                          {dates.month} management report.pdf
                        </div>
                        <div className="text-[10px] text-[#6b7280]">6 pages · 284 KB</div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footnote */}
        <div className="relative z-50 mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Info className="h-3 w-3 shrink-0" />
          Example figures for illustration.
          <span className="ml-auto truncate">{s.business}</span>
        </div>
      </motion.div>
    </div>
  );
}
