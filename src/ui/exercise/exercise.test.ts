import { describe, expect, it } from 'vitest';
import { canListen, exerciseReducer, initialExercise, remainingListens } from './exercise';

describe('exercise flow', () => {
  it('counts listens up to the limit, then blocks until the solution is shown', () => {
    let s = initialExercise('abc');
    expect(remainingListens(s, 2)).toBe(2);
    s = exerciseReducer(s, { type: 'listen' });
    s = exerciseReducer(s, { type: 'listen' });
    expect(remainingListens(s, 2)).toBe(0);
    expect(canListen(s, 2)).toBe(false);
    s = exerciseReducer(s, { type: 'reveal' });
    expect(canListen(s, 2)).toBe(true);
    expect(remainingListens(s, 2)).toBeNull();
  });

  it('does not count listens after the solution', () => {
    let s = exerciseReducer(initialExercise('abc'), { type: 'reveal' });
    s = exerciseReducer(s, { type: 'listen' });
    expect(s.listens).toBe(0);
  });

  it('is unlimited when the limit is null', () => {
    let s = initialExercise('abc');
    for (let i = 0; i < 50; i++) s = exerciseReducer(s, { type: 'listen' });
    expect(canListen(s, null)).toBe(true);
    expect(remainingListens(s, null)).toBeNull();
  });

  it('starts over on a new exercise or a restart', () => {
    let s = exerciseReducer(exerciseReducer(initialExercise('abc'), { type: 'listen' }), { type: 'reveal' });
    expect(exerciseReducer(s, { type: 'new', seed: 'xyz' })).toEqual(initialExercise('xyz'));
    s = exerciseReducer(s, { type: 'restart' });
    expect(s).toEqual(initialExercise('abc'));
  });
});
