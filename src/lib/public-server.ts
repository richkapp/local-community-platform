export async function publicRecordExists(
  table: string,
  column: string,
  value: string,
): Promise<boolean | null> {
  const baseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey || baseUrl.includes('example.supabase.co')) return null;

  const url = new URL(`/rest/v1/${table}`, baseUrl);
  url.searchParams.set('select', column);
  url.searchParams.set(column, `eq.${value}`);
  url.searchParams.set('limit', '1');

  try {
    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
    if (!response.ok) return null;
    const rows = await response.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    console.error('[route-existence-check]', error);
    return null;
  }
}
