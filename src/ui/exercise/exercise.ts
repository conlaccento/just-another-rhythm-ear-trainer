export type Phase = 'listening' | 'revealed';

export interface ExerciseState {
  readonly seed: string;
  /** The solution is shown only when the user asks for it. */
  readonly phase: Phase;
}

export type ExerciseAction =
  | { readonly type: 'new'; readonly seed: string }
  /** Settings that change the rhythm were edited: same seed, solution hidden again. */
  | { readonly type: 'restart' }
  | { readonly type: 'reveal' };

export function initialExercise(seed: string): ExerciseState {
  return { seed, phase: 'listening' };
}

export function exerciseReducer(state: ExerciseState, action: ExerciseAction): ExerciseState {
  switch (action.type) {
    case 'new':
      return initialExercise(action.seed);
    case 'restart':
      return initialExercise(state.seed);
    case 'reveal':
      return { ...state, phase: 'revealed' };
  }
}
