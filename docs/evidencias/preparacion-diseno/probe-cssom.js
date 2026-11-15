/* Read-only expression for Orca eval on the integrated, open preparation dialog.
   Returns JSON; does not move focus, mutate state, emulate media or touch physics. */
(() => {
  const root = document.querySelector('.landing-preparation');
  const sheet = [...document.styleSheets].find(s => s.href?.includes('/mission-preparation.css'));
  const box = node => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height,
      right: r.right, bottom: r.bottom, scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth, scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight, scrollTop: node.scrollTop };
  };
  const visible = node => node && node.getClientRects().length > 0;
  const unsupported = [];
  let rules = 0, declarations = 0, emptyVariableLonghands = 0;
  const walk = list => {
    for (const rule of list) {
      if (rule.style) {
        rules++;
        for (const name of rule.style) {
          declarations++;
          const value = rule.style.getPropertyValue(name);
          // var() in a shorthand leaves its expanded longhands empty at specified-value time.
          // The browser has accepted the shorthand; an empty longhand is not a bad CSS value.
          if (!value) { emptyVariableLonghands++; continue; }
          if (!CSS.supports(name, value)) unsupported.push({selector: rule.selectorText, name, value});
        }
      }
      if (rule.cssRules) walk(rule.cssRules);
    }
  };
  if (sheet) walk(sheet.cssRules);
  const focus = document.activeElement;
  const style = root ? getComputedStyle(root) : null;
  const result = {
    url: location.href, viewport: {width: innerWidth, height: innerHeight},
    hostHasFocus: document.hasFocus(), visibility: document.visibilityState,
    stylesheet: sheet?.href ?? null, cssom: {rules, declarations, emptyVariableLonghands, unsupported},
    open: root?.open ?? false,
    dialog: box(root), workbench: box(root?.querySelector('.landing-workbench')),
    header: box(root?.querySelector('.preparation-header')),
    steps: box(root?.querySelector('.preparation-steps')),
    footer: box(root?.querySelector('.preparation-footer')),
    map: box(root?.querySelector('.landing-region-map')),
    activeStep: root?.querySelector('[aria-current=step]')?.dataset.preparationIndicator,
    controls: [...(root?.querySelectorAll('button,input,select') ?? [])].filter(visible)
      .map(n => ({name: n.getAttribute('aria-label') || n.textContent.trim() || n.id,
        disabled: n.disabled, rect: box(n)})),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animation: style?.animationName, backdropFilter: root ? getComputedStyle(root, '::backdrop').backdropFilter : null,
    focus: {tag: focus?.tagName, id: focus?.id, classes: focus?.className,
      matchesFocus: focus?.matches(':focus'), visible: focus?.matches(':focus-visible'), rect: box(focus),
      outline: focus ? getComputedStyle(focus).outline : null},
  };
  return JSON.stringify(result);
})()
