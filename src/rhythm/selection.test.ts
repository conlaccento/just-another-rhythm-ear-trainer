import { describe, expect, it } from 'vitest';
import { analyzeSelection } from './selection';

describe('analyzeSelection', () => {
  it('reports feasible and infeasible meters', () => {
    const report = analyzeSelection({ elements: ['note:half'], meters: ['2/4', '3/4', '4/4'] });
    expect(report.feasibleMeters).toEqual(['2/4', '4/4']);
    expect(report.infeasibleMeters).toEqual(['3/4']);
  });

  it('explains which elements are missing for a selected one', () => {
    const report = analyzeSelection({ elements: ['note:quarter', 'syncopation'], meters: ['4/4'] });
    const sync = report.elements.get('syncopation');
    expect(sync?.usable).toBe(false);
    expect(sync?.missing).toEqual(['note:eighth']);
    expect(report.elements.get('note:quarter')?.usable).toBe(true);
  });

  it('flags elements that need a compound meter', () => {
    const report = analyzeSelection({ elements: ['note:quarter', 'group:2:eighth'], meters: ['4/4'] });
    expect(report.elements.get('group:2:eighth')).toMatchObject({ usable: false, needsMeterKind: 'compound', meterKinds: ['compound'] });
  });

  it('marks unselected elements as not usable without explanations', () => {
    const report = analyzeSelection({ elements: ['note:quarter'], meters: ['4/4'] });
    expect(report.elements.get('note:eighth')).toMatchObject({ usable: false, missing: [], needsMeterKind: null });
  });
});
