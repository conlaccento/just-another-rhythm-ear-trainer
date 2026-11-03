const reducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Brings a settings control into view and focuses it with a visible focus ring,
 * even when the action started with a mouse click. `focusVisible` is not supported
 * everywhere, so `data-focus-ring` provides the same ring until the control loses focus.
 */
export function focusField(element: HTMLElement | null): void {
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  element.setAttribute('data-focus-ring', '');
  element.addEventListener('blur', () => element.removeAttribute('data-focus-ring'), { once: true });
  element.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
}

export const MEASURES_FIELD_ID = 'settings-measures';
export const METERS_FIELDSET_ID = 'settings-meters';

/** Id of the checkbox of a meter in the meter picker. */
export const meterOptionId = (meter: string): string => `meter-option-${meter}`;
