'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Check, Type, PenLine, Upload, Eraser, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SignProposalSchema } from '@/lib/validations';
import { signatureFont } from '@/lib/fonts';
import { siteConfig } from '@/config/site';

type SignMethod = 'typed' | 'drawn' | 'uploaded';

// Local schema for the printed-name field only; the full payload (incl. the
// generated image) is validated against SignProposalSchema before posting.
const NameSchema = z.object({
  signatureName: z.string().min(2, 'Please type your full name').max(120, 'Name is too long'),
});
type NameValues = z.infer<typeof NameSchema>;

const CANVAS_W = 600;
const CANVAS_H = 200;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // pre-downscale guard
const UPLOAD_MAX_WIDTH = 600;

const METHODS: { value: SignMethod; label: string; icon: typeof Type }[] = [
  { value: 'typed', label: 'Type', icon: Type },
  { value: 'drawn', label: 'Draw', icon: PenLine },
  { value: 'uploaded', label: 'Upload', icon: Upload },
];

export function ProposalSignForm({
  token,
  defaultName,
}: {
  token: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<SignMethod>('typed');
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Drawn signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  // Uploaded signature (already normalised to a PNG data URL)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');

  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<NameValues>({
    resolver: zodResolver(NameSchema),
    mode: 'onTouched',
    defaultValues: { signatureName: defaultName ?? '' },
  });
  // Mirror the name field into local state so the typed preview stays reactive
  // without RHF's watch() (which the React Compiler can't memoize safely).
  const [typedName, setTypedName] = useState(defaultName ?? '');
  const nameField = register('signatureName');

  // Paint a fresh white canvas + reset the pen. Baking a white background into
  // the bitmap means the exported PNG reads on any theme (and in email).
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    hasDrawnRef.current = false;
  }, []);

  useEffect(() => {
    if (method === 'drawn') initCanvas();
  }, [method, initCanvas]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Tiny segment so a single tap leaves a visible dot.
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    hasDrawnRef.current = true;
    setFormError(null);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }

  function changeMethod(next: SignMethod) {
    setMethod(next);
    setFormError(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError('');
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setUploadError('Please upload a PNG or JPG image.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('That image is too large. Please use one under 8 MB.');
      return;
    }
    try {
      setUploadedImage(await normalizeImageFile(file));
    } catch {
      setUploadError('We could not read that image. Please try another.');
    }
  }

  async function buildSignatureImage(name: string): Promise<string | null> {
    if (method === 'typed') return renderTypedSignature(name);
    if (method === 'drawn') {
      if (!hasDrawnRef.current) {
        setFormError('Please draw your signature in the box.');
        return null;
      }
      return canvasRef.current?.toDataURL('image/png') ?? null;
    }
    if (!uploadedImage) {
      setUploadError('Please choose an image of your signature.');
      return null;
    }
    return uploadedImage;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nameOk = await trigger('signatureName');
    if (!nameOk) return;
    if (!consentGiven) {
      setConsentError('Please confirm before signing.');
      return;
    }
    setConsentError('');

    const name = getValues('signatureName').trim();

    let imageDataUrl: string | null;
    try {
      imageDataUrl = await buildSignatureImage(name);
    } catch {
      setFormError('We could not prepare your signature. Please try again.');
      return;
    }
    if (!imageDataUrl) return; // method-specific error already set

    const payload = {
      token,
      signatureName: name,
      method,
      imageDataUrl,
      consentGiven: true as const,
      website: '',
    };
    const parsed = SignProposalSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please check your details and try again.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/proposals/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? 'We could not record your signature. Please try again.');
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold">Thanks — that&rsquo;s signed</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          We&rsquo;ve recorded your acceptance and emailed you a confirmation. Someone from the
          Capucor team will be in touch shortly to start your onboarding.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.03] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <PenLine className="h-4 w-4 text-primary" />
        Sign &amp; accept
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Type, draw, or upload your signature to accept this proposal. No payment is required to get
        started.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        {/* Method chooser */}
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => {
            const active = method === m.value;
            return (
              <Button
                key={m.value}
                type="button"
                variant={active ? 'default' : 'outline'}
                aria-pressed={active}
                onClick={() => changeMethod(m.value)}
                className="gap-1.5"
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </Button>
            );
          })}
        </div>

        {/* Printed name (all methods) */}
        <div>
          <Label htmlFor="signatureName" className="mb-1.5 block text-sm">
            Full name
          </Label>
          <Input
            id="signatureName"
            type="text"
            autoComplete="name"
            placeholder="As it should appear on the agreement"
            aria-invalid={errors.signatureName ? 'true' : undefined}
            {...nameField}
            onChange={(e) => {
              nameField.onChange(e);
              setTypedName(e.target.value);
            }}
          />
          {errors.signatureName && (
            <p className="mt-1 text-xs text-destructive">{errors.signatureName.message}</p>
          )}
        </div>

        {/* Method-specific input */}
        {method === 'typed' && (
          <div>
            <Label className="mb-1.5 block text-sm">Preview</Label>
            <div className="flex min-h-[96px] items-center justify-center overflow-hidden rounded-lg border border-input bg-white px-4">
              <span
                className={`${signatureFont.className} text-5xl leading-none text-slate-900`}
                aria-hidden={!typedName}
              >
                {typedName?.trim() ? typedName : 'Your signature'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Your typed name becomes your signature.
            </p>
          </div>
        )}

        {method === 'drawn' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="block text-sm">Draw your signature</Label>
              <Button type="button" variant="ghost" size="sm" onClick={initCanvas} className="gap-1.5">
                <Eraser className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="w-full touch-none rounded-lg border border-input bg-white"
              style={{ aspectRatio: '3 / 1' }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use your mouse, trackpad, or finger.
            </p>
          </div>
        )}

        {method === 'uploaded' && (
          <div>
            <Label htmlFor="signatureUpload" className="mb-1.5 block text-sm">
              Upload an image (PNG or JPG)
            </Label>
            <Input
              id="signatureUpload"
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFile}
              aria-invalid={uploadError ? 'true' : undefined}
            />
            {uploadedImage && (
              <div className="mt-2 flex items-center justify-center overflow-hidden rounded-lg border border-input bg-white p-2">
                {/* Local preview of the user's own normalised image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedImage} alt="Your signature" className="max-h-24" />
              </div>
            )}
            {uploadError && <p className="mt-1 text-xs text-destructive">{uploadError}</p>}
          </div>
        )}

        {/* Affirmation */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="sign-consent"
              checked={consentGiven}
              onCheckedChange={(val) => {
                setConsentGiven(val === true);
                if (val) setConsentError('');
              }}
              className="mt-0.5"
              aria-required="true"
              aria-describedby={consentError ? 'sign-consent-error' : undefined}
            />
            <Label
              htmlFor="sign-consent"
              className="cursor-pointer text-sm leading-relaxed text-muted-foreground"
            >
              I agree to this proposal and its terms, and I accept the signature above as my
              electronic signature.
            </Label>
          </div>
          {consentError && (
            <p id="sign-consent-error" className="pl-7 text-sm text-destructive">
              {consentError}
            </p>
          )}
        </div>

        {formError && (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {formError}
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="gradient-cta w-full gap-2"
        >
          <span className="relative z-[2] inline-flex items-center gap-2">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Recording your signature...
              </>
            ) : (
              <>
                <PenLine className="h-4 w-4" />
                Sign &amp; accept proposal
              </>
            )}
          </span>
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-primary" />
          Prefer to talk first?{' '}
          <a
            href={siteConfig.links.booking}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Book a call
          </a>
        </p>
      </form>
    </div>
  );
}

// ── Image helpers (browser-only; this is a client component) ──────────────

async function renderTypedSignature(name: string): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const family = signatureFont.style.fontFamily;
  // Make sure the handwriting face is loaded before we measure/draw it.
  try {
    await document.fonts.load(`64px ${family}`);
    await document.fonts.ready;
  } catch {
    /* fall back to the generic the family list already includes */
  }

  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let size = 72;
  ctx.font = `600 ${size}px ${family}`;
  while (size > 24 && ctx.measureText(name).width > CANVAS_W - 48) {
    size -= 4;
    ctx.font = `600 ${size}px ${family}`;
  }
  ctx.fillText(name, CANVAS_W / 2, CANVAS_H / 2);
  return canvas.toDataURL('image/png');
}

function normalizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const scale = Math.min(1, UPLOAD_MAX_WIDTH / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas unavailable'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
