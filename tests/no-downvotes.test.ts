import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { files } from './helpers/files';

test('product does not introduce downvote behavior', () => {
  const searchable = [
    ...files('src'),
    ...files('supabase', (file) => file.endsWith('.sql') || file.endsWith('.ts'))
  ];

  const offenders = searchable.filter((file) => readFileSync(file, 'utf8').toLowerCase().includes('downvote'));
  expect(offenders).toEqual([]);
});
