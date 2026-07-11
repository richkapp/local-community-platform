export function slugify(input: string, maxLength = 90) {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, maxLength)
    .replace(/-+$/g, '');

  return slug || 'builder';
}

export function slugWithRandomSuffix(input: string, suffixLength = 8, maxLength = 100) {
  const suffix = crypto.randomUUID().slice(0, suffixLength);
  const baseMaxLength = Math.max(3, maxLength - suffixLength - 1);
  return `${slugify(input, baseMaxLength)}-${suffix}`;
}
