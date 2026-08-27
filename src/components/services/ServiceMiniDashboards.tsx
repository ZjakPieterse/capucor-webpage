'use client';

import { motion } from 'motion/react';
import {
  CheckCircle2,
  Clock3,
  Landmark,
  ArrowDownRight,
  Sparkles,
  ShieldCheck,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { use3DTilt } from '@/hooks/use3DTilt';

const tileVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.08, duration: 0.35 },
  }),
};

function Header({ eyebrow, status }: { eyebrow: string; status: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
          {eyebrow}
        </div>
        <div className="text-sm font-bold tracking-tight mt-0.5">
          March 2026 close
        </div>
      </div>
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-success"
        style={{ background: 'var(--success-soft)' }}
      >
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-success"
          style={{ boxShadow: '0 0 5px var(--success)' }}
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        {status}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { ref, rotateX, rotateY, lift, scale, onMouseMove, onMouseLeave } =
    use3DTilt<HTMLDivElement>();

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        rotateX,
        rotateY,
        y: lift,
        scale,
        transformPerspective: 1200,
        transformStyle: 'preserve-3d',
      }}
      className="fcc-grid fcc-container tilt-card premium-card relative rounded-2xl border-[0.5px] border-white/10 bg-card/80 shadow-2xl p-5 overflow-hidden transition-[border-color,box-shadow,background-color] duration-500"
    >
      {children}
    </motion.div>
  );
}

// ── Bookkeeping ──────────────────────────────────────────────────────────────
export function BookkeepingDashboard() {
  const rows = [
    { who: 'Cape Town Bank · Cheque', amount: '−R 12,450', tag: 'Suppliers', status: 'Matched' },
    { who: 'Sage Pay payout', amount: '+R 38,200', tag: 'Revenue', status: 'Matched' },
    { who: 'Takealot Express', amount: '−R 1,985', tag: 'Logistics', status: 'Categorised' },
    { who: 'FNB card · Engen', amount: '−R 845', tag: 'Vehicle', status: 'Categorised' },
  ];
  return (
    <Shell>
      <Header eyebrow="Bank reconciliation" status="In sync" />
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <motion.div
            key={r.who}
            custom={i}
            variants={tileVariants}
            initial="hidden"
            animate="visible"
            className="fcc-tile rounded-xl border border-border bg-background/40 px-3.5 py-3 flex items-center gap-3"
          >
            <Landmark className="h-4 w-4 shrink-0 text-primary/80" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate">{r.who}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{r.tag}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono font-bold text-xs whitespace-nowrap">{r.amount}</div>
              <div className="text-[10px] mt-0.5 text-success">{r.status}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div
        custom={5}
        variants={tileVariants}
        initial="hidden"
        animate="visible"
        className="mt-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5"
        style={{ border: '1px solid var(--success-border)', background: 'var(--success-soft)' }}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        <span className="text-xs font-medium">All accounts reconciled. Ledger sealed.</span>
      </motion.div>
    </Shell>
  );
}

// ── Accounting ───────────────────────────────────────────────────────────────
export function AccountingDashboard() {
  return (
    <Shell>
      <Header eyebrow="Management pack" status="Signed off" />
      <div className="grid grid-cols-3 gap-2.5">
        <motion.div
          custom={0}
          variants={tileVariants}
          initial="hidden"
          animate="visible"
          className="fcc-tile rounded-xl border border-border bg-background/40 p-3.5"
        >
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Revenue
          </div>
          <div className="font-mono font-bold text-lg leading-none">R 1.42m</div>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-success" />
            <span className="text-[11px] font-medium text-success">+8.4%</span>
          </div>
        </motion.div>
        <motion.div
          custom={1}
          variants={tileVariants}
          initial="hidden"
          animate="visible"
          className="fcc-tile rounded-xl border border-border bg-background/40 p-3.5"
        >
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Gross margin
          </div>
          <div className="font-mono font-bold text-lg leading-none">38.6%</div>
          <div className="flex items-center gap-1 mt-2">
            <ArrowDownRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--warning)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--warning)' }}>−1.2pt</span>
          </div>
        </motion.div>
        <motion.div
          custom={2}
          variants={tileVariants}
          initial="hidden"
          animate="visible"
          className="fcc-tile rounded-xl border border-border bg-background/40 p-3.5"
        >
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Net cash
          </div>
          <div className="gradient-stat font-mono font-bold text-lg leading-none">R 612k</div>
          <div className="text-[10px] text-muted-foreground mt-2">After SARS provisions</div>
        </motion.div>
      </div>

      <motion.div
        custom={3}
        variants={tileVariants}
        initial="hidden"
        animate="visible"
        className="mt-3 rounded-xl border border-border bg-background/40 p-3.5"
      >
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Items flagged for the owner
        </div>
        <ul className="space-y-1.5">
          {[
            'Debtor days drifted from 28 to 41. One client at 92.',
            'Provisional tax estimate: R 96,500. Due 31 Aug.',
            'Lease renewal in 60 days. Modelled at +12%.',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Sparkles className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
              <span className="text-xs leading-snug">{line}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div
        custom={4}
        variants={tileVariants}
        initial="hidden"
        animate="visible"
        className="mt-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5"
        style={{ border: '1px solid var(--success-border)', background: 'var(--success-soft)' }}
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
        <span className="text-xs font-medium">
          Reviewed and signed off by a SAICA-registered accountant.
        </span>
      </motion.div>
    </Shell>
  );
}

// ── Payroll ──────────────────────────────────────────────────────────────────
export function PayrollDashboard() {
  return (
    <Shell>
      <Header eyebrow="Monthly payroll run" status="Submitted" />
      <motion.div
        custom={0}
        variants={tileVariants}
        initial="hidden"
        animate="visible"
        className="fcc-tile rounded-xl border border-border bg-background/40 p-3.5 mb-2.5"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Sample payslip
            </div>
            <div className="text-sm font-semibold mt-0.5">P. Naidoo, Sales Manager</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Net pay</div>
            <div className="font-mono font-bold text-base text-success">R 32,184</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
          <div>
            <div className="text-[10px] text-muted-foreground">Gross</div>
            <div className="font-mono text-xs font-semibold">R 42,500</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">PAYE</div>
            <div className="font-mono text-xs font-semibold">R 9,491</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">UIF</div>
            <div className="font-mono text-xs font-semibold">R 177</div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-2.5">
        <motion.div
          custom={1}
          variants={tileVariants}
          initial="hidden"
          animate="visible"
          className="fcc-tile rounded-xl border border-border bg-background/40 p-3.5"
        >
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            EMP201
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            <span className="text-xs font-semibold">Submitted</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">Reference 21/03/2026</div>
        </motion.div>
        <motion.div
          custom={2}
          variants={tileVariants}
          initial="hidden"
          animate="visible"
          className="fcc-tile rounded-xl border border-border bg-background/40 p-3.5"
        >
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Payslips
          </div>
          <div className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4 shrink-0" style={{ color: 'var(--brand-cyan)' }} />
            <span className="text-xs font-semibold">8 of 8 delivered</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">Emailed to each employee</div>
        </motion.div>
      </div>

      <motion.div
        custom={3}
        variants={tileVariants}
        initial="hidden"
        animate="visible"
        className="mt-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5"
        style={{ border: '1px solid var(--success-border)', background: 'var(--success-soft)' }}
      >
        <Clock3 className="h-4 w-4 shrink-0 text-success" />
        <span className="text-xs font-medium">
          UIF and PAYE paid on the dates SARS expects.
        </span>
      </motion.div>
    </Shell>
  );
}
