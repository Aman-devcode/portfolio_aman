import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AI chat accessibility contract', () => {
  it('does not aria-hide the Ask Aman AI trigger when the dialog is closed', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/ai/components/AIChatWidget.tsx'), 'utf8');
    expect(source).not.toContain('aria-hidden={!open}');
    expect(source).toContain('<AIChatButton');
  });
});
