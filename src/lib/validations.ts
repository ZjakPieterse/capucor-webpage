import { z } from 'zod';
import { CLIENT_TYPES } from '@/config/clientTypes';

// Calculator state snapshot persisted with a lead. The shape mirrors what the
// pricing calculator writes when a visitor submits a quote/signup/enterprise
// request — tighten here means we reject anything that doesn't match.
export const CalculatorConfigSchema = z.object({
  services: z.array(z.string().min(1)).max(20),
  brackets: z.record(
    z.string(),
    z.union([z.number().int().nonnegative(), z.literal('enterprise')])
  ),
  tier: z.string().min(1).max(50).optional().nullable(),
  hasEnterprise: z.boolean().optional(),
});

export type CalculatorConfig = z.infer<typeof CalculatorConfigSchema>;

export const LeadSchema = z.object({
  // Keep in sync with the leads.source CHECK constraint (supabase/migrations —
  // last widened in 009 to add 'roi' and 'lead_magnet') and LeadPayload in
  // src/types/index.ts.
  source: z.enum([
    'signup',
    'quote',
    'enterprise',
    'contact',
    'call',
    'proposal',
    'roi',
    'lead_magnet',
  ]),
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Please enter a valid email address'),
  business: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  message: z.string().max(2000).optional(),
  config: CalculatorConfigSchema.optional(),
  consent_given: z.literal(true, {
    message: 'You must consent before submitting.',
  }),
  website: z.string().max(0).optional(), // honeypot — must be empty
});

export type LeadInput = z.infer<typeof LeadSchema>;

export const RevalidateSchema = z.object({
  secret: z.string().min(1),
});

// ── Subscription activation (Step 4 of the calculator) ──────────────────
//
// This schema is the contract between the Step4Activate form and the
// /api/subscriptions endpoint. The endpoint persists the request and
// initialises Paystack (currently a stub — Paystack is not wired yet).

export const BusinessDetailsSchema = z.object({
  legalName: z
    .string()
    .min(2, 'Legal business name is required')
    .max(120, 'Legal business name is too long'),
  cipcNumber: z
    .string()
    .max(40)
    .optional()
    .or(z.literal('')),
  vatNumber: z
    .string()
    .max(20, 'VAT number looks too long')
    .regex(/^[0-9]*$/, 'VAT number must be digits only')
    .optional()
    .or(z.literal('')),
  sector: z
    .string()
    .min(2, 'Pick the sector that fits best')
    .max(80),
});

export const SubscriptionRequestSchema = z.object({
  // Calculator config — note: brackets are integers only here, no enterprise
  services: z.array(z.string().min(1)).min(1, 'Select at least one service'),
  brackets: z.record(z.string(), z.number().int().nonnegative()),
  tierSlug: z.string().min(1, 'Choose a package'),
  // Account
  email: z.string().email('Enter a valid email address'),
  fullName: z.string().min(1, 'Name is required').max(100),
  // Business
  business: BusinessDetailsSchema,
  // Consent + honeypot
  consentGiven: z.literal(true, {
    message: 'You must consent before activating.',
  }),
  website: z.string().max(0).optional(), // honeypot — must be empty
});

export type SubscriptionRequestInput = z.infer<typeof SubscriptionRequestSchema>;

// ── Proposal request (Activate modal of the calculator) ─────────────────
//
// Contract between the ActivateProposalModal form and /api/proposals. The
// endpoint recomputes pricing server-side, stores the contact as a lead, and
// generates a proposal that is emailed to the client + a central Capucor inbox.
// Lighter than SubscriptionRequestSchema by design — Ignition-style: detailed
// business info (CIPC / VAT / sector) is collected later, at proposal sign-off.

