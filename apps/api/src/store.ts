import { randomUUID } from 'node:crypto';
import type { EvidenceGraph, Finding, ScanBundle, SignOff, Waiver } from '@infralens/graph-model';

export interface StoredScan {
  id: string;
  project: string;
  createdAt: string;
  bundle: ScanBundle;
}

export interface AuditEvent {
  id: string;
  at: string;
  action: string;
  actor?: string;
  detail: Record<string, unknown>;
}

/** In-memory store with SQLite-shaped repository interface for local mode. */
export class LocalStore {
  scans = new Map<string, StoredScan>();
  waivers = new Map<string, Waiver>();
  signOffs = new Map<string, SignOff>();
  audit: AuditEvent[] = [];

  saveScan(bundle: ScanBundle): StoredScan {
    const id = bundle.graph.scan.id || randomUUID();
    const row: StoredScan = {
      id,
      project: bundle.graph.scan.project,
      createdAt: bundle.graph.scan.generatedAt,
      bundle,
    };
    this.scans.set(id, row);
    this.audit.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      action: 'scan.saved',
      detail: { scanId: id, project: row.project },
    });
    return row;
  }

  getScan(id: string): StoredScan | undefined {
    return this.scans.get(id);
  }

  listScans(): StoredScan[] {
    return [...this.scans.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  updateGraph(id: string, mutate: (graph: EvidenceGraph) => void): StoredScan {
    const row = this.scans.get(id);
    if (!row) throw new Error('Scan not found');
    mutate(row.bundle.graph);
    return row;
  }

  patchFinding(scanId: string, findingId: string, patch: Partial<Finding>): Finding {
    const row = this.getScan(scanId);
    if (!row) throw new Error('Scan not found');
    const finding = row.bundle.graph.findings.find((f) => f.id === findingId);
    if (!finding) throw new Error('Finding not found');
    Object.assign(finding, patch);
    return finding;
  }

  saveWaiver(waiver: Waiver): Waiver {
    this.waivers.set(waiver.id, waiver);
    this.audit.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      action: 'waiver.created',
      detail: { waiverId: waiver.id, findingId: waiver.findingId },
    });
    return waiver;
  }

  saveSignOff(signOff: SignOff): SignOff {
    this.signOffs.set(signOff.id, signOff);
    this.audit.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      action: 'signoff.created',
      actor: signOff.reviewer,
      detail: { signOffId: signOff.id, decision: signOff.decision },
    });
    return signOff;
  }
}

export const store = new LocalStore();
