/** Makes every black fill/stroke follow the CSS `color`, so dark mode and highlighting work. */
export function useCurrentColor(svg: SVGSVGElement): void {
  for (const attr of ['fill', 'stroke'] as const) {
    svg.querySelectorAll(`[${attr}="black"], [${attr}="#000"], [${attr}="#000000"]`).forEach((el) => {
      el.setAttribute(attr, 'currentColor');
    });
    if (svg.getAttribute(attr) === 'black') svg.setAttribute(attr, 'currentColor');
  }
}
