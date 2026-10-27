/**
 * Stand-up Pouch Geometry module (public/three/geometry/standup-pouch.js)
 * Re-exports PouchGeometryManager for flexible stand-up pouch construction.
 */

import { PouchGeometryManager } from './pouch.js';

export { PouchGeometryManager };
export const StandupPouchGeometryManager = PouchGeometryManager;
