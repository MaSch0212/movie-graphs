export type ViewTransform = { x: number; y: number; k: number };
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** Keeps the content (world coordinates) from being moved out of the viewport. */
export type PanZoomConstraints = {
  bounds: Rect;
  viewport: Size;
  /** How many screen pixels of the content must stay visible at each viewport edge. */
  margin: number;
};

export type PanZoomOptions = {
  minScale: number;
  maxScale: number;
  onChange: (transform: ViewTransform) => void;
  getConstraints?: () => PanZoomConstraints | undefined;
  /** Time constant (ms) of the exponential decay of the momentum after a flick. */
  inertiaTimeConstant?: number;
  /** Minimum release speed (px/ms) that starts momentum scrolling. */
  inertiaMinSpeed?: number;
  /** Distance (px) a pointer may move before a press is treated as a drag instead of a click. */
  dragThreshold?: number;
  now?: () => number;
  requestFrame?: (callback: (time: number) => void) => number;
  cancelFrame?: (handle: number) => void;
};

type Sample = { t: number; x: number; y: number };

const VELOCITY_WINDOW_MS = 100;
const STOP_SPEED = 0.02;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE = 30;
/** Zoom factor per pixel when zooming with "double tap and drag". */
const TAP_ZOOM_SENSITIVITY = 0.01;
/** Time constant (ms) that slows down momentum quickly once it runs past the bounds. */
const OVERSCROLL_TIME_CONSTANT = 50;
const BOUNCE_DURATION_MS = 450;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** iOS-like rubber band: the further past the limit, the stronger the resistance. */
const rubberBand = (distance: number, dimension: number) =>
  (1 - 1 / ((distance * 0.55) / dimension + 1)) * dimension;

/**
 * Pan & zoom state machine for a 2D canvas, driven by pointer events.
 *
 * - One pointer pans; releasing it with speed continues the movement with decaying momentum.
 * - Two pointers pinch-zoom around their midpoint (and pan with it).
 * - Double tap zooms in; double tap and drag zooms in (drag up) or out (drag down).
 * - Mouse wheel / trackpad pinch (ctrl + wheel, Safari gesture events) zoom around the cursor.
 * - With constraints, the content can only be dragged out of the viewport with growing
 *   resistance and bounces back when released.
 *
 * All positions are in screen coordinates relative to the element's top left corner.
 * The resulting transform maps world coordinates to screen coordinates: `screen = world * k + (x, y)`.
 */
export class PanZoomController {
  private readonly _options: Required<Omit<PanZoomOptions, 'getConstraints'>> &
    Pick<PanZoomOptions, 'getConstraints'>;
  /** The transform that is shown. */
  private _transform: ViewTransform = { x: 0, y: 0, k: 1 };
  /** The transform the current gesture would produce without the rubber band. */
  private _raw: ViewTransform = this._transform;

  private readonly _pointers = new Map<number, Point>();
  private _panLast?: Point;
  private _pinch?: { distance: number; world: Point; k: number };
  private _tapZoom?: { anchor: Point; world: Point; k: number; startY: number };
  private _samples: Sample[] = [];
  private _pressStart?: Point;
  private _moved = false;
  private _wasPinching = false;
  private _lastTap?: Sample;

  private _frame?: number;

  constructor(options: PanZoomOptions) {
    this._options = {
      inertiaTimeConstant: 325,
      inertiaMinSpeed: 0.15,
      dragThreshold: 6,
      now: () => performance.now(),
      requestFrame: callback => requestAnimationFrame(callback),
      cancelFrame: handle => cancelAnimationFrame(handle),
      ...options,
    };
  }

  public get transform(): ViewTransform {
    return this._transform;
  }

  /** Whether the current/last press moved far enough to count as a drag (used to suppress clicks). */
  public get moved(): boolean {
    return this._moved;
  }

  public get isAnimating(): boolean {
    return this._frame !== undefined;
  }

  /**
   * Whether a press at this point continues a double tap (or already does). Browsers would
   * otherwise treat a long second tap as the start of a text selection.
   */
  public isDoubleTapPress(point: Point): boolean {
    if (this._tapZoom) return true;
    const lastTap = this._lastTap;
    return (
      !!lastTap &&
      this._options.now() - lastTap.t <= DOUBLE_TAP_MS &&
      Math.hypot(point.x - lastTap.x, point.y - lastTap.y) <= DOUBLE_TAP_DISTANCE
    );
  }

