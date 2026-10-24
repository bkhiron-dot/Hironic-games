// Every module imports Three.js through this file, so this setting is in place
// before any colour is created.
//
// v1 ran on Three.js r128, where hex colours were used exactly as written. Newer
// versions convert colours between colour spaces by default, which washes out the
// terrain. Turning that off keeps v1's look (see CLAUDE.md "Known gotchas").
import { ColorManagement } from 'three';

ColorManagement.enabled = false;

export * from 'three';
