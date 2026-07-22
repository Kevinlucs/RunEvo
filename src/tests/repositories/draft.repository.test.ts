/**
 * ai-coach.js:31-47 (`sanitizeProfileDraft`) — lista branca de 22 campos.
 */
/* eslint-disable import/first */
// expo-sqlite exige o runtime RN/Metro — fora do alcance do ts-jest genérico.
// Só testamos sanitizeProfileDraft (pura); getDb nunca é chamado aqui.
jest.mock('@/db/sqlite', () => ({ getDb: jest.fn() }));

import { sanitizeProfileDraft } from '@/repositories/draft.repository';
/* eslint-enable import/first */

describe('sanitizeProfileDraft', () => {
  it('mantém só os 22 campos permitidos + savedAt', () => {
    const draft = sanitizeProfileDraft({
      age: 30,
      height: 170,
      weight: 70,
      level: 'iniciante',
      targetDistance: '5',
      startDate: '2026-01-05',
      raceDate: '2026-03-01',
      objective: 'sub 50',
      // campos não permitidos — devem ser descartados
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload solto de UI, testando filtro
      ...({ evilField: 'xss', __proto__: { polluted: true } } as any),
    });

    expect(draft).toMatchObject({
      age: 30,
      height: 170,
      weight: 70,
      level: 'iniciante',
      targetDistance: '5',
      startDate: '2026-01-05',
      raceDate: '2026-03-01',
      objective: 'sub 50',
    });
    expect(draft).not.toHaveProperty('evilField');
    expect(draft).not.toHaveProperty('polluted');
    expect(typeof draft.savedAt).toBe('string');
  });

  it('descarta undefined/null mas mantém valores falsy válidos (0, false, "")', () => {
    const draft = sanitizeProfileDraft({
      age: 0,
      no5k: false,
      objective: '',
      height: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- simula campo ausente vindo de storage antigo
      weight: null as any,
    });

    expect(draft.age).toBe(0);
    expect(draft.no5k).toBe(false);
    expect(draft.objective).toBe('');
    expect(draft).not.toHaveProperty('height');
    expect(draft).not.toHaveProperty('weight');
  });

  it('sem dados retorna só savedAt', () => {
    const draft = sanitizeProfileDraft();
    expect(Object.keys(draft)).toEqual(['savedAt']);
  });
});