  /** Whether a gesture or animation is in progress. */
  public get isActive(): boolean {
    return this._pointers.size > 0 || this.isAnimating;
  }

  public setTransform(transform: ViewTransform) {
    this.stopAnimation();
    this._raw = transform;
    this.apply(transform);
  }

  // ---- Pointer input ----

  public pointerDown(id: number, point: Point) {
    this.stopAnimation();
    this._pointers.set(id, point);
    this._raw = this._transform;

    if (this._pointers.size === 1) {
      this._moved = false;
      this._wasPinching = false;
      this._pressStart = point;

      const lastTap = this._lastTap;
      this._lastTap = undefined;
      if (
        lastTap &&
        this._options.now() - lastTap.t <= DOUBLE_TAP_MS &&
        Math.hypot(point.x - lastTap.x, point.y - lastTap.y) <= DOUBLE_TAP_DISTANCE
      ) {
        this.startTapZoom(point);
      } else {
        this.startPan(point);
      }
    } else if (this._pointers.size === 2) {
      this._moved = true;
      this._wasPinching = true;
      this._tapZoom = undefined;
      this.startPinch();
    }
  }

  public pointerMove(id: number, point: Point) {
    if (!this._pointers.has(id)) return;
    this._pointers.set(id, point);

    if (this._pointers.size >= 2) {
      this.updatePinch();
      return;
    }

    if (
      !this._moved &&
      this._pressStart &&
      Math.hypot(point.x - this._pressStart.x, point.y - this._pressStart.y) >=
        this._options.dragThreshold
    ) {
      this._moved = true;
    }

    if (this._tapZoom) {
      if (!this._moved) return;
      const { anchor, world, k, startY } = this._tapZoom;
      const newK = this.clampScale(k * Math.exp((startY - point.y) * TAP_ZOOM_SENSITIVITY));
      this.applyRaw({ x: anchor.x - world.x * newK, y: anchor.y - world.y * newK, k: newK });
      return;
    }

    if (!this._panLast) return;
    const { x, y, k } = this._raw;
    this.applyRaw({ x: x + point.x - this._panLast.x, y: y + point.y - this._panLast.y, k });
    this._panLast = point;
    this.addSample(point);
  }

  public pointerUp(id: number, point?: Point) {
    if (!this._pointers.has(id)) return;
    if (point) this.pointerMove(id, point);
    this._pointers.delete(id);

    if (this._pointers.size === 1) {
      // Pinch ended but one finger is still down: continue panning from that finger.
      this._pinch = undefined;
      this._raw = this._transform;
      this.startPan([...this._pointers.values()][0]);
      return;
    }
    if (this._pointers.size > 0) return;

    const tapZoom = this._tapZoom;
    this._pinch = undefined;
    this._panLast = undefined;
    this._tapZoom = undefined;

    if (tapZoom) {
      if (this._moved) {
        this.settle();
      } else {
        this.zoomAt(2, tapZoom.anchor, true);
      }
    } else if (this._wasPinching) {
      this.settle();
    } else if (this._moved) {
      this.startInertia();
    } else if (point) {
      this._lastTap = { t: this._options.now(), ...point };
    }
  }

  public pointerCancel(id: number) {
    this._pointers.delete(id);
    if (this._pointers.size === 0) {
      this._pinch = undefined;
      this._panLast = undefined;
      this._tapZoom = undefined;
      this._samples = [];
      this.settle();
    }
  }

  // ---- Zooming ----

  /** Zooms by `factor` keeping the given screen point fixed. */
  public zoomAt(factor: number, center: Point, animate = false) {
    const { x, y, k } = this._transform;
    const newK = this.clampScale(k * factor);
    const worldX = (center.x - x) / k;
    const worldY = (center.y - y) / k;
    this.goTo({ x: center.x - worldX * newK, y: center.y - worldY * newK, k: newK }, animate);
  }

