import type { CachedResearch } from '../../../src/lib/research/cache';

/** Existing adoption fixture: a complete producer scope that clears the real quality gate. */
export function producerEntry(target: CachedResearch['target']): CachedResearch {
  return { target,
    payload: { producerDetails: 'Domaine Dujac is a Morey-Saint-Denis estate farming its Clos de la Roche holdings biodynamically, with whole-cluster fermentation a house signature across the range.',
      producerWinemakingPractices: 'The domaine ferments with a high proportion of whole clusters, uses gentle extraction and ages in a modest share of new oak, a practice that holds across vintages rather than varying by release.' },
    sources: [{ title: 'Domaine Dujac', url: 'https://www.dujac.com/' }, { title: 'BIVB', url: 'https://www.bourgogne-wines.com/' }],
    model: 'gemini-3.8-flash', researchedAt: new Date().toISOString() };
}
