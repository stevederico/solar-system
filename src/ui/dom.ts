/** Find an element by id. Throws when the page is missing it. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

/** Show or hide an element with the hidden attribute. */
export function setVisible(element: HTMLElement, visible: boolean): void {
  element.hidden = !visible;
}

/** Update a toggle button's pressed state. */
export function setPressed(button: HTMLElement, pressed: boolean): void {
  button.setAttribute('aria-pressed', String(pressed));
}

/** Replace an element's children with label and value rows. */
export function fillRows(list: HTMLElement, rows: { label: string; value: string; className?: string }[]): void {
  list.replaceChildren();
  for (const row of rows) {
    const term = document.createElement('dt');
    term.textContent = row.label;
    const detail = document.createElement('dd');
    detail.textContent = row.value;
    if (row.className) detail.className = row.className;
    list.append(term, detail);
  }
}

/** Build a small pill button. */
export function createChip(label: string, onClick: () => void): HTMLButtonElement {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = label;
  chip.addEventListener('click', onClick);
  return chip;
}

const STAR_COUNT = 3;

/** Fill an element with earned and empty stars. */
export function fillStars(element: HTMLElement, earned: number): void {
  element.replaceChildren();
  element.setAttribute('aria-label', `${earned} of ${STAR_COUNT} stars`);
  for (let n = 0; n < STAR_COUNT; n++) {
    const star = document.createElement('span');
    star.textContent = '★';
    star.setAttribute('aria-hidden', 'true');
    if (n >= earned) star.className = 'star-empty';
    element.appendChild(star);
  }
}
