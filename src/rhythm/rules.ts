/** Post-extraction rules applied by the generator. All of them are configurable. */
export interface GeneratorRules {
  /** Avoid two consecutive `difficult` cells whenever another cell fits. */
  readonly avoidConsecutiveDifficult: boolean;
  /** Close the last measure on a `cadential` cell (long figure) when one fits. */
  readonly cadentialEnding: boolean;
  /** Weight multiplier for cells starting with a rest on the first beat of a measure. */
  readonly firstBeatRestWeight: number;
  /** The exercise starts with a note whenever possible. */
  readonly firstEventIsNote: boolean;
  /** Allow ties across barlines (never into the last measure). */
  readonly tiesAcrossBarlines: boolean;
  /**
   * Weight multiplier for cells bringing selected elements not used yet in the
   * exercise, so every selected figure tends to show up.
   */
  readonly coverageBoost: number;
}

export const DEFAULT_RULES: GeneratorRules = {
  avoidConsecutiveDifficult: true,
  cadentialEnding: true,
  firstBeatRestWeight: 0.15,
  firstEventIsNote: true,
  tiesAcrossBarlines: true,
  coverageBoost: 3,
};
