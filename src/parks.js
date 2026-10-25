// Bike parks. The game can grow to more parks over time, each with its own trails (and later
// its stages and trailheads). For now there is one: Maydena Bike Park in Tasmania, where the
// trails are a mid-mountain stage (see docs/v2-trailhead-spec.md, "The mountain").
import { TRAILS } from './trails/index.js';

export const MAYDENA = { id: 'maydena', name: 'Maydena Bike Park', place: 'Tasmania, Australia', trails: TRAILS };
export const PARKS = [MAYDENA];