  /** Handles a wheel event's delta. Ctrl/meta + wheel is how trackpad pinches are reported. */
  public wheel(deltaY: number, deltaMode: number, center: Point, pinch: boolean) {
    const pixels = deltaMode === 1 ? deltaY * 20 : deltaMode === 2 ? deltaY * 400 : deltaY;
    const factor = Math.exp(-pixels * (pinch ? 0.01 : 0.002));
    this.zoomAt(factor, center);
  }

  /** Moves and scales so that `bounds` (world coordinates) fits into the viewport. */
  public fit(bounds: Rect, viewport: Size, padding: number, animate = false) {
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const k = this.clampScale(
      Math.min(
        (viewport.width - 2 * padding) / bounds.width,
        (viewport.height - 2 * padding) / bounds.height
      )
    );
    this.goTo(
      {
        x: viewport.width / 2 - (bounds.x + bounds.width / 2) * k,
        y: viewport.height / 2 - (bounds.y + bounds.height / 2) * k,
        k,
      },
      animate
    );
  }

  /** Moves the given world point to the center of the viewport, optionally changing the scale. */
  public centerOn(world: Point, viewport: Size, animate = false, k = this._transform.k) {
    k = this.clampScale(k);
    this.goTo(
      { x: viewport.width / 2 - world.x * k, y: viewport.height / 2 - world.y * k, k },
      animate
    );
  }

  /**
   * Animates to the target. Position and scale are interpolated together around the screen point
   * that stays fixed between start and target (e.g. the tapped point when zooming), so the content
   * zooms "into" that point instead of drifting away and back.
   */
  public animateTo(target: ViewTransform, duration = 350) {
    this.stopAnimation();
    const start = this._transform;
    const startTime = this._options.now();
    const zooms = Math.abs(target.k / start.k - 1) > 1e-6;
    // Screen point p with: (p - start.xy) / start.k === (p - target.xy) / target.k
    const fixed = zooms
      ? {
          x: (target.x * start.k - start.x * target.k) / (start.k - target.k),
          y: (target.y * start.k - start.y * target.k) / (start.k - target.k),
        }
      : undefined;

    const step = () => {
      const t = Math.min(1, (this._options.now() - startTime) / duration);
      const e = easeOutCubic(t);
      let transform: ViewTransform;
      if (t >= 1) {
        transform = target;
      } else if (fixed) {
        // Interpolate the scale logarithmically so zooming feels uniform.
        const k = start.k * (target.k / start.k) ** e;
        const ratio = k / start.k;
        transform = {
          x: fixed.x - (fixed.x - start.x) * ratio,
          y: fixed.y - (fixed.y - start.y) * ratio,
          k,
        };
      } else {
        transform = {
          x: start.x + (target.x - start.x) * e,
          y: start.y + (target.y - start.y) * e,
          k: start.k,
        };
      }
      this._raw = transform;
      this.apply(transform);
      this._frame = t < 1 ? this._options.requestFrame(step) : undefined;
    };
    this._frame = this._options.requestFrame(step);
  }

  public stopAnimation() {
    if (this._frame !== undefined) {
      this._options.cancelFrame(this._frame);
      this._frame = undefined;
    }
  }

  /** Bounces back into the allowed area if the content was moved out of it. */
  public settle() {
    const target = this.clamp(this._transform);
    if (target.x !== this._transform.x || target.y !== this._transform.y) {
      this.animateTo(target, BOUNCE_DURATION_MS);
    }
  }

  // ---- Internals ----

  private goTo(target: ViewTransform, animate: boolean) {
    target = this.clamp(target);
    if (animate) {
      this.animateTo(target);
    } else {
      this.setTransform(target);
    }
  }

  private startPan(point: Point) {
    this._tapZoom = undefined;
    this._panLast = point;
    this._samples = [];
    this.addSample(point);
  }

  private startTapZoom(point: Point) {
    const { x, y, k } = this._transform;
    this._panLast = undefined;
    this._samples = [];
    this._tapZoom = {
      anchor: point,
      world: { x: (point.x - x) / k, y: (point.y - y) / k },
      k,
      startY: point.y,
    };
  }

