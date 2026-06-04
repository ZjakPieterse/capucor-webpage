import { z } from 'zod';

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
