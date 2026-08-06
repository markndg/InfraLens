export function stableId(...parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((p) => p !== undefined && p !== null && String(p).length > 0)
    .join(':')
    .toLowerCase()
    .replace(/[^a-z0-9:_./-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function contentHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16).padStart(8, '0')}`;
}
