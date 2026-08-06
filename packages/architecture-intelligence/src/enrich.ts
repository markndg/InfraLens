import type { ArchitectureIntelligence, EvidenceGraph } from '@infralens/graph-model';
import { inferCapabilities } from './capabilities.js';
import { inferDataAssets } from './dataAssets.js';
import { computeArchitectureDNA } from './dna.js';
import { computeArchitectureHealth } from './health.js';
import { applyLayers } from './layers.js';
import { inferOwnership, inferTrustZones, linkSecurityControls } from './ownership.js';
import { clearProjectionCache } from './projections.js';
import { buildReviewDashboard } from './review/engine.js';
import { computeRiskProfile } from './risk.js';
import { generateArchitectureStory } from './story.js';

export function enrichArchitectureIntelligence(graph: EvidenceGraph): ArchitectureIntelligence {
  // Avoid double-enrichment of inferred semantic nodes
  const already = graph.resources.some(
    (r) => r.kind === 'business-capability' || r.kind === 'data-asset' || r.kind === 'team' || r.kind === 'trust-zone',
  );

  const capabilityIds = already
    ? graph.resources.filter((r) => r.kind === 'business-capability').map((r) => r.id)
    : inferCapabilities(graph);
  const dataAssetIds = already
    ? graph.resources.filter((r) => r.kind === 'data-asset').map((r) => r.id)
    : inferDataAssets(graph);
  const teamIds = already
    ? graph.resources.filter((r) => r.kind === 'team').map((r) => r.id)
    : inferOwnership(graph);
  const trustZoneIds = already
    ? graph.resources.filter((r) => r.kind === 'trust-zone').map((r) => r.id)
    : inferTrustZones(graph);

  // Always (re)link controls — idempotent; zones may already exist on re-enrich
  linkSecurityControls(graph);

  applyLayers(graph);

  const risk = computeRiskProfile(graph);
  const health = computeArchitectureHealth(graph);
  const dna = computeArchitectureDNA(graph, health, risk);
  const sentences = generateArchitectureStory(graph);
  if (!graph.reviews) graph.reviews = [];

  const storyClauses = sentences.map((s) => ({
    text: s.text,
    evidenceIds: s.evidenceIds,
    edgeIds: graph.edges
      .filter((e) => s.nodeIds.includes(e.source) && s.nodeIds.includes(e.target))
      .map((e) => e.id)
      .slice(0, 20),
    resourceIds: s.nodeIds,
  }));

  const reviewDashboard = buildReviewDashboard(graph, graph.reviews);

  const intelligence: ArchitectureIntelligence = {
    version: '1.4',
    story: sentences.map((s) => s.text).join(' '),
    storyClauses,
    dna,
    health,
    risk,
    capabilityIds,
    dataAssetIds,
    teamIds,
    trustZoneIds,
    reviewDashboard,
  };

  graph.version = '1.4';
  graph.intelligence = intelligence;
  graph.narrative = intelligence.story;
  clearProjectionCache(graph);
  return intelligence;
}
