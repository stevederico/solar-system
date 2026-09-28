import type { Outcome } from '../game/flight.ts';
import type { Level } from '../game/levels.ts';
import { DAYS_PER_TIME_UNIT, KM_S_PER_SPEED_UNIT } from '../game/physics.ts';
import type { Progress } from '../game/progress.ts';
import type { ScoreBreakdown } from '../game/score.ts';
import { byId, fillRows, fillStars, setPressed, setVisible } from './dom.ts';

export interface PlanChange {
  windowTime?: number;
  angleDeg?: number;
  powerPercent?: number;
}

export interface MissionHandlers {
  onPlan: (change: PlanChange) => void;
  onLaunch: () => void;
  onRetry: () => void;
  onWarp: () => void;
  onChase: () => void;
  onNext: () => void;
  onMenu: () => void;
  onPickLevel: (index: number) => void;
  onBack: () => void;
}

export type StatusTone = 'plain' | 'good' | 'bad';

const LOSS_TITLES: Record<Exclude<Outcome, 'won' | 'flying'>, [string, string]> = {
  sun: ['Burned Up', 'The probe fell into the Sun. Aim wider or carry more speed.'],
  crash: ['Impact', 'The probe hit a planet. Pass close, but not that close.'],
  lost: ['Lost In Deep Space', 'The probe left the system. Try less power or a different launch day.'],
  timeout: ['Out Of Time', 'The mission clock ran out before arrival.'],
};

function formatDayCount(timeUnits: number): string {
  return `${Math.round(timeUnits * DAYS_PER_TIME_UNIT).toLocaleString('en-US')} d`;
}

/** Everything on screen during missions except the 3D view. */
export class MissionHud {
  private readonly hud = byId('mission-hud');
  private readonly aimPanel = byId('aim-panel');
  private readonly flightPanel = byId('flight-panel');
  private readonly levelSelect = byId('level-select');
  private readonly result = byId('result-screen');
  private readonly windowSlider = byId<HTMLInputElement>('window-slider');
  private readonly angleSlider = byId<HTMLInputElement>('angle-slider');
  private readonly powerSlider = byId<HTMLInputElement>('power-slider');
  private readonly status = byId('mission-status');
  private readonly forecastText = byId('forecast-text');
  private readonly toast = byId('toast');
  private toastTimer?: number;

  constructor(private readonly handlers: MissionHandlers) {
    this.windowSlider.addEventListener('input', () => handlers.onPlan({ windowTime: Number(this.windowSlider.value) }));
    this.angleSlider.addEventListener('input', () => handlers.onPlan({ angleDeg: Number(this.angleSlider.value) }));
    this.powerSlider.addEventListener('input', () => handlers.onPlan({ powerPercent: Number(this.powerSlider.value) }));
    byId('launch-button').addEventListener('click', handlers.onLaunch);
    byId('retry-button').addEventListener('click', handlers.onRetry);
    byId('warp-button').addEventListener('click', handlers.onWarp);
    byId('chase-button').addEventListener('click', handlers.onChase);
    byId('result-next').addEventListener('click', handlers.onNext);
    byId('result-retry').addEventListener('click', handlers.onRetry);
    byId('result-menu').addEventListener('click', handlers.onMenu);
    byId('levels-back').addEventListener('click', handlers.onBack);
  }

  hideAll(): void {
    for (const element of [this.hud, this.aimPanel, this.flightPanel, this.levelSelect, this.result]) {
      setVisible(element, false);
    }
  }

  showLevels(levels: Level[], progress: Progress, targetName: (level: Level) => string): void {
    this.hideAll();
    const grid = byId('level-grid');
    grid.replaceChildren();
    levels.forEach((level, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card';
      const eyebrow = document.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = `Mission ${index + 1}: ${targetName(level)}`;
      const title = document.createElement('h3');
      title.textContent = level.name;
      const brief = document.createElement('p');
      brief.textContent = level.brief;
      const best = document.createElement('div');
      best.className = 'level-best';
      const stars = document.createElement('span');
      stars.className = 'stars';
      fillStars(stars, progress[level.id]?.stars ?? 0);
      const score = document.createElement('span');
      score.textContent = progress[level.id] ? `Best ${progress[level.id].score.toLocaleString('en-US')}` : 'Not Flown';
      best.append(stars, score);
      card.append(eyebrow, title, brief, best);
      card.addEventListener('click', () => this.handlers.onPickLevel(index));
      grid.appendChild(card);
    });
    setVisible(this.levelSelect, true);
  }

