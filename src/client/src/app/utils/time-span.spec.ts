import { fromTimeSpan, toTimeSpan } from './time-span';

describe('time-span', () => {
  it.each([
    ['02:07:00', 127],
    ['00:04:00', 4],
    ['1.02:00:00', 26 * 60],
    ['00:45:30', 46],
    ['01:30:00.0000000', 90],
    ['invalid', 0],
  ])('converts %s to %i minutes', (timeSpan, minutes) => {
    expect(fromTimeSpan(timeSpan)).toBe(minutes);
  });

  it.each([
    [127, '02:07:00'],
    [4, '00:04:00'],
    [26 * 60 + 5, '1.02:05:00'],
    [0, '00:00:00'],
  ])('converts %i minutes to %s', (minutes, timeSpan) => {
    expect(toTimeSpan(minutes)).toBe(timeSpan);
  });
});
