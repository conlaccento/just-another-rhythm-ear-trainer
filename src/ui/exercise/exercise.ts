import type { MaxListens } from '../settings/settings';

export type Phase = 'listening' | 'revealed';

export interface ExerciseState {
  readonly seed: string;
  readonly phase: Phase;
  /** Listens started before the solution was shown. */
  readonly listens: number;
}

export type ExerciseAction =
  | { readonly type: 'new'; readonly seed: string }
  /** Settings that change the rhythm were edited: same seed, fresh attempt. */
  | { readonly type: 'restart' }
  | { readonly type: 'listen' }
  | { readonly type: 'reveal' };

export function initialExercise(seed: string): ExerciseState {
  return { seed, phase: 'listening', listens: 0 };
}

export function exerciseReducer(state: ExerciseState, action: ExerciseAction): ExerciseState {
  switch (action.type) {
    case 'new':
      return initialExercise(action.seed);
    case 'restart':
      return initialExercise(state.seed);
    case 'listen':
      // Only listens before the solution count towards the limit.
      return state.phase === 'listening' ? { ...state, listens: state.listens + 1 } : state;
    case 'reveal':
      return { ...state, phase: 'revealed' };
  }
}

/** Remaining listens before the solution, or null when unlimited (or already revealed). */
export function remainingListens(state: ExerciseState, max: MaxListens): number | null {
  if (max === null || state.phase === 'revealed') return null;
  return Math.max(0, max - state.listens);
}

export function canListen(state: ExerciseState, max: MaxListens): boolean {
  const remaining = remainingListens(state, max);
  return remaining === null || remaining > 0;
}
