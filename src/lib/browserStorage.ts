type StorageReader = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readMigratedStorageValue(
  storage: StorageReader,
  key: string,
  legacyKeys: string[]
): string | null {
  const current = storage.getItem(key);
  if (current) return current;

  for (const legacyKey of legacyKeys) {
    const legacy = storage.getItem(legacyKey);
    if (!legacy) continue;
    storage.setItem(key, legacy);
    storage.removeItem(legacyKey);
    return legacy;
  }

  return null;
}
