import type { BodyInfo, FactRow } from '../data/bodies.ts';
import { daysForYear, formatDays } from '../sim/time.ts';
import { byId, createChip, fillRows, setPressed, setVisible } from './dom.ts';

export interface SpeedOption {
  label: string;
  daysPerSecond: number;
}

export const SPEEDS: SpeedOption[] = [
  { label: '1 Hr/s', daysPerSecond: 1 / 24 },
  { label: '1 Day/s', daysPerSecond: 1 },
  { label: '1 Wk/s', daysPerSecond: 7 },
  { label: '1 Mo/s', daysPerSecond: 30.44 },
  { label: '1 Yr/s', daysPerSecond: 365.25 },
];

export const FIRST_YEAR = 1900;
// The orbital elements are fitted for 1800 to 2050, so the slider stops there.
export const LAST_YEAR = 2050;

export interface NavItem {
  id: string;
  name: string;
}

export interface ExploreHandlers {
  onSelect: (id: string) => void;
  onOverview: () => void;
  onFly: () => void;
  onCloseInfo: () => void;
  onDate: (days: number) => void;
  onSpeed: (index: number) => void;
  onPlayToggle: () => void;
  onReverseToggle: () => void;
  onToday: () => void;
}

/** Bottom time bar, world chips and the facts panel. */
export class ExploreHud {
  private readonly bar = byId('explore-bar');
  private readonly panel = byId('info-panel');
  private readonly dateLabel = byId('date-label');
  private readonly dateSlider = byId<HTMLInputElement>('date-slider');
  private readonly playButton = byId('play-button');
  private readonly reverseButton = byId('reverse-button');
  private readonly speedChips: HTMLButtonElement[] = [];
  private readonly rows = byId('info-rows');
  private readonly moons = byId('info-moons');
  private staticRows: FactRow[] = [];
  private isScrubbing = false;

  constructor(private readonly handlers: ExploreHandlers, nav: NavItem[]) {
    const navRow = byId('body-nav');
    navRow.appendChild(createChip('Overview', handlers.onOverview));
    for (const item of nav) navRow.appendChild(createChip(item.name, () => handlers.onSelect(item.id)));

    const speedRow = byId('speed-chips');
    SPEEDS.forEach((speed, index) => {
      const chip = createChip(speed.label, () => handlers.onSpeed(index));
      this.speedChips.push(chip);
      speedRow.appendChild(chip);
    });

    this.dateSlider.min = String(Math.round(daysForYear(FIRST_YEAR)));
    this.dateSlider.max = String(Math.round(daysForYear(LAST_YEAR)));
    this.dateSlider.addEventListener('input', () => {
      this.isScrubbing = true;
      handlers.onDate(Number(this.dateSlider.value));
    });
    const stopScrub = (): void => {
      this.isScrubbing = false;
    };
    this.dateSlider.addEventListener('change', stopScrub);
    this.dateSlider.addEventListener('pointerup', stopScrub);

    this.playButton.addEventListener('click', handlers.onPlayToggle);
    this.reverseButton.addEventListener('click', handlers.onReverseToggle);
    byId('now-button').addEventListener('click', handlers.onToday);
    byId('info-close').addEventListener('click', handlers.onCloseInfo);
    byId('info-fly').addEventListener('click', handlers.onFly);
  }

  setVisible(visible: boolean): void {
    setVisible(this.bar, visible);
    if (!visible) setVisible(this.panel, false);
  }

  setDate(days: number): void {
    const label = formatDays(days);
    if (this.dateLabel.textContent !== label) this.dateLabel.textContent = label;
    if (!this.isScrubbing) this.dateSlider.value = String(Math.round(days));
  }

  setPlaying(playing: boolean): void {
    this.playButton.textContent = playing ? 'Pause' : 'Play';
    setPressed(this.playButton, playing);
  }

  setReverse(reverse: boolean): void {
    setPressed(this.reverseButton, reverse);
  }

  setSpeedIndex(index: number): void {
    this.speedChips.forEach((chip, n) => setPressed(chip, n === index));
  }

  showInfo(info: BodyInfo, moons: NavItem[]): void {
    byId('info-kind').textContent = info.kindLabel;
    byId('info-name').textContent = info.name;
    byId('info-blurb').textContent = info.blurb;
    byId('info-fact').textContent = info.funFact;
    byId('info-fly').textContent = `Fly To ${info.name}`;
    this.staticRows = info.rows;
    fillRows(this.rows, info.rows);
    this.moons.replaceChildren();
    for (const moon of moons) this.moons.appendChild(createChip(moon.name, () => this.handlers.onSelect(moon.id)));
    setVisible(this.moons, moons.length > 0);
    setVisible(this.panel, true);
    this.panel.scrollTop = 0;
  }

  /** Refresh the rows that change with the date. */
  setLiveRows(rows: FactRow[]): void {
    if (this.panel.hidden) return;
    fillRows(this.rows, [...this.staticRows, ...rows]);
  }

  hideInfo(): void {
    setVisible(this.panel, false);
  }
}
