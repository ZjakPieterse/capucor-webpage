import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'scripts/apps-script/archive-proposal.gs'),
  'utf8',
);

describe('Apps Script proposal archive idempotency', () => {
  it('serialises ambiguous retry handling with a script lock', () => {
    expect(source).toContain('LockService.getScriptLock()');
    expect(source).toContain('lock.waitLock(20000)');
    expect(source).toContain('lock.releaseLock()');
  });

  it('looks up the stable filename before creating a Drive file', () => {
    expect(source.indexOf('Drive.Files.list')).toBeLessThan(
      source.indexOf('Drive.Files.create'),
    );
    expect(source).toContain("name = '");
    expect(source).toContain('reused: true');
  });

  it('records the proposal id as Drive application metadata', () => {
    expect(source).toContain('capucorProposalId');
  });
});