export const ProposalRequestSchema = z.object({
  // Calculator config — integer brackets only, no enterprise
  services: z.array(z.string().min(1)).min(1, 'Select at least one service'),
  brackets: z.record(z.string(), z.number().int().nonnegative()),
  tierSlug: z.string().min(1, 'Choose a package'),
  // Optional flat-fee add-ons. The route whitelists slugs against
  // PRICING_ADDONS (config/tiers.ts) before pricing them.
  addons: z.array(z.string().min(1)).max(5).optional().default([]),
  // Contact
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Surname is required').max(80),
  businessName: z.string().min(2, 'Business name is required').max(120),
  email: z.string().email('Enter a valid email address'),
  // Consent + honeypot
  consentGiven: z.literal(true, {
    message: 'You must consent before continuing.',
  }),
  website: z.string().max(0).optional(), // honeypot — must be empty
});

export type ProposalRequestInput = z.infer<typeof ProposalRequestSchema>;

// ── Proposal amend / resend (staff-side, secret-guarded) ─────────────────
//
// Used by the internal "living document" endpoints. These are not public:
// /api/proposals/amend and /api/proposals/resend are gated by ?secret= (the
// same REVALIDATE_SECRET the cron routes use), so they carry no honeypot.

export const ResendProposalSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal id'),
});

export type ResendProposalInput = z.infer<typeof ResendProposalSchema>;

// Amend changes the priced selection (and optionally the contact). The route
// recomputes pricing server-side, supersedes the original, and issues a new
// revision with a fresh token + reference for re-signing.
export const AmendProposalSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal id'),
  services: z.array(z.string().min(1)).min(1, 'Select at least one service'),
  brackets: z.record(z.string(), z.number().int().nonnegative()),
  tierSlug: z.string().min(1, 'Choose a package'),
  addons: z.array(z.string().min(1)).max(5).optional().default([]),
  // Optional contact overrides — default to the original proposal's contact.
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  businessName: z.string().min(2).max(120).optional(),
  email: z.string().email('Enter a valid email address').optional(),
});

export type AmendProposalInput = z.infer<typeof AmendProposalSchema>;

// ── Proposal e-signature (PR7 — /proposal/<token> sign step) ─────────────
//
// Contract between ProposalSignForm and /api/proposals/sign. The signer can
// type, draw, or upload an image of their signature; the client normalises all
// three to a single PNG data URL before posting. We always capture the printed
// legal name alongside the image (POPIA/ECTA audit trail), plus a fresh consent
// affirmation. The opaque proposal token gates the write through the admin client.

// Largest decoded signature image we accept. The client downscales to ~600px,
// so a real signature lands well under this; the cap stops an oversized upload
// from bloating the proposals row. Enforced again server-side by decoded size.
export const MAX_SIGNATURE_BYTES = 512 * 1024;

// Base64 inflates ~4/3, plus the `data:image/png;base64,` prefix. Give the zod
// string cap headroom above MAX_SIGNATURE_BYTES so the precise byte-size check
// in the route (not the char count) is what rejects a too-large image.
const MAX_SIGNATURE_DATA_URL_CHARS = 750_000;

export const SignProposalSchema = z.object({
  token: z.string().min(16, 'This proposal link is invalid.'),
  signatureName: z
    .string()
    .min(2, 'Please type your full name')
    .max(120, 'Name is too long'),
  method: z.enum(['typed', 'drawn', 'uploaded'], {
    message: 'Choose how you would like to sign.',
  }),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg);base64,/, 'Your signature image is invalid.')
    .max(MAX_SIGNATURE_DATA_URL_CHARS, 'Your signature image is too large.'),
  consentGiven: z.literal(true, {
    message: 'Please confirm before signing.',
  }),
  website: z.string().max(0).optional(), // honeypot — must be empty
});

export type SignProposalInput = z.infer<typeof SignProposalSchema>;

// ── Org compliance details (internal client card, admin-only) ───────────
//
// Contract between the OrgDetailsEditor form and updateOrgDetailsAction. The
// internal Organisation card holds a client's compliance master-data; an admin
// edits it. Light format checks (per the field's nature): the SARS reference
// numbers must be 10 digits IF filled, the contact email must be valid; the
// rest are lenient, length-bounded free text. Display name + contact email are
// required (both columns are NOT NULL). Empty optionals become null on write.

