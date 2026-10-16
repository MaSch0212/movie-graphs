/** Converts a .NET `TimeSpan` string (`[d.]hh:mm[:ss[.fffffff]]`) to whole minutes. */
export function fromTimeSpan(timeSpan: string): number {
  const match = /^(?:(\d+)\.)?(\d+):(\d+)(?::(\d+)(?:\.\d+)?)?$/.exec(timeSpan.trim());
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match;
  return (
    Number(days ?? 0) * 24 * 60 +
    Number(hours) * 60 +
    Number(minutes) +
    Math.round(Number(seconds ?? 0) / 60)
  );
}

/** Converts minutes to a .NET `TimeSpan` string. */
export function toTimeSpan(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const pad = (value: number) => String(value).padStart(2, '0');
  const time = `${pad(hours)}:${pad(minutes % 60)}:00`;
  return days > 0 ? `${days}.${time}` : time;
}
