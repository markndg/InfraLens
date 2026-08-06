import { readdir, readFile, realpath, stat, lstat } from 'node:fs/promises';
import path from 'node:path';
import { IGNORE_DIRS, SCANNER_LIMITS } from '@infralens/shared';
import type { ProjectFile } from './types.js';

const INTERESTING =
  /\.(tf|tf\.json|json|ya?ml|yml|toml|properties|env|tfvars|hcl|ts|js|py|java|go|rs|cs|xml|md)$/i;

export async function walkProject(
  rootPath: string,
  options?: { maxFiles?: number; maxFileBytes?: number; maxDepth?: number },
): Promise<{ files: ProjectFile[]; warnings: string[] }> {
  const maxFiles = options?.maxFiles ?? SCANNER_LIMITS.maxFiles;
  const maxFileBytes = options?.maxFileBytes ?? SCANNER_LIMITS.maxFileBytes;
  const maxDepth = options?.maxDepth ?? SCANNER_LIMITS.maxDepth;
  const rootReal = await realpath(rootPath);
  const files: ProjectFile[] = [];
  const warnings: string[] = [];
  const seenInodes = new Set<string>();

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || files.length >= maxFiles) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      warnings.push(`Cannot read directory ${dir}: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) {
        warnings.push(`File limit ${maxFiles} reached`);
        return;
      }
      const full = path.join(dir, entry.name);
      if (IGNORE_DIRS.has(entry.name)) continue;

      let lst;
      try {
        lst = await lstat(full);
      } catch {
        continue;
      }

      if (lst.isSymbolicLink()) {
        try {
          const target = await realpath(full);
          if (!target.startsWith(rootReal + path.sep) && target !== rootReal) {
            warnings.push(`Blocked symlink escape: ${full}`);
            continue;
          }
          const inodeKey = `${lst.dev}:${lst.ino}`;
          if (seenInodes.has(inodeKey)) {
            warnings.push(`Blocked recursive symlink: ${full}`);
            continue;
          }
          seenInodes.add(inodeKey);
        } catch {
          warnings.push(`Unresolvable symlink: ${full}`);
          continue;
        }
      }

      if (entry.isDirectory() || lst.isDirectory()) {
        await walk(full, depth + 1);
        continue;
      }

      if (!INTERESTING.test(entry.name) && !/Dockerfile|docker-compose/i.test(entry.name)) continue;
      try {
        const st = await stat(full);
        if (st.size > maxFileBytes) {
          warnings.push(`Skipped oversized file (${st.size} bytes): ${path.relative(rootPath, full)}`);
          continue;
        }
        const content = await readFile(full, 'utf8');
        files.push({
          path: path.relative(rootPath, full).split(path.sep).join('/'),
          content,
          size: st.size,
        });
      } catch (err) {
        warnings.push(`Cannot read ${full}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await walk(rootReal, 0);
  return { files, warnings };
}
