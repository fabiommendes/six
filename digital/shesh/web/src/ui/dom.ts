/** Escapes text for HTML. */
export function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** The element with `selector` inside `root`; throws if the page skeleton lacks it. */
export function need<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`missing element ${selector}`);
  return found;
}