const sarsRef = (label: string) =>
  z
    .string()
    .regex(/^\d{10}$/, `${label} must be 10 digits.`)
    .optional()
    .or(z.literal(''));

export const OrgDetailsSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required.')
    .max(120, 'Display name is too long.'),
  legalName: z.string().max(120, 'Legal name is too long.').optional().or(z.literal('')),
  registrationNo: z
    .string()
    .max(40, 'Registration number is too long.')
    .optional()
    .or(z.literal('')),
  address: z.string().max(255, 'Address is too long.').optional().or(z.literal('')),
  incomeTaxNo: sarsRef('Income tax number'),
  vatNo: sarsRef('VAT number'),
  payeNo: sarsRef('PAYE number'),
  uifNo: z.string().max(40, 'UIF number is too long.').optional().or(z.literal('')),
  coidaNo: z.string().max(40, 'COIDA number is too long.').optional().or(z.literal('')),
  primaryContactName: z
    .string()
    .max(120, 'Contact name is too long.')
    .optional()
    .or(z.literal('')),
  primaryContactEmail: z.string().email('Enter a valid contact email address.'),
  // CRM master-data (migration 016). clientType is required (the column is NOT
  // NULL); notes are optional internal free text.
  clientType: z.enum(CLIENT_TYPES),
  notes: z.string().max(2000, 'Notes are too long.').optional().or(z.literal('')),
});

export type OrgDetailsInput = z.infer<typeof OrgDetailsSchema>;

// ── Manual / legacy subscription (admin "Add client" billing block) ──────
//
// A legacy client may be on a plan the live calculator can't express. The create
// form optionally records a free-text plan label + monthly figure + status, and
// createClientAction inserts it as a subscriptions row (services/brackets empty,
// tier_slug 'custom', plan_label set). monthlyZar arrives already converted to a
// number by the form; vat_zar stays 0 (tax handled in Xero — no VAT on the site).
export const ManualSubscriptionSchema = z.object({
  planLabel: z.string().min(1, 'Enter a plan label.').max(80, 'Plan label is too long.'),
  monthlyZar: z
    .number()
    .positive('Enter a monthly amount greater than zero.')
    .max(10_000_000, 'Monthly amount looks too large.'),
  status: z.enum(['active', 'past_due', 'cancelled']),
});

export type ManualSubscriptionInput = z.infer<typeof ManualSubscriptionSchema>;

// ── Create client (admin "Add client" flow) ─────────────────────────────
//
// Contract between CreateClientForm and createClientAction. Reuses every
// OrgDetailsSchema field (display name + contact email required, the rest
// optional) and adds an optional manual subscription. No payment/banking data —
// internal record only.
export const CreateClientSchema = OrgDetailsSchema.extend({
  subscription: ManualSubscriptionSchema.optional(),
});

export type CreateClientInput = z.infer<typeof CreateClientSchema>;

// ── Paystack webhook payload (stub, mirrors Paystack event envelope) ────
//
// Paystack webhooks deliver POST bodies of the shape:
// { event: 'charge.success' | 'subscription.create' | ..., data: { ... } }
// Signed with HMAC-SHA512 in the x-paystack-signature header.
// We keep the envelope loose for now; signature verification + event
// handling will be wired in when Paystack is integrated.

export const PaystackWebhookSchema = z.object({
  event: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

export type PaystackWebhookPayload = z.infer<typeof PaystackWebhookSchema>;

// ── POPIA data-subject request (P1) ─────────────────────────────────────
//
// Submitted by a visitor to exercise their POPIA rights of access or
// deletion. Stored in public.data_requests, then a magic-link confirm step
// verifies the email address before we act.

export const DataRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(254),
  request_type: z.enum(['access', 'delete'], {
    message: 'Choose access or delete.',
  }),
  consent_given: z.literal(true, {
    message: 'You must confirm before submitting.',
  }),
  website: z.string().max(0).optional(), // honeypot — must be empty
});

export type DataRequestInput = z.infer<typeof DataRequestSchema>;
