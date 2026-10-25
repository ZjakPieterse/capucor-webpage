'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface ConsentCheckboxProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  error?: string;
  // What the visitor is consenting to be contacted about (default: an enquiry).
  subject?: string;
}

export function ConsentCheckbox({
  id = 'consent',
  checked,
  onCheckedChange,
  error,
  subject = 'this enquiry',
}: ConsentCheckboxProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(val) => onCheckedChange?.(val === true)}
          // 44 px hit area round the 16 px box; the label toggles it too.
          className="mt-0.5 after:-inset-[15px]"
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Label htmlFor={id} className="block text-sm text-muted-foreground leading-relaxed cursor-pointer">
          I consent to Capucor Business Solutions contacting me about {subject}{' '}
          in accordance with{' '}
          <Link href="/privacy" className="text-primary underline underline-offset-2 hover:no-underline">
            POPIA
          </Link>
          .
        </Label>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive pl-7">
          {error}
        </p>
      )}
    </div>
  );
}
