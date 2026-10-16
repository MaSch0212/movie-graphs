import { startPage } from './last-page';

describe('startPage', () => {
  const runAs = (homeScreenApp: boolean) =>
    vi.stubGlobal('matchMedia', () => ({ matches: homeScreenApp }));

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('returns to the last page in the home screen app', () => {
    runAs(true);
    expect(startPage()).toBe('/home');
    localStorage.setItem('movie-graphs.last-page', '/graph/u1ILrCUB');
    expect(startPage()).toBe('/graph/u1ILrCUB');
  });

  it('only returns to pages of this app', () => {
    runAs(true);
    localStorage.setItem('movie-graphs.last-page', '//example.com');
    expect(startPage()).toBe('/home');
  });

  it('starts at the home page in the browser', () => {
    runAs(false);
    localStorage.setItem('movie-graphs.last-page', '/graph/u1ILrCUB');
    expect(startPage()).toBe('/home');
  });
});
