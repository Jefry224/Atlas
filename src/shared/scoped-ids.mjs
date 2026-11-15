// Reuse static panel markup without duplicate IDs or cross-panel label references.
export function prefixElementIds(root, prefix) {
  const ids = new Map();
  for (const element of [root,...root.querySelectorAll('[id]')]) {
    if (element.id) { ids.set(element.id,prefix+element.id); element.id=prefix+element.id; }
  }
  for (const element of [root,...root.querySelectorAll('*')]) {
    for (const attribute of ['for','aria-labelledby','aria-describedby','aria-controls']) {
      if(element.hasAttribute(attribute))element.setAttribute(attribute,element.getAttribute(attribute).split(/\s+/).map(id=>ids.get(id)||id).join(' '));
    }
    const href=element.getAttribute('href');if(href?.startsWith('#')&&ids.has(href.slice(1)))element.setAttribute('href','#'+ids.get(href.slice(1)));
  }
}
