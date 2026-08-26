import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RENDER_COLORS } from '@/config/renderColors';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('non-CSS renderer colours', () => {
  it('mirrors the adopted dark-theme values used by non-CSS surfaces', () => {
    expect(RENDER_COLORS.dark).toEqual({
      background: '#020618',
      foreground: '#f8fafc',
      mutedForeground: '#90a1b9',
      primary: '#2dd4ff',
    });
  });

  it('keeps OG and signature canvas hex literals behind the shared module', () => {
    const ogRoute = source('src/app/api/og/route.tsx');
    const proposalSignForm = source('src/components/proposal/ProposalSignForm.tsx');

    expect(ogRoute).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(proposalSignForm).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it('routes the accent cyan through the existing CSS token in feature components', () => {
    const hero = source('src/components/landing/HeroSection.tsx');
    const miniDashboards = source('src/components/services/ServiceMiniDashboards.tsx');

    expect(hero).not.toMatch(/#22d3ee/i);
    expect(miniDashboards).not.toMatch(/#22d3ee/i);
    expect(hero).toContain('var(--brand-cyan)');
    expect(miniDashboards).toContain('var(--brand-cyan)');
  });
});
