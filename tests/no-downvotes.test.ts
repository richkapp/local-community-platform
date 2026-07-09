import { expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return files(path);
    return path;
  });
}

test('product does not introduce downvote behavior', () => {
  const searchable = [
    ...files('src'),
    ...files('supabase').filter((file) => file.endsWith('.sql') || file.endsWith('.ts'))
  ];

  const offenders = searchable.filter((file) => readFileSync(file, 'utf8').toLowerCase().includes('downvote'));
  expect(offenders).toEqual([]);
});
