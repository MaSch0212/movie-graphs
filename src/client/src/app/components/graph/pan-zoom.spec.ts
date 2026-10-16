import { PanZoomConstraints, PanZoomController, ViewTransform } from './pan-zoom';

function createController(constraints?: PanZoomConstraints) {
  let time = 0;
  let frames: ((time: number) => void)[] = [];
  const changes: ViewTransform[] = [];
  const controller = new PanZoomController({
    minScale: 0.1,
    maxScale: 4,
    onChange: t => changes.push(t),
    now: () => time,
    requestFrame: callback => frames.push(callback),
    cancelFrame: () => (frames = []),
    getConstraints: () => constraints,
  });
  return {
    controller,
    changes,
    advance(ms: number) {
      time += ms;
    },
    /** Runs animation frames at 60 fps until the animation stops (or the limit is reached). */
    runFrames(limit = 1000) {
      let count = 0;
      while (frames.length > 0 && count < limit) {
        const pending = frames;
        frames = [];
        time += 16;
        pending.forEach(frame => frame(time));
        count++;
      }
      return count;
    },
  };
}

describe('PanZoomController', () => {
  it('pans with a single pointer', () => {
    const { controller, advance } = createController();
    controller.pointerDown(1, { x: 100, y: 100 });
    advance(16);
    controller.pointerMove(1, { x: 130, y: 90 });
    expect(controller.transform).toEqual({ x: 30, y: -10, k: 1 });
    expect(controller.moved).toBe(true);
  });

  it('does not treat small movements as a drag', () => {
    const { controller } = createController();
    controller.pointerDown(1, { x: 100, y: 100 });
    controller.pointerMove(1, { x: 102, y: 101 });
    controller.pointerUp(1, { x: 102, y: 101 });
    expect(controller.moved).toBe(false);
    expect(controller.isAnimating).toBe(false);
  });

  it('keeps sliding with decaying speed after a fast flick', () => {
    const { controller, advance, runFrames } = createController();
    controller.pointerDown(1, { x: 0, y: 0 });
    for (let i = 1; i <= 5; i++) {
      advance(16);
      controller.pointerMove(1, { x: i * 16, y: 0 }); // 1 px/ms
    }
    controller.pointerUp(1);
    const releasedAt = controller.transform.x;
    expect(controller.isAnimating).toBe(true);

    const frames = runFrames();
    const travelled = controller.transform.x - releasedAt;
    // With v0 = 1 px/ms and τ = 325 ms the total momentum distance approaches v0 * τ.
    expect(travelled).toBeGreaterThan(250);
    expect(travelled).toBeLessThan(330);
    expect(frames).toBeGreaterThan(10);
    expect(controller.isAnimating).toBe(false);
  });

  it('does not slide after the pointer rested before release', () => {
    const { controller, advance } = createController();
    controller.pointerDown(1, { x: 0, y: 0 });
    advance(16);
    controller.pointerMove(1, { x: 50, y: 0 });
    advance(300); // finger held still
    controller.pointerUp(1);
    expect(controller.isAnimating).toBe(false);
  });

  it('stops the momentum when the canvas is touched again', () => {
    const { controller, advance, runFrames } = createController();
    controller.pointerDown(1, { x: 0, y: 0 });
    advance(16);
    controller.pointerMove(1, { x: 30, y: 0 });
    controller.pointerUp(1);
    expect(controller.isAnimating).toBe(true);
    controller.pointerDown(2, { x: 0, y: 0 });
    expect(controller.isAnimating).toBe(false);
    expect(runFrames()).toBe(0);
  });

  it('pinch-zooms around the midpoint of two pointers', () => {
    const { controller } = createController();
    controller.pointerDown(1, { x: 100, y: 100 });
    controller.pointerDown(2, { x: 200, y: 100 });
    // Spread the fingers to twice the distance around the same midpoint (150, 100).
    controller.pointerMove(1, { x: 50, y: 100 });
    controller.pointerMove(2, { x: 250, y: 100 });
    const { x, y, k } = controller.transform;
    expect(k).toBeCloseTo(2);
    // The world point under the midpoint stays under the midpoint.
    expect((150 - x) / k).toBeCloseTo(150);
    expect((100 - y) / k).toBeCloseTo(100);
  });

  it('pans while pinching when the midpoint moves', () => {
    const { controller } = createController();
    controller.pointerDown(1, { x: 100, y: 100 });
    controller.pointerDown(2, { x: 200, y: 100 });
    controller.pointerMove(1, { x: 120, y: 140 });
    controller.pointerMove(2, { x: 220, y: 140 });
    expect(controller.transform).toEqual({ x: 20, y: 40, k: 1 });
  });

  it('does not start momentum after a pinch and continues panning with the remaining finger', () => {
    const { controller, advance } = createController();
    controller.pointerDown(1, { x: 100, y: 100 });
    controller.pointerDown(2, { x: 200, y: 100 });
    controller.pointerMove(2, { x: 300, y: 100 });
    controller.pointerUp(2);
    const afterPinch = controller.transform;
    advance(16);
    controller.pointerMove(1, { x: 110, y: 100 });
    expect(controller.transform.x).toBeCloseTo(afterPinch.x + 10);
    controller.pointerUp(1);
    expect(controller.isAnimating).toBe(false);
  });

  it('clamps the scale', () => {
    const { controller } = createController();
    controller.zoomAt(100, { x: 0, y: 0 });
    expect(controller.transform.k).toBe(4);
    controller.zoomAt(0.0001, { x: 0, y: 0 });
    expect(controller.transform.k).toBe(0.1);
  });

  it('zooms in on double tap', () => {
    const { controller, advance, runFrames } = createController();
    controller.pointerDown(1, { x: 50, y: 50 });
    controller.pointerUp(1, { x: 50, y: 50 });
    advance(150);
    controller.pointerDown(1, { x: 52, y: 51 });
    controller.pointerUp(1, { x: 52, y: 51 });
    runFrames();
    expect(controller.transform.k).toBeCloseTo(2);
  });

  it('fits bounds into the viewport', () => {
    const { controller } = createController();
    controller.fit({ x: 0, y: 0, width: 1000, height: 500 }, { width: 520, height: 520 }, 10);
    expect(controller.transform).toEqual({ x: 10, y: 135, k: 0.5 });
  });
  it('keeps the tapped point fixed while animating a double tap zoom', () => {
    const { controller, changes, advance, runFrames } = createController();
    controller.setTransform({ x: -500, y: -300, k: 0.5 });
    const tap = { x: 300, y: 200 };
    const world = { x: (tap.x + 500) / 0.5, y: (tap.y + 300) / 0.5 };
    controller.pointerDown(1, tap);
    controller.pointerUp(1, tap);
    advance(100);
    controller.pointerDown(1, tap);
    controller.pointerUp(1, tap);
    changes.length = 0;
    runFrames();
    expect(changes.length).toBeGreaterThan(5);
    for (const t of changes) {
      expect(world.x * t.k + t.x).toBeCloseTo(tap.x);
      expect(world.y * t.k + t.y).toBeCloseTo(tap.y);
    }
    expect(controller.transform.k).toBeCloseTo(1);
  });

  it('zooms with double tap and drag: up zooms in, down zooms out', () => {
    const { controller, advance } = createController();
    const tap = { x: 100, y: 100 };
    controller.pointerDown(1, tap);
    controller.pointerUp(1, tap);
    advance(100);
    controller.pointerDown(1, tap);
    controller.pointerMove(1, { x: 100, y: 50 });
    const zoomedIn = controller.transform;
    expect(zoomedIn.k).toBeGreaterThan(1.5);
    // The point where the second tap started stays in place.
    expect((tap.x - zoomedIn.x) / zoomedIn.k).toBeCloseTo(100);
    controller.pointerMove(1, { x: 100, y: 200 });
    expect(controller.transform.k).toBeLessThan(1);
    controller.pointerUp(1, { x: 100, y: 200 });
    expect(controller.moved).toBe(true);
    expect(controller.isAnimating).toBe(false);
  });

  it('adds resistance when dragging the content out of the viewport and bounces back', () => {
    const constraints = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      viewport: { width: 400, height: 400 },
      margin: 50,
    };
    const { controller, advance, runFrames } = createController(constraints);
    // Content may move right until only 50px of it are left: x <= 350.
    controller.pointerDown(1, { x: 0, y: 0 });
    advance(16);
    controller.pointerMove(1, { x: 500, y: 0 });
    expect(controller.transform.x).toBeGreaterThan(350);
    expect(controller.transform.x).toBeLessThan(500);
    advance(300);
    controller.pointerUp(1);
    runFrames();
    expect(controller.transform.x).toBeCloseTo(350);
  });

  it('bounces back when momentum carries the content out of the viewport', () => {
    const constraints = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      viewport: { width: 400, height: 400 },
      margin: 50,
    };
    const { controller, advance, runFrames } = createController(constraints);
    controller.pointerDown(1, { x: 0, y: 0 });
    for (let i = 1; i <= 5; i++) {
      advance(16);
      controller.pointerMove(1, { x: i * 40, y: 0 }); // 2.5 px/ms towards the right edge
    }
    controller.pointerUp(1);
    runFrames();
    expect(controller.transform.x).toBeCloseTo(350);
    expect(controller.isAnimating).toBe(false);
  });

  it('keeps animation targets within the bounds', () => {
    const { controller } = createController({
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      viewport: { width: 400, height: 400 },
      margin: 50,
    });
    controller.centerOn({ x: 5000, y: 50 }, { width: 400, height: 400 });
    expect(controller.transform.x).toBe(-50);
  });
  it('recognizes the second press of a double tap', () => {
    const { controller, advance } = createController();
    expect(controller.isDoubleTapPress({ x: 10, y: 10 })).toBe(false);
    controller.pointerDown(1, { x: 10, y: 10 });
    controller.pointerUp(1, { x: 10, y: 10 });
    advance(100);
    expect(controller.isDoubleTapPress({ x: 15, y: 12 })).toBe(true);
    expect(controller.isDoubleTapPress({ x: 200, y: 200 })).toBe(false);
    advance(400);
    expect(controller.isDoubleTapPress({ x: 15, y: 12 })).toBe(false);
  });
});
