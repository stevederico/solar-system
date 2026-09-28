import * as THREE from 'three';
import { MOON_BY_ID, PLANET_BY_ID, PLANETS, getBodyInfo, moonsOf } from '../data/bodies.ts';
import type { FactRow } from '../data/bodies.ts';
import { heliocentricPosition, magnitude } from '../sim/kepler.ts';
import type { ScaleMode } from '../sim/scale.ts';
import { daysForYear, daysSinceJ2000 } from '../sim/time.ts';
import { ExploreHud, FIRST_YEAR, LAST_YEAR, SPEEDS } from '../ui/exploreHud.ts';
import type { Stage } from './stage.ts';

const MOON_BLUR_DAYS_PER_SECOND = 20;
const LIVE_ROW_SECONDS = 0.25;
const OVERVIEW_DISTANCE = 78;
const OVERVIEW_TRUE_DISTANCE = 120;
const OVERVIEW_DIRECTION = new THREE.Vector3(0, 0.6, 0.8);
const BODY_VIEW_FACTOR = 5.5;
const RINGED_VIEW_FACTOR = 8;
const PLANET_VIEW_DIRECTION = new THREE.Vector3(0.55, 0.35, 0.75);
const DEFAULT_SPEED_INDEX = 1;
const TITLE_SPEED_INDEX = 2;
const NARROW_SCREEN = 720;
const PANEL_VIEW_SHIFT = 0.2;

/** Free roam through the solar system with a clock you control. */
export class ExploreMode {
  readonly hud: ExploreHud;
  days = daysSinceJ2000(Date.now());
  speedIndex = DEFAULT_SPEED_INDEX;
  playing = true;
  reverse = false;
  scale: ScaleMode = 'compact';
  selectedId?: string;
  private liveTimer = 0;
  private readonly minDays = daysForYear(FIRST_YEAR);
  private readonly maxDays = daysForYear(LAST_YEAR);

  constructor(private readonly stage: Stage) {
    const nav = [{ id: 'sun', name: 'Sun' }, ...PLANETS.map((planet) => ({ id: planet.id, name: planet.name }))];
    this.hud = new ExploreHud(
      {
        onSelect: (id) => this.select(id, true),
        onOverview: () => this.overview(),
        onFly: () => this.selectedId && this.flyTo(this.selectedId),
        onCloseInfo: () => this.deselect(),
        onDate: (days) => this.setDays(days),
        onSpeed: (index) => this.setSpeed(index),
        onPlayToggle: () => this.setPlaying(!this.playing),
        onReverseToggle: () => this.setReverse(!this.reverse),
        onToday: () => this.today(),
      },
      nav,
    );
    this.syncHud();
  }

  /** Lay out the scene for roaming. The title screen uses this as its backdrop. */
  enter(showHud: boolean): void {
    const { solar, missionView, rig } = this.stage;
    // The title backdrop runs the clock fast, so the real view always opens on today.
    if (showHud) this.today();
    missionView.group.visible = false;
    for (const view of solar.bodies.values()) view.anchor.scale.setScalar(1);
    solar.layoutExplore(this.scale, this.days);
    solar.updateExplore(this.days, this.scale);
    const prefersStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rig.controls.autoRotate = !showHud && !prefersStill;
    rig.controls.autoRotateSpeed = 0.35;
    if (!showHud) this.speedIndex = TITLE_SPEED_INDEX;
    this.hud.setVisible(showHud);
    this.syncHud();
    this.overview(showHud ? undefined : 0.01);
  }

  exit(): void {
    this.stage.viewShiftTarget = 0;
    this.hud.setVisible(false);
    this.stage.rig.controls.autoRotate = false;
    this.stage.highlightId = undefined;
    this.selectedId = undefined;
  }

  private syncHud(): void {
    this.hud.setDate(this.days);
    this.hud.setPlaying(this.playing);
    this.hud.setReverse(this.reverse);
    this.hud.setSpeedIndex(this.speedIndex);
  }

  setDays(days: number): void {
    this.days = Math.min(Math.max(days, this.minDays), this.maxDays);
    this.hud.setDate(this.days);
  }

  setSpeed(index: number): void {
    this.speedIndex = Math.min(Math.max(index, 0), SPEEDS.length - 1);
    this.setPlaying(true);
    this.hud.setSpeedIndex(this.speedIndex);
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.hud.setPlaying(playing);
  }