  private startPinch() {
    const [a, b] = [...this._pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const { x, y, k } = this._raw;
    this._panLast = undefined;
    this._samples = [];
    this._pinch = {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      world: { x: (mid.x - x) / k, y: (mid.y - y) / k },
      k,
    };
  }

  private updatePinch() {
    if (!this._pinch) return;
    const [a, b] = [...this._pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const k = this.clampScale((this._pinch.k * distance) / this._pinch.distance);
    // Keep the world point that was under the fingers' midpoint at the start under the midpoint.
    this.applyRaw({ x: mid.x - this._pinch.world.x * k, y: mid.y - this._pinch.world.y * k, k });
  }

  private addSample(point: Point) {
    const t = this._options.now();
    this._samples.push({ t, ...point });
    while (this._samples.length > 2 && t - this._samples[0].t > VELOCITY_WINDOW_MS) {
      this._samples.shift();
    }
  }

  private releaseVelocity(): Point {
    const now = this._options.now();
    const samples = this._samples.filter(s => now - s.t <= VELOCITY_WINDOW_MS);
    if (samples.length < 2) return { x: 0, y: 0 };
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = Math.max(1, last.t - first.t);
    return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
  }

  private startInertia() {
    let velocity = this.releaseVelocity();
    this._samples = [];
    if (Math.hypot(velocity.x, velocity.y) < this._options.inertiaMinSpeed) {
      this.settle();
      return;
    }

    let lastTime = this._options.now();
    const step = (time: number) => {
      const dt = Math.max(0, time - lastTime);
      lastTime = time;
      // Once the content runs past the bounds it slows down much faster, then bounces back.
      const overscrolled = !this.isWithinBounds(this._transform);
      const tau = overscrolled ? OVERSCROLL_TIME_CONSTANT : this._options.inertiaTimeConstant;
      const decay = Math.exp(-dt / tau);
      // Integral of v * e^(-t/τ) over dt: the distance travelled during this frame.
      const travel = tau * (1 - decay);
      const { x, y, k } = this._raw;
      this.applyRaw({ x: x + velocity.x * travel, y: y + velocity.y * travel, k });
      velocity = { x: velocity.x * decay, y: velocity.y * decay };
      if (Math.hypot(velocity.x, velocity.y) > STOP_SPEED) {
        this._frame = this._options.requestFrame(step);
      } else {
        this._frame = undefined;
        this.settle();
      }
    };
    this._frame = this._options.requestFrame(step);
  }

  /** Allowed range of the translation for the given scale, per axis. */
  private limits(k: number) {
    const constraints = this._options.getConstraints?.();
    if (!constraints) return undefined;
    const { bounds, viewport, margin } = constraints;
    const axis = (start: number, size: number, viewportSize: number) => {
      const m = Math.min(margin, viewportSize / 2, (size * k) / 2);
      // Content end must stay right of `m`, content start must stay left of `viewport - m`.
      const min = m - (start + size) * k;
      const max = viewportSize - m - start * k;
      return min <= max ? { min, max } : { min: (min + max) / 2, max: (min + max) / 2 };
    };
    return {
      x: axis(bounds.x, bounds.width, viewport.width),
      y: axis(bounds.y, bounds.height, viewport.height),
      viewport,
    };
  }

  private clamp(transform: ViewTransform): ViewTransform {
    const limits = this.limits(transform.k);
    if (!limits) return transform;
    return {
      x: Math.min(limits.x.max, Math.max(limits.x.min, transform.x)),
      y: Math.min(limits.y.max, Math.max(limits.y.min, transform.y)),
      k: transform.k,
    };
  }

  private isWithinBounds(transform: ViewTransform) {
    const clamped = this.clamp(transform);
    return clamped.x === transform.x && clamped.y === transform.y;
  }

  /** Applies a gesture's transform, adding resistance beyond the bounds. */
  private applyRaw(raw: ViewTransform) {
    this._raw = raw;
    const limits = this.limits(raw.k);
    if (!limits) {
      this.apply(raw);
      return;
    }
    const band = (value: number, range: { min: number; max: number }, dimension: number) =>
      value < range.min
        ? range.min - rubberBand(range.min - value, dimension)
        : value > range.max
          ? range.max + rubberBand(value - range.max, dimension)
          : value;
    this.apply({
      x: band(raw.x, limits.x, limits.viewport.width),
      y: band(raw.y, limits.y, limits.viewport.height),
      k: raw.k,
    });
  }

  private clampScale(k: number) {
    return Math.min(this._options.maxScale, Math.max(this._options.minScale, k));
  }

  private apply(transform: ViewTransform) {
    this._transform = transform;
    this._options.onChange(transform);
  }
}

/**
 * Connects a `PanZoomController` to an element's DOM events. Returns a function that removes
 * all listeners again.
 */
export function bindPanZoom(element: HTMLElement | SVGElement, controller: PanZoomController) {
  const local = (event: { clientX: number; clientY: number }): Point => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    controller.pointerDown(event.pointerId, local(event));
  };
  const onPointerMove = (event: PointerEvent) => {
    controller.pointerMove(event.pointerId, local(event));
    // Capture only once it is a drag; capturing right away would retarget clicks on posters.
    if (controller.moved && !element.hasPointerCapture(event.pointerId)) {
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is no longer active (e.g. it was lost); nothing to capture.
      }
    }
  };
  const onPointerUp = (event: PointerEvent) => {
    controller.pointerUp(event.pointerId, local(event));
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  };
  const onPointerCancel = (event: PointerEvent) => controller.pointerCancel(event.pointerId);

