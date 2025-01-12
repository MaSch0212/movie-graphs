import { Logger } from './logger';

function getLocalStorage(key: string): string | null {
  return localStorage.getItem(key);
}
function setLocalStorage(key: string, value: string | null) {
  const oldValue = localStorage.getItem(key);
  if (oldValue === value) return;
  if (value) {
    Logger.logDebug('Storage', `Setting local storage key "${key}"`, {
      from: localStorage.getItem(key),
      to: value,
    });
    localStorage.setItem(key, value);
  } else {
    Logger.logDebug('Storage', `Removing local storage key "${key}"`, {
      from: localStorage.getItem(key),
    });
    localStorage.removeItem(key);
  }
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const logLevelDefaults: { [L in LogLevel]: 'true' | 'false' } = {
  debug: 'false',
  info: 'true',
  warn: 'true',
  error: 'true',
};
export function getLogLevelEnabled(level: LogLevel): boolean {
  return (getLocalStorage(`log_level_${level}`) ?? logLevelDefaults[level]) === 'true';
}
export function setLogLevelEnabled(level: LogLevel, enabled: boolean) {
  setLocalStorage(`log_level_${level}`, enabled ? 'true' : 'false');
}