  showAim(level: Level, index: number, targetName: string): void {
    this.hideAll();
    byId('mission-number').textContent = `Mission ${index + 1}: Reach ${targetName}`;
    byId('mission-name').textContent = level.name;
    byId('mission-brief').textContent = level.brief;
    const partial = level.previewTime < level.parTime ? ' The forecast only shows the start of the trip, so steer the rest.' : '';
    byId('aim-hint').textContent =
      `${level.hint} Drag the gold handle or use the sliders. The gold ring shows where the target will be.${partial}`;
    this.windowSlider.max = String(level.windowSpan);
    setVisible(this.hud, true);
    setVisible(this.aimPanel, true);
    this.setStatus('Plan your launch.', 'plain');
  }

  showFlight(): void {
    setVisible(this.aimPanel, false);
    setVisible(this.flightPanel, true);
    this.setStatus('Coasting. Thrusters ready.', 'plain');
  }

  /** Mirror the launch plan into the sliders and their readouts. */
  setPlan(windowTime: number, angleDeg: number, powerShare: number, launchSpeed: number): void {
    this.windowSlider.value = String(windowTime);
    this.angleSlider.value = String(angleDeg);
    this.powerSlider.value = String(powerShare * 100);
    byId('window-value').textContent = `Day ${Math.round(windowTime * DAYS_PER_TIME_UNIT)}`;
    byId('angle-value').textContent = `${angleDeg > 0 ? '+' : ''}${angleDeg.toFixed(1)}°`;
    byId('power-value').textContent = `${(launchSpeed * KM_S_PER_SPEED_UNIT).toFixed(1)} km/s`;
  }

  setForecast(text: string, tone: StatusTone): void {
    this.forecastText.textContent = text;
    this.forecastText.className = `status${tone === 'plain' ? '' : ` is-${tone}`}`;
  }

  setStatus(text: string, tone: StatusTone): void {
    if (this.status.textContent === text) return;
    this.status.textContent = text;
    this.status.className = `status${tone === 'plain' ? '' : ` is-${tone}`}`;
  }

  setGauges(fuelShare: number, fuelSpeed: number, elapsed: number, limit: number): void {
    byId('fuel-fill').style.transform = `scaleX(${fuelShare.toFixed(3)})`;
    byId('fuel-bar').setAttribute('aria-valuenow', String(Math.round(fuelShare * 100)));
    byId('fuel-text').textContent = `${(fuelSpeed * KM_S_PER_SPEED_UNIT).toFixed(1)} km/s`;
    const clockShare = Math.min(elapsed / limit, 1);
    byId('clock-fill').style.transform = `scaleX(${clockShare.toFixed(3)})`;
    byId('clock-bar').setAttribute('aria-valuenow', String(Math.round(clockShare * 100)));
    byId('clock-text').textContent = `${formatDayCount(elapsed)} / ${formatDayCount(limit)}`;
  }

  setWarp(multiplier: number): void {
    byId('warp-button').textContent = `Speed ${multiplier}x`;
  }

  setChase(on: boolean): void {
    setPressed(byId('chase-button'), on);
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.add('is-visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('is-visible'), 2200);
  }

  showWin(targetName: string, score: ScoreBreakdown, elapsed: number, isBest: boolean, hasNext: boolean): void {
    byId('result-eyebrow').textContent = isBest ? 'Mission Complete. New Best' : 'Mission Complete';
    byId('result-heading').textContent = `Arrived At ${targetName}`;
    byId('result-detail').textContent = `Flight time ${formatDayCount(elapsed)}.`;
    fillStars(byId('result-stars'), score.stars);
    setVisible(byId('result-stars'), true);
    fillRows(byId('result-rows'), [
      { label: 'Arrival', value: `+${score.arrival}` },
      { label: 'Fuel Saved', value: `+${score.fuel}` },
      { label: 'Speed', value: `+${score.time}` },
      { label: 'Flybys', value: `+${score.assists}` },
      { label: 'Score', value: score.total.toLocaleString('en-US'), className: 'is-total' },
    ]);
    setVisible(byId('result-next'), hasNext);
    byId('result-retry').classList.toggle('button-primary', !hasNext);
    setVisible(this.flightPanel, false);
    setVisible(this.result, true);
  }

  showLoss(outcome: Exclude<Outcome, 'won' | 'flying'>, crashedInto: string | undefined, closest: string): void {
    const [title, detail] = LOSS_TITLES[outcome];
    byId('result-eyebrow').textContent = 'Mission Lost';
    byId('result-heading').textContent = title;
    byId('result-detail').textContent = crashedInto ? `The probe hit ${crashedInto}. Pass close, but not that close.` : detail;
    setVisible(byId('result-stars'), false);
    fillRows(byId('result-rows'), [{ label: 'Closest Pass', value: closest }]);
    setVisible(byId('result-next'), false);
    byId('result-retry').classList.add('button-primary');
    setVisible(this.flightPanel, false);
    setVisible(this.result, true);
  }

  hideResult(): void {
    setVisible(this.result, false);
  }
}
