type PublicRecordLookupOptions = {
  baseUrl?: string;
  anonKey?: string;
  fetcher?: typeof fetch;
  onError?: (message: string, error: unknown) => void;
};

export async function publicRecordExistsWithConfig(
  table: string,
  column: string,
  value: string,
  {
    baseUrl,
    anonKey,
    fetcher = fetch,
    onError = (message, error) => console.error(message, error)
  }: PublicRecordLookupOptions
): Promise<boolean | null> {
  if (!baseUrl || !anonKey || baseUrl.includes('example.supabase.co')) return null;

  const url = new URL(`/rest/v1/${table}`, baseUrl);
  url.searchParams.set('select', column);
  url.searchParams.set(column, `eq.${value}`);
  url.searchParams.set('limit', '1');

  try {
    const response = await fetcher(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    });
    if (!response.ok) return null;
    const rows = await response.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    onError('[route-existence-check]', error);
    return null;
  }
}

export async function publicRecordExists(
  table: string,
  column: string,
  value: string
): Promise<boolean | null> {
  return publicRecordExistsWithConfig(table, column, value, {
    baseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
    anonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  });
}