  // A drag must not end with a click on whatever is under the pointer (e.g. a poster).
  const onClickCapture = (event: MouseEvent) => {
    if (controller.moved) {
      event.stopPropagation();
      event.preventDefault();
    }
  };

  let wheelSettleTimer: ReturnType<typeof setTimeout> | undefined;
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    controller.wheel(event.deltaY, event.deltaMode, local(event), event.ctrlKey || event.metaKey);
    clearTimeout(wheelSettleTimer);
    wheelSettleTimer = setTimeout(() => controller.settle(), 150);
  };

  // Desktop Safari reports trackpad pinches as proprietary gesture events instead of ctrl + wheel.
  // On iOS they are fired in addition to the pointer events, which already handle pinching there.
  let gestureScale = 1;
  let activeTouches = 0;
  const onGestureStart = (event: Event) => {
    event.preventDefault();
    gestureScale = 1;
  };
  const onGestureChange = (event: Event) => {
    event.preventDefault();
    const gesture = event as Event & { scale: number; clientX: number; clientY: number };
    if (gesture.scale && activeTouches === 0) {
      controller.zoomAt(gesture.scale / gestureScale, local(gesture));
    }
    gestureScale = gesture.scale;
  };
  const onTouchCount = (event: Event) => {
    activeTouches = (event as TouchEvent).touches.length;
  };
  // iOS starts a text selection (with magnifier and Writing Tools) when the second tap of a double
  // tap is held. Cancelling that touch's default behavior prevents it; the pointer events that
  // drive the zoom are not affected.
  const onTouchStart = (event: Event) => {
    const touchEvent = event as TouchEvent;
    activeTouches = touchEvent.touches.length;
    const touch = touchEvent.changedTouches[0];
    if (touchEvent.touches.length === 1 && touch && controller.isDoubleTapPress(local(touch))) {
      event.preventDefault();
    }
  };
  const preventDefault = (event: Event) => event.preventDefault();

  const listeners: [string, EventListener, AddEventListenerOptions?][] = [
    ['pointerdown', onPointerDown as EventListener],
    ['pointermove', onPointerMove as EventListener],
    ['pointerup', onPointerUp as EventListener],
    ['pointercancel', onPointerCancel as EventListener],
    ['click', onClickCapture as EventListener, { capture: true }],
    ['wheel', onWheel as EventListener, { passive: false }],
    ['gesturestart', onGestureStart, { passive: false }],
    ['gesturechange', onGestureChange, { passive: false }],
    ['touchstart', onTouchStart, { passive: false }],
    ['selectstart', preventDefault],
    ['contextmenu', preventDefault],
    ['touchend', onTouchCount, { passive: true }],
    ['touchcancel', onTouchCount, { passive: true }],
  ];
  for (const [type, listener, options] of listeners) {
    element.addEventListener(type, listener, options);
  }
  return () => {
    controller.stopAnimation();
    clearTimeout(wheelSettleTimer);
    for (const [type, listener, options] of listeners) {
      element.removeEventListener(type, listener, options);
    }
  };
}
