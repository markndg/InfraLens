import { describe, expect, it } from 'vitest';
import { resolveEntityVisual, resolveIcon } from './index.js';

describe('resolveIcon', () => {
  it('maps AWS service subtypes to branded icons', () => {
    expect(resolveIcon({ kind: 'bucket', provider: 'aws', subtype: 'AWS::S3::Bucket' })).toBe('aws-s3');
    expect(resolveIcon({ kind: 'bucket', provider: 'aws', subtype: 's3' })).toBe('aws-s3');
    expect(resolveIcon({ kind: 'relational-database', provider: 'aws', subtype: 'AWS::RDS::DBInstance' })).toBe('aws-rds');
    expect(resolveIcon({ kind: 'queue', provider: 'aws', subtype: 'sqs' })).toBe('aws-sqs');
    expect(resolveIcon({ kind: 'dns', provider: 'aws', subtype: 'route53' })).toBe('aws-route53');
    expect(resolveIcon({ kind: 'vpc', provider: 'aws', subtype: 'vpc' })).toBe('aws-vpc');
    expect(resolveIcon({ kind: 'load-balancer', provider: 'aws', subtype: 'alb' })).toBe('aws-alb');
    expect(resolveIcon({ kind: 'unknown', provider: 'aws', subtype: 'elasticache_cluster' })).toBe('aws-elasticache');
  });

  it('maps OpenShift and Kubernetes types', () => {
    expect(resolveIcon({ kind: 'route', provider: 'openshift', subtype: 'Route', platform: 'openshift' })).toBe(
      'openshift',
    );
    expect(resolveIcon({ kind: 'workload', provider: 'kubernetes', subtype: 'Deployment' })).toBe('k8s-deployment');
    expect(resolveIcon({ kind: 'service', provider: 'kubernetes', subtype: 'Service' })).toBe('k8s-service');
    expect(resolveIcon({ kind: 'network-policy', provider: 'kubernetes', subtype: 'NetworkPolicy' })).toBe(
      'k8s-network-policy',
    );
  });

  it('maps governance and capability kinds', () => {
    expect(resolveIcon({ kind: 'business-capability' })).toBe('capability');
    expect(resolveIcon({ kind: 'adr', subtype: 'ADR-0001' })).toBe('decision');
    expect(resolveIcon({ kind: 'intent' })).toBe('intent');
    expect(resolveIcon({ kind: 'assumption' })).toBe('assumption');
  });

  it('prefers technology icons over generic workload marks', () => {
    expect(
      resolveIcon({
        kind: 'workload',
        provider: 'kubernetes',
        subtype: 'Deployment',
        techKey: 'react',
        techLabel: 'Frontend · React',
      }),
    ).toBe('react');
    expect(
      resolveIcon({
        kind: 'workload',
        provider: 'kubernetes',
        subtype: 'Deployment',
        techKey: 'spring',
      }),
    ).toBe('spring');
    expect(
      resolveIcon({
        kind: 'workload',
        provider: 'kubernetes',
        subtype: 'Deployment',
        techKey: 'node',
      }),
    ).toBe('nodejs');
  });

  it('returns complementary entity themes', () => {
    const s3 = resolveEntityVisual({ kind: 'bucket', provider: 'aws', subtype: 's3' });
    expect(s3.theme.family).toBe('storage');
    expect(s3.theme.accent).toMatch(/^#/);
    expect(s3.svg).toContain('<svg');

    const route = resolveEntityVisual({ kind: 'route', provider: 'openshift', subtype: 'Route' });
    expect(route.theme.family).toBe('openshift');
    expect(route.icon).toBe('openshift');
  });
});
