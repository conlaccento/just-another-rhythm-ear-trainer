import { describe, expect, it } from 'vitest';
import { exerciseReducer, initialExercise } from './exercise';

describe('exercise flow', () => {
  it('starts with the solution hidden and reveals it on request', () => {
    const s = initialExercise('abc');
    expect(s.phase).toBe('listening');
    expect(exerciseReducer(s, { type: 'reveal' }).phase).toBe('revealed');
  });

  it('hides the solution again on a new exercise or a restart', () => {
    const revealed = exerciseReducer(initialExercise('abc'), { type: 'reveal' });
    expect(exerciseReducer(revealed, { type: 'new', seed: 'xyz' })).toEqual(initialExercise('xyz'));
    expect(exerciseReducer(revealed, { type: 'restart' })).toEqual(initialExercise('abc'));
  });
});
