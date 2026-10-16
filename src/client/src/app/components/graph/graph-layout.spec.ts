import { ARROW_GAP, ARROW_LENGTH, ARROW_WIDTH, edgeGeometry } from './graph-layout';

const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const shorten = ARROW_GAP + ARROW_LENGTH - 1;

describe('edgeGeometry', () => {
  it('keeps a gap at both ends of a straight edge and ends the line at the arrow head', () => {
    const { path, arrow } = edgeGeometry([
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    ]);
    const tip = 100 - ARROW_GAP;
    // Line starts away from the source and stops just inside the arrow head.
    expect(numbers(path)).toEqual([ARROW_GAP, 0, 100 - shorten, 0]);
    // Tip in front of the target, base corners perpendicular to the direction.
    expect(numbers(arrow)).toEqual([
      tip,
      0,
      tip - ARROW_LENGTH,
      ARROW_WIDTH / 2,
      tip - ARROW_LENGTH,
      -ARROW_WIDTH / 2,
    ]);
  });

  it('makes curves leave and enter horizontally, so arrows never point steeply into a poster', () => {
    const { path, arrow } = edgeGeometry([
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 70, y: 60 }, // ELK would let the curve arrive diagonally
        { x: 100, y: 100 },
      ],
    ]);
    // The last control point is moved to the left of the end point (its distance, at most 40),
    // then the end moves back for the arrow head together with it.
    expect(path).toBe(`M${ARROW_GAP},0 C30,0 ${100 - 40 - shorten},100 ${100 - shorten},100`);
    const tip = 100 - ARROW_GAP;
    expect(numbers(arrow)).toEqual([
      tip,
      100,
      tip - ARROW_LENGTH,
      100 + ARROW_WIDTH / 2,
      tip - ARROW_LENGTH,
      100 - ARROW_WIDTH / 2,
    ]);
  });

  it('only changes the start of the first and the end of the last section', () => {
    const { path } = edgeGeometry([
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [
        { x: 10, y: 0 },
        { x: 10, y: 50 },
      ],
    ]);
    expect(path).toBe(`M${ARROW_GAP},0 L10,0 M10,0 L10,${50 - shorten}`);
  });
});
