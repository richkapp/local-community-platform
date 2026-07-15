import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export function files(directory: string, include: (path: string) => boolean = () => true): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path, include);
    return include(path) ? [path] : [];
  });
}