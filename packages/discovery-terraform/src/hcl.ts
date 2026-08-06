/**
 * Bounded Terraform HCL block extractor.
 * Production scanner prefers terraform show -json when available;
 * this parser covers common static resource/variable/module/output forms.
 */

export interface HclAttribute {
  name: string;
  raw: string;
  value: unknown;
  unresolved: boolean;
  line?: number;
}

export interface HclBlock {
  type: string;
  labels: string[];
  attributes: HclAttribute[];
  lineStart: number;
  rawBody: string;
}

export function parseHclBlocks(content: string): HclBlock[] {
  const blocks: HclBlock[] = [];
  const lines = content.split(/\r?\n/);
  const blockRe =
    /^(resource|data|module|variable|output|locals|provider|terraform)\s*((?:"[^"]+"\s*)*)\s*\{/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const m = trimmed.match(blockRe);
    if (!m) {
      i++;
      continue;
    }
    const type = m[1];
    const labels = [...(m[2].matchAll(/"([^"]+)"/g) ?? [])].map((x) => x[1]);
    const lineStart = i + 1;
    let depth = 1;
    const bodyLines: string[] = [];
    i++;
    while (i < lines.length && depth > 0) {
      const l = lines[i];
      depth += (l.match(/\{/g) || []).length;
      depth -= (l.match(/\}/g) || []).length;
      if (depth > 0) bodyLines.push(l);
      i++;
    }
    const rawBody = bodyLines.join('\n');
    blocks.push({
      type,
      labels,
      attributes: parseAttributes(rawBody, lineStart),
      lineStart,
      rawBody,
    });
  }
  return blocks;
}

function parseAttributes(body: string, baseLine: number): HclAttribute[] {
  const attrs: HclAttribute[] = [];
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
    if (!m) continue;
    const name = m[1];
    let raw = m[2].trim();
    if (raw === '{' || raw.endsWith('{')) {
      // nested block/object — capture shallow string form
      let depth = (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
      const collected = [raw];
      let j = i + 1;
      while (j < lines.length && depth > 0) {
        collected.push(lines[j]);
        depth += (lines[j].match(/\{/g) || []).length;
        depth -= (lines[j].match(/\}/g) || []).length;
        j++;
      }
      raw = collected.join('\n');
      i = j - 1;
      attrs.push({
        name,
        raw,
        value: raw,
        unresolved: true,
        line: baseLine + i,
      });
      continue;
    }
    if (raw.startsWith('[')) {
      let depth = 1;
      const collected = [raw];
      let j = i + 1;
      while (j < lines.length && depth > 0) {
        collected.push(lines[j]);
        depth += (lines[j].match(/\[/g) || []).length;
        depth -= (lines[j].match(/\]/g) || []).length;
        j++;
      }
      raw = collected.join('\n');
      i = j - 1;
    }
    const parsed = parseScalar(raw);
    attrs.push({
      name,
      raw,
      value: parsed.value,
      unresolved: parsed.unresolved,
      line: baseLine + i,
    });
  }
  return attrs;
}

function parseScalar(raw: string): { value: unknown; unresolved: boolean } {
  const t = raw.replace(/,\s*$/, '').trim();
  if (t === 'true') return { value: true, unresolved: false };
  if (t === 'false') return { value: false, unresolved: false };
  if (t === 'null') return { value: null, unresolved: false };
  if (/^-?\d+(\.\d+)?$/.test(t)) return { value: Number(t), unresolved: false };
  if (/^".*"$/.test(t)) return { value: JSON.parse(t), unresolved: false };
  if (t.includes('${') || t.startsWith('var.') || t.startsWith('local.') || t.startsWith('module.') || t.startsWith('data.') || t.startsWith('aws_')) {
    return { value: t, unresolved: true };
  }
  if (t.startsWith('[') || t.startsWith('{')) return { value: t, unresolved: true };
  return { value: t, unresolved: true };
}

export function attributesToObject(attrs: HclAttribute[]): {
  values: Record<string, unknown>;
  unresolved: string[];
} {
  const values: Record<string, unknown> = {};
  const unresolved: string[] = [];
  for (const a of attrs) {
    values[a.name] = a.value;
    if (a.unresolved) unresolved.push(a.name);
  }
  return { values, unresolved };
}