  setReverse(reverse: boolean): void {
    this.reverse = reverse;
    this.hud.setReverse(reverse);
  }

  today(): void {
    this.setReverse(false);
    this.setDays(daysSinceJ2000(Date.now()));
  }

  toggleScale(): ScaleMode {
    this.scale = this.scale === 'compact' ? 'true' : 'compact';
    this.stage.solar.layoutExplore(this.scale, this.days);
    this.stage.solar.updateExplore(this.days, this.scale);
    if (this.selectedId) this.flyTo(this.selectedId);
    else this.overview();
    return this.scale;
  }

  /** Pull back to see the whole inner system. */
  overview(seconds?: number): void {
    const distance = this.scale === 'compact' ? OVERVIEW_DISTANCE : OVERVIEW_TRUE_DISTANCE;
    const fit = this.stage.distanceToFit(distance * 0.42);
    this.stage.rig.flyTo(
      { position: (out) => out.set(0, 0, 0), distance: Math.max(distance, fit), minDistance: 3 },
      OVERVIEW_DIRECTION,
      seconds,
    );
  }

  /** Show facts for a body and optionally fly the camera to it. */
  select(id: string, fly: boolean): void {
    const info = getBodyInfo(id);
    if (!info) return;
    this.selectedId = id;
    this.stage.highlightId = id;
    const moons = moonsOf(id).map((moon) => ({ id: moon.id, name: moon.name }));
    this.hud.showInfo(info, moons);
    this.stage.viewShiftTarget = this.stage.width < NARROW_SCREEN ? PANEL_VIEW_SHIFT : 0;
    this.hud.setLiveRows(this.liveRows(id));
    this.stage.sound.select();
    if (fly) this.flyTo(id);
  }

  deselect(): void {
    this.stage.viewShiftTarget = 0;
    this.selectedId = undefined;
    this.stage.highlightId = undefined;
    this.hud.hideInfo();
  }

  flyTo(id: string): void {
    const view = this.stage.solar.bodies.get(id);
    if (!view) return;
    this.stage.rig.controls.autoRotate = false;
    const hasRing = PLANET_BY_ID.get(id)?.ring !== undefined;
    const size = view.radius * (hasRing ? RINGED_VIEW_FACTOR : BODY_VIEW_FACTOR);
    const distance = Math.max(size, this.stage.distanceToFit(view.radius * (hasRing ? 2.6 : 1.5)));
    this.stage.rig.flyTo(
      {
        position: (out) => this.stage.solar.worldPosition(id, out),
        distance,
        minDistance: view.radius * 1.6,
      },
      PLANET_VIEW_DIRECTION,
    );
  }

  private liveRows(id: string): FactRow[] {
    const moon = MOON_BY_ID.get(id);
    const planet = PLANET_BY_ID.get(moon ? moon.parent : id);
    if (!planet?.elements) return [];
    const at = heliocentricPosition(planet.elements, this.days);
    const rows: FactRow[] = [{ label: 'Sun Now', value: `${magnitude(at).toFixed(3)} AU` }];
    if (planet.id !== 'earth') {
      const earth = heliocentricPosition(PLANET_BY_ID.get('earth')!.elements!, this.days);
      const gap = magnitude({ x: at.x - earth.x, y: at.y - earth.y, z: at.z - earth.z });
      rows.push({ label: 'Earth Now', value: `${gap.toFixed(3)} AU` });
    }
    return rows;
  }

  update(dt: number): void {
    const speed = SPEEDS[this.speedIndex].daysPerSecond;
    if (this.playing) {
      const next = this.days + speed * dt * (this.reverse ? -1 : 1);
      this.days = Math.min(Math.max(next, this.minDays), this.maxDays);
      if (this.days !== next) this.setPlaying(false);
      this.hud.setDate(this.days);
    }
    this.stage.solar.setMoonsBlurred(this.playing && speed > MOON_BLUR_DAYS_PER_SECOND);
    this.stage.solar.updateExplore(this.days, this.scale);

    this.liveTimer += dt;
    if (this.selectedId && this.liveTimer > LIVE_ROW_SECONDS) {
      this.liveTimer = 0;
      this.hud.setLiveRows(this.liveRows(this.selectedId));
    }
  }
}
