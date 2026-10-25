// Version numbers (Ben, 25 Oct). The live game (main) and the test version (next) count
// separately, so each has its own number:
//  - every change merged into next adds a minor version to next (1.1, 1.2, ...) for a
//    refinement (a trail line, a jump, the physics), or a major version (2.0) for a new
//    trail or a big new feature;
//  - every release to main does the same to main's number, by what the release brings.
// Both numbers live here (next carries main's too, so a release just bumps `main`).
// CHANGELOG.md lists what each version changed.
export const VERSIONS = { main: '1.2', next: '2.0' };

// Which build this is, from the address it's served at: the live game (main), a preview
// (next, at .../preview/pr-N/), or anything else (a local dev server).
export function channelOf(location) {
  if (/\/preview\/pr-\d+\//.test(location.pathname)) return 'next';
  if (location.hostname.endsWith('github.io')) return 'main';
  return 'dev';
}

// What the start screen shows, e.g. "v1.0 main", or on a preview "v1.1 next (live game v1.0)".
export function versionLabel(channel) {
  if (channel === 'main') return `v${VERSIONS.main} main`;
  const live = ` (live game v${VERSIONS.main})`;
  return channel === 'next' ? `v${VERSIONS.next} next${live}` : `v${VERSIONS.next} next, local build${live}`;
}
