import { describe, expect, it } from 'vitest';
import { parseHclBlocks } from './hcl.js';

describe('hcl parser', () => {
  it('extracts resources and unresolved expressions', () => {
    const blocks = parseHclBlocks(`
resource "aws_db_instance" "postgres" {
  identifier = "retail-prod-db"
  multi_az = false
  vpc_id = aws_vpc.retail.id
}
module "x" {
  source = "./x"
}
`);
    expect(blocks.some((b) => b.type === 'resource' && b.labels[0] === 'aws_db_instance')).toBe(true);
    expect(blocks.some((b) => b.type === 'module')).toBe(true);
    const db = blocks.find((b) => b.labels[1] === 'postgres')!;
    expect(db.attributes.find((a) => a.name === 'multi_az')?.value).toBe(false);
    expect(db.attributes.find((a) => a.name === 'vpc_id')?.unresolved).toBe(true);
  });
});
