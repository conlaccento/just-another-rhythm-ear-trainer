/** Post-extraction rules applied by the generator. All of them are configurable. */
export interface GeneratorRules {
  /** No two consecutive `difficult` cells at levels up to this one (0 disables the rule). */
  readonly noConsecutiveDifficultUpToLevel: number;
  /** Close the last measure on a `cadential` cell (long figure) when one fits. */
  readonly cadentialEnding: boolean;
  /** Weight multiplier for cells starting with a rest on the first beat of a measure. */
  readonly firstBeatRestWeight: number;
  /** The exercise always starts with a note. */
  readonly firstEventIsNote: boolean;
  /** Allow ties across barlines (never into the last measure). */
  readonly tiesAcrossBarlines: boolean;
  /** Weight multiplier for cells introduced by the current level, so new figures show up. */
  readonly currentLevelBoost: number;
}

export const DEFAULT_RULES: GeneratorRules = {
  noConsecutiveDifficultUpToLevel: 3,
  cadentialEnding: true,
  firstBeatRestWeight: 0.15,
  firstEventIsNote: true,
  tiesAcrossBarlines: true,
  currentLevelBoost: 2,
};
