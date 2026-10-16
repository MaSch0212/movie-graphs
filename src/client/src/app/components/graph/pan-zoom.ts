export type ViewTransform = { x: number; y: number; k: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type PanZoomOptions = {
  minScale: number;
  maxScale: number;
  onChange: (transform: ViewTransform) => void;
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
const STOP_SPEED = 0.01;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE = 30;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Pan & zoom state machine for a 2D canvas, driven by pointer events.
 *
 * - One pointer pans; releasing it with speed continues the movement with decaying momentum.
 * - Two pointers pinch-zoom around their midpoint (and pan with it).
 * - Mouse wheel / trackpad pinch (ctrl + wheel, Safari gesture events) zoom around the cursor.
 * - Double click / double tap zooms in.
 *
 * All positions are in screen coordinates relative to the element's top left corner.
 * The resulting transform maps world coordinates to screen coordinates: `screen = world * k + (x, y)`.
 */
export class PanZoomController {
  private readonly _options: Required<PanZoomOptions>;
  private _transform: ViewTransform = { x: 0, y: 0, k: 1 };

  private readonly _pointers = new Map<number, Point>();
  private _panLast?: Point;
  private _pinch?: { distance: number; world: Point; k: number };
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

  public setTransform(transform: ViewTransform) {
    this.stopAnimation();
    this.apply(transform);
  }

  // ---- Pointer input ----

  public pointerDown(id: number, point: Point) {
    this.stopAnimation();
    this._pointers.set(id, point);

    if (this._pointers.size === 1) {
      this._moved = false;
      this._wasPinching = false;
      this._pressStart = point;
      this.startPan(point);
    } else if (this._pointers.size === 2) {
      this._moved = true;
      this._wasPinching = true;
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

    if (!this._panLast) return;
    if (
      !this._moved &&
      this._pressStart &&
      Math.hypot(point.x - this._pressStart.x, point.y - this._pressStart.y) >=
        this._options.dragThreshold
    ) {
      this._moved = true;
    }

    const { x, y, k } = this._transform;
    this.apply({ x: x + point.x - this._panLast.x, y: y + point.y - this._panLast.y, k });
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
      this.startPan([...this._pointers.values()][0]);
    } else if (this._pointers.size === 0) {
      this._pinch = undefined;
      this._panLast = undefined;
      if (!this._wasPinching) {
        if (this._moved) {
          this.startInertia();
        } else if (point) {
          this.detectDoubleTap(point);
        }
      }
    }
  }

  public pointerCancel(id: number) {
    this._pointers.delete(id);
    if (this._pointers.size === 0) {
      this._pinch = undefined;
      this._panLast = undefined;
      this._samples = [];
    }
  }

  // ---- Zooming ----

  /** Zooms by `factor` keeping the given screen point fixed. */
  public zoomAt(factor: number, center: Point, animate = false) {
    const { x, y, k } = this._transform;
    const newK = this.clampScale(k * factor);
    const worldX = (center.x - x) / k;
    const worldY = (center.y - y) / k;
    const target = { x: center.x - worldX * newK, y: center.y - worldY * newK, k: newK };
    if (animate) {
      this.animateTo(target);
    } else {
      this.setTransform(target);
    }
  }

  /** Handles a wheel event's delta. Ctrl/meta + wheel is how trackpad pinches are reported. */
  public wheel(deltaY: number, deltaMode: number, center: Point, pinch: boolean) {
    const pixels = deltaMode === 1 ? deltaY * 20 : deltaMode === 2 ? deltaY * 400 : deltaY;
    const factor = Math.exp(-pixels * (pinch ? 0.01 : 0.002));
    this.zoomAt(factor, center);
  }

  /** Moves and scales so that `bounds` (world coordinates) fits into the viewport. */
  public fit(
    bounds: Rect,
    viewport: { width: number; height: number },
    padding: number,
    animate = false
  ) {
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const k = this.clampScale(
      Math.min(
        (viewport.width - 2 * padding) / bounds.width,
        (viewport.height - 2 * padding) / bounds.height
      )
    );
    const target = {
      x: viewport.width / 2 - (bounds.x + bounds.width / 2) * k,
      y: viewport.height / 2 - (bounds.y + bounds.height / 2) * k,
      k,
    };
    if (animate) {
      this.animateTo(target);
    } else {
      this.setTransform(target);
    }
  }

  /** Moves the given world point to the center of the viewport. */
  public centerOn(world: Point, viewport: { width: number; height: number }, animate = false) {
    const { k } = this._transform;
    const target = { x: viewport.width / 2 - world.x * k, y: viewport.height / 2 - world.y * k, k };
    if (animate) {
      this.animateTo(target);
    } else {
      this.setTransform(target);
    }
  }

  public animateTo(target: ViewTransform, duration = 350) {
    this.stopAnimation();
    const start = this._transform;
    const startTime = this._options.now();
    const step = () => {
      const t = Math.min(1, (this._options.now() - startTime) / duration);
      const e = easeOutCubic(t);
      // Interpolate the scale logarithmically so zooming feels uniform.
      const k = start.k * (target.k / start.k) ** e;
      this.apply({
        x: start.x + (target.x - start.x) * e,
        y: start.y + (target.y - start.y) * e,
        k,
      });
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

  // ---- Internals ----

  private startPan(point: Point) {
    this._panLast = point;
    this._samples = [];
    this.addSample(point);
  }

  private startPinch() {
    const [a, b] = [...this._pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const { x, y, k } = this._transform;
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
    this.apply({ x: mid.x - this._pinch.world.x * k, y: mid.y - this._pinch.world.y * k, k });
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
    if (Math.hypot(velocity.x, velocity.y) < this._options.inertiaMinSpeed) return;

    let lastTime = this._options.now();
    const step = (time: number) => {
      const dt = Math.max(0, time - lastTime);
      lastTime = time;
      const decay = Math.exp(-dt / this._options.inertiaTimeConstant);
      // Integral of v * e^(-t/τ) over dt: the distance travelled during this frame.
      const travel = this._options.inertiaTimeConstant * (1 - decay);
      const { x, y, k } = this._transform;
      this.apply({ x: x + velocity.x * travel, y: y + velocity.y * travel, k });
      velocity = { x: velocity.x * decay, y: velocity.y * decay };
      this._frame =
        Math.hypot(velocity.x, velocity.y) > STOP_SPEED
          ? this._options.requestFrame(step)
          : undefined;
    };
    this._frame = this._options.requestFrame(step);
  }

  private detectDoubleTap(point: Point) {
    const now = this._options.now();
    const last = this._lastTap;
    if (
      last &&
      now - last.t <= DOUBLE_TAP_MS &&
      Math.hypot(point.x - last.x, point.y - last.y) <= DOUBLE_TAP_DISTANCE
    ) {
      this._lastTap = undefined;
      this.zoomAt(2, point, true);
    } else {
      this._lastTap = { t: now, ...point };
    }
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

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    controller.wheel(event.deltaY, event.deltaMode, local(event), event.ctrlKey || event.metaKey);
  };

  // Desktop Safari reports trackpad pinches as proprietary gesture events instead of ctrl + wheel.
  // On iOS they are fired in addition to the pointer events, which already handle pinching there.
  let gestureScale = 1;
  const onGestureStart = (event: Event) => {
    event.preventDefault();
    gestureScale = 1;
  };
  const onGestureChange = (event: Event) => {
    event.preventDefault();
    const gesture = event as Event & { scale: number; clientX: number; clientY: number };
    if (gesture.scale && !isTouchActive()) {
      controller.zoomAt(gesture.scale / gestureScale, local(gesture));
    }
    gestureScale = gesture.scale;
  };
  let activeTouches = 0;
  const isTouchActive = () => activeTouches > 0;
  const onTouchCount = (event: Event) => {
    activeTouches = (event as TouchEvent).touches.length;
  };

  const listeners: [string, EventListener, AddEventListenerOptions?][] = [
    ['pointerdown', onPointerDown as EventListener],
    ['pointermove', onPointerMove as EventListener],
    ['pointerup', onPointerUp as EventListener],
    ['pointercancel', onPointerCancel as EventListener],
    ['click', onClickCapture as EventListener, { capture: true }],
    ['wheel', onWheel as EventListener, { passive: false }],
    ['gesturestart', onGestureStart, { passive: false }],
    ['gesturechange', onGestureChange, { passive: false }],
    ['touchstart', onTouchCount, { passive: true }],
    ['touchend', onTouchCount, { passive: true }],
    ['touchcancel', onTouchCount, { passive: true }],
  ];
  for (const [type, listener, options] of listeners) {
    element.addEventListener(type, listener, options);
  }
  return () => {
    controller.stopAnimation();
    for (const [type, listener, options] of listeners) {
      element.removeEventListener(type, listener, options);
    }
  };
}
