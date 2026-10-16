import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  // Not available in jsdom.
  beforeEach(() =>
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined }))
  );
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  function create() {
    TestBed.resetTestingModule();
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    return service;
  }

  it('follows the system by default', () => {
    const service = create();
    expect(service.choice()).toBeNull();
    expect(service.systemTheme()).toBe('dark');
    expect(service.currentTheme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('applies and remembers a fixed theme', () => {
    const service = create();
    service.setTheme('light');
    TestBed.tick();
    expect(service.currentTheme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');

    // Remembered on this device.
    const restarted = create();
    expect(restarted.choice()).toBe('light');

    restarted.setTheme(null);
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBeUndefined();
    expect(localStorage.getItem('theme')).toBeNull();
  });
});
