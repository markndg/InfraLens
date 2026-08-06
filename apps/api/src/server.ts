import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { listCapabilities } from '@infralens/edition-capabilities';
import { validateBundle } from '@infralens/graph-model';
import {
  applyWaivers,
  createSignOff,
  createWaiver,
  evaluateSignOffGate,
} from '@infralens/policy-engine';
import {
  analyzeReachability,
  blastRadius,
  ensureInternetNode,
} from '@infralens/reachability';
import { compareBundles, invalidateSignOffsOnMaterialChange } from '@infralens/reconciliation';
import { renderHtmlReport, runQuery, type ArchitectureQuery } from '@infralens/reporting';
import {
  generateGovernanceReport,
  replayHistoricalReview,
  simulateAssumptionFailure,
  validateIntents,
} from '@infralens/architecture-intelligence';
import { scanPath } from '@infralens/scanner';
import { store } from './store.js';

const PORT = Number(process.env.PORT ?? 8787);
const PRODUCT_VERSION = '0.1.0';

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function send(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(payload);
}

function sendHtml(res: ServerResponse, status: number, html: string) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  res.end(html);
}

function notFound(res: ServerResponse) {
  send(res, 404, { error: 'not_found' });
}

async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === 'OPTIONS') {
      send(res, 204, {});
      return;
    }
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET' && url.pathname === '/api/capabilities') {
      send(res, 200, { productVersion: PRODUCT_VERSION, capabilities: listCapabilities() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/scans') {
      const body = (await readJson(req)) as {
        path?: string;
        bundle?: unknown;
        project?: string;
      };
      if (body.bundle) {
        if (!validateBundle(body.bundle)) {
          send(res, 400, { error: 'invalid_bundle' });
          return;
        }
        const row = store.saveScan(body.bundle);
        send(res, 201, { id: row.id, project: row.project });
        return;
      }
      if (!body.path) {
        send(res, 400, { error: 'path_or_bundle_required' });
        return;
      }
      const bundle = await scanPath(path.resolve(body.path), {
        project: body.project,
        policyDir: path.resolve('policies/default'),
      });
      const row = store.saveScan(bundle);
      send(res, 201, { id: row.id, project: row.project, resources: bundle.graph.resources.length });
      return;
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'scans' && parts.length === 2) {
      send(res, 200, store.listScans().map((s) => ({ id: s.id, project: s.project, createdAt: s.createdAt })));
      return;
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'scans' && parts[2] && parts.length === 3) {
      const row = store.getScan(parts[2]);
      if (!row) return notFound(res);
      send(res, 200, row.bundle);
      return;
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'scans' && parts[3] === 'graph') {
      const row = store.getScan(parts[2]);
      if (!row) return notFound(res);
      send(res, 200, row.bundle.graph);
      return;
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'scans' && parts[3] === 'findings') {
      const row = store.getScan(parts[2]);
      if (!row) return notFound(res);
      send(res, 200, row.bundle.graph.findings);
      return;
    }

    if (
      req.method === 'GET' &&
      parts[0] === 'api' &&
      parts[1] === 'scans' &&
      parts[3] === 'evidence' &&
      parts[4]
    ) {
      const row = store.getScan(parts[2]);
      if (!row) return notFound(res);
      const ev = row.bundle.graph.evidence.find((e) => e.id === parts[4]);
      if (!ev) return notFound(res);
      send(res, 200, ev);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/compare') {
      const body = (await readJson(req)) as { baselineId?: string; candidateId?: string };
      const a = body.baselineId ? store.getScan(body.baselineId) : undefined;
      const b = body.candidateId ? store.getScan(body.candidateId) : undefined;
      if (!a || !b) {
        send(res, 404, { error: 'scan_not_found' });
        return;
      }
      const comparison = compareBundles(a.bundle, b.bundle);
      invalidateSignOffsOnMaterialChange(b.bundle.graph, comparison);
      send(res, 200, comparison);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/query') {
      const body = (await readJson(req)) as { scanId: string; query: ArchitectureQuery };
      const row = store.getScan(body.scanId);
      if (!row) return notFound(res);
      ensureInternetNode(row.bundle.graph);
      send(res, 200, { result: runQuery(row.bundle.graph, body.query) });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/reachability') {
      const body = (await readJson(req)) as { scanId: string; sourceId: string; targetId: string };
      const row = store.getScan(body.scanId);
      if (!row) return notFound(res);
      ensureInternetNode(row.bundle.graph);
      send(res, 200, analyzeReachability(row.bundle.graph, body.sourceId, body.targetId));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/simulate') {
      const body = (await readJson(req)) as {
        scanId: string;
        action: 'remove' | 'enable-multi-az' | 'restrict-egress' | 'remove-route';
        resourceId: string;
      };
      const row = store.getScan(body.scanId);
      if (!row) return notFound(res);
      const clone = structuredClone(row.bundle.graph);
      if (body.action === 'remove' || body.action === 'remove-route') {
        clone.resources = clone.resources.filter((r) => r.id !== body.resourceId);
        clone.edges = clone.edges.filter((e) => e.source !== body.resourceId && e.target !== body.resourceId);
        clone.findings = clone.findings.filter((f) => !f.affectedResources.includes(body.resourceId));
      }
      if (body.action === 'enable-multi-az') {
        const r = clone.resources.find((x) => x.id === body.resourceId);
        if (r) {
          r.metadata.multi_az = true;
          r.metadata.multiAz = true;
        }
        clone.findings = clone.findings.filter(
          (f) => !(f.policyId === 'PROD-DATA-004' && f.affectedResources.includes(body.resourceId)),
        );
      }
      const before = blastRadius(row.bundle.graph, body.resourceId);
      send(res, 200, {
        simulated: true,
        resources: clone.resources.length,
        findings: clone.findings.length,
        blastRadiusBefore: before,
        note: 'Graph-only simulation; no infrastructure was modified.',
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/signoffs') {
      const body = (await readJson(req)) as {
        scanId: string;
        reviewer: string;
        environment: string;
        scope: string;
        decision: 'Approved' | 'Approved with Waivers' | 'Rejected' | 'Ready for Review';
        comments?: string[];
      };
      const row = store.getScan(body.scanId);
      if (!row) return notFound(res);
      const gate = evaluateSignOffGate(row.bundle.graph);
      const signOff = createSignOff(row.bundle.graph, body);
      row.bundle.graph.signOffs.push(signOff);
      store.saveSignOff(signOff);
      send(res, gate.allowed || body.decision === 'Rejected' || body.decision === 'Ready for Review' ? 201 : 409, {
        signOff,
        gate,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/waivers') {
      const body = (await readJson(req)) as Parameters<typeof createWaiver>[0] & { scanId: string };
      const row = store.getScan(body.scanId);
      if (!row) return notFound(res);
      const waiver = createWaiver(body);
      row.bundle.graph.waivers.push(waiver);
      applyWaivers(row.bundle.graph);
      store.saveWaiver(waiver);
      send(res, 201, waiver);
      return;
    }

    if (req.method === 'PATCH' && parts[0] === 'api' && parts[1] === 'findings' && parts[2]) {
      const body = (await readJson(req)) as { scanId: string; status?: string };
      const finding = store.patchFinding(body.scanId, parts[2], body as never);
      send(res, 200, finding);
      return;
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'scans' && parts[3] === 'report') {
      const row = store.getScan(parts[2]);
      if (!row) return notFound(res);
      sendHtml(res, 200, renderHtmlReport(row.bundle));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      send(res, 200, { ok: true, productVersion: PRODUCT_VERSION });
      return;
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'governance') {
      const scanId = url.searchParams.get('scanId') ?? store.listScans()[0]?.id;
      const row = scanId ? store.getScan(scanId) : undefined;
      if (!row) return notFound(res);
      const g = row.bundle.graph;
      const gov = g.intelligence?.governance;
      if (parts[2] === 'intent') {
        send(res, 200, { intents: g.resources.filter((r) => r.kind === 'intent'), validation: validateIntents(g) });
        return;
      }
      if (parts[2] === 'decisions') {
        send(res, 200, { decisions: g.resources.filter((r) => r.kind === 'architectural-decision') });
        return;
      }
      if (parts[2] === 'contracts') {
        send(res, 200, { contracts: g.resources.filter((r) => r.kind === 'architecture-contract') });
        return;
      }
      if (parts[2] === 'adrs') {
        send(res, 200, { adrs: g.resources.filter((r) => r.kind === 'adr') });
        return;
      }
      if (parts[2] === 'reviews') {
        send(res, 200, { reviews: g.reviews ?? [] });
        return;
      }
      if (parts[2] === 'assumptions') {
        send(res, 200, { assumptions: g.resources.filter((r) => r.kind === 'assumption') });
        return;
      }
      if (parts[2] === 'portfolio') {
        send(res, 200, {
          note: 'Portfolio aggregation across loaded scan projects',
          projects: store.listScans().map((s) => ({ id: s.id, project: s.bundle.graph.scan.project })),
        });
        return;
      }
      if (parts[2] === 'report') {
        send(res, 200, generateGovernanceReport(g));
        return;
      }
      send(res, 200, { governance: gov, project: g.scan.project });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/replay') {
      const body = (await readJson(req)) as { scanId: string };
      const row = store.getScan(body.scanId);
      if (!row) return notFound(res);
      send(res, 200, replayHistoricalReview(row.bundle));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/simulate-assumption') {
      const body = (await readJson(req)) as { scanId: string; assumptionId: string };
      const row = store.getScan(body.scanId);
      if (!row) return notFound(res);
      send(res, 200, simulateAssumptionFailure(row.bundle.graph, body.assumptionId));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/validate-intent') {
      const body = (await readJson(req)) as { scanId: string };
      const row = store.getScan(body.scanId);
      if (!row) return notFound(res);
      send(res, 200, { validation: validateIntents(row.bundle.graph) });
      return;
    }

    // Convenience: load demo bundle file if present
    if (req.method === 'POST' && url.pathname === '/api/demo/load') {
      const file = path.resolve('fixtures/scans/demo.bundle.json');
      try {
        const bundle = JSON.parse(await readFile(file, 'utf8'));
        if (!validateBundle(bundle)) throw new Error('invalid');
        const row = store.saveScan(bundle);
        send(res, 201, { id: row.id });
      } catch {
        const scanned = await scanPath(path.resolve('fixtures/demo-estate'), {
          policyDir: path.resolve('policies/default'),
          project: 'Retail SaaS reference estate',
        });
        const row = store.saveScan(scanned);
        send(res, 201, { id: row.id, scanned: true });
      }
      return;
    }

    notFound(res);
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}

createServer(handler).listen(PORT, () => {
  console.log(`InfraLens API listening on http://localhost:${PORT}`);
});
