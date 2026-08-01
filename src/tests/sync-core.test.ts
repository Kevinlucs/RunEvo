import {
  resolveConflict,
  planPullMerge,
  planOutboxDrain,
  classifySyncError,
  type Syncable,
  type OutboxEntry,
} from '@/db/sync-core';

const ts = (s: string): string => new Date(s).toISOString();

describe('resolveConflict (nuvem vence)', () => {
  it('remoto mais novo vence', () => {
    const local: Syncable = { id: 'a', updated_at: ts('2026-01-01T10:00:00Z') };
    const remote: Syncable = { id: 'a', updated_at: ts('2026-01-01T11:00:00Z') };
    expect(resolveConflict(local, remote)).toBe('remote');
  });
  it('local estritamente mais novo preserva escrita offline', () => {
    const local: Syncable = { id: 'a', updated_at: ts('2026-01-01T12:00:00Z') };
    const remote: Syncable = { id: 'a', updated_at: ts('2026-01-01T11:00:00Z') };
    expect(resolveConflict(local, remote)).toBe('local');
  });
  it('empate → nuvem vence', () => {
    const t = ts('2026-01-01T11:00:00Z');
    expect(resolveConflict({ id: 'a', updated_at: t }, { id: 'a', updated_at: t })).toBe('remote');
  });
  it('sem local → aplica remoto', () => {
    expect(resolveConflict(null, { id: 'a', updated_at: ts('2026-01-01T11:00:00Z') })).toBe('remote');
  });
});

describe('planPullMerge', () => {
  it('aplica só onde a nuvem vence e mantém escritas locais mais novas', () => {
    const local = new Map<string, Syncable>([
      ['a', { id: 'a', updated_at: ts('2026-01-01T09:00:00Z') }], // remoto vence
      ['b', { id: 'b', updated_at: ts('2026-01-01T13:00:00Z') }], // local vence
    ]);
    const remote: Syncable[] = [
      { id: 'a', updated_at: ts('2026-01-01T10:00:00Z') },
      { id: 'b', updated_at: ts('2026-01-01T10:00:00Z') },
      { id: 'c', updated_at: ts('2026-01-01T10:00:00Z') }, // novo
    ];
    const { toApplyLocally, keepLocal } = planPullMerge(local, remote);
    expect(toApplyLocally.map((r) => r.id).sort()).toEqual(['a', 'c']);
    expect(keepLocal).toEqual(['b']);
  });
});

describe('planOutboxDrain', () => {
  const mk = (id: number, row: string, op: OutboxEntry['op'], at: string): OutboxEntry => ({
    id,
    table_name: 'plan_workouts',
    row_id: row,
    op,
    payload: '{}',
    created_at: ts(at),
    attempts: 0,
  });

  it('compacta insert→update na mesma linha mantendo insert', () => {
    const drained = planOutboxDrain([
      mk(1, 'x', 'insert', '2026-01-01T10:00:00Z'),
      mk(2, 'x', 'update', '2026-01-01T10:05:00Z'),
    ]);
    expect(drained).toHaveLength(1);
    expect(drained[0]?.op).toBe('insert');
  });

  it('delete vence operações anteriores da mesma linha', () => {
    const drained = planOutboxDrain([
      mk(1, 'x', 'insert', '2026-01-01T10:00:00Z'),
      mk(2, 'x', 'update', '2026-01-01T10:05:00Z'),
      mk(3, 'x', 'delete', '2026-01-01T10:10:00Z'),
    ]);
    expect(drained).toHaveLength(1);
    expect(drained[0]?.op).toBe('delete');
  });

  it('preserva ordem causal entre linhas distintas', () => {
    const drained = planOutboxDrain([
      mk(2, 'y', 'insert', '2026-01-01T10:05:00Z'),
      mk(1, 'x', 'insert', '2026-01-01T10:00:00Z'),
    ]);
    expect(drained.map((e) => e.row_id)).toEqual(['x', 'y']);
  });
});

describe('classifySyncError (docs/fase-5-brief.md Grupo 5)', () => {
  it('429 é transitório', () => {
    expect(classifySyncError(429)).toBe('transient');
  });
  it('5xx é transitório', () => {
    expect(classifySyncError(500)).toBe('transient');
    expect(classifySyncError(503)).toBe('transient');
  });
  it('status ausente/zero (falha de rede) é transitório', () => {
    expect(classifySyncError(0)).toBe('transient');
    expect(classifySyncError(null)).toBe('transient');
    expect(classifySyncError(undefined)).toBe('transient');
  });
  it('4xx de schema/constraint/validação é permanente', () => {
    expect(classifySyncError(400)).toBe('permanent');
    expect(classifySyncError(404)).toBe('permanent');
    expect(classifySyncError(409)).toBe('permanent');
    expect(classifySyncError(422)).toBe('permanent');
  });
});
