import { CELLS } from './cells';
import { ELEMENTS, METERS } from './elements';
import { cellsForMeter, eligibleCells, feasibleMeters } from './generator';
import { meterKind, parseMeter } from './meters';
import type { CellDef, FigureSelection, MeterKind } from './types';

export interface ElementStatus {
  readonly id: string;
  /** Meter kinds in which the element exists at all. */
  readonly meterKinds: readonly MeterKind[];
  /** Selected and actually reachable with the current selection. */
  readonly usable: boolean;
  /**
   * When selected but not usable: the smallest set of other elements that would
   * make it reachable (empty when the obstacle is the meter choice).
   */
  readonly missing: readonly string[];
  /** When selected but not usable because no selected meter of the right kind is available. */
  readonly needsMeterKind: MeterKind | null;
}

export interface SelectionReport {
  readonly feasibleMeters: readonly string[];
  readonly infeasibleMeters: readonly string[];
  readonly elements: ReadonlyMap<string, ElementStatus>;
}

/** Explains what the current selection allows, for live feedback in the UI. */
export function analyzeSelection(selection: FigureSelection, catalogue: readonly CellDef[] = CELLS): SelectionReport {
  const feasible = feasibleMeters(selection, catalogue);
  const selected = new Set(selection.elements);
  const kindsOf = new Map<string, Set<MeterKind>>();
  for (const meter of METERS) {
    const ts = parseMeter(meter);
    for (const cell of cellsForMeter(ts, catalogue)) {
      for (const f of cell.features) kindsOf.set(f, (kindsOf.get(f) ?? new Set()).add(meterKind(ts)));
    }
  }
  const usableFeatures = new Set(
    feasible.flatMap((m) => eligibleCells(selection.elements, parseMeter(m), catalogue).flatMap((c) => [...c.features])),
  );
  const selectedKinds = new Set(selection.meters.map((m) => meterKind(parseMeter(m))));

  const statuses = new Map<string, ElementStatus>();
  for (const { id } of ELEMENTS) {
    const meterKinds = [...(kindsOf.get(id) ?? [])];
    const usable = selected.has(id) && usableFeatures.has(id);
    let missing: string[] = [];
    let needsMeterKind: MeterKind | null = null;
    if (selected.has(id) && !usable) {
      const kindAvailable = meterKinds.some((k) => selectedKinds.has(k));
      if (!kindAvailable) needsMeterKind = meterKinds[0] ?? null;
      else {
        // Smallest set of extra elements over the cells (in selected meters) that use this element.
        const options = selection.meters.flatMap((m) =>
          cellsForMeter(parseMeter(m), catalogue)
            .filter((c) => c.features.has(id))
            .map((c) => [...c.features].filter((f) => !selected.has(f))),
        );
        missing = options.reduce<string[] | null>((best, o) => (best === null || o.length < best.length ? o : best), null) ?? [];
      }
    }
    statuses.set(id, { id, meterKinds, usable, missing, needsMeterKind });
  }
  return {
    feasibleMeters: feasible,
    infeasibleMeters: selection.meters.filter((m) => !feasible.includes(m)),
    elements: statuses,
  };
}
