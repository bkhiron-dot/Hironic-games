// Bike physics for one time step. All numbers are the tuned v1 values listed in
// CLAUDE.md "Tuned physics"; keep them unless Ben agrees a change.
//
// stepRide() changes the bike state `b` and returns a list of events for the rest
// of the game to act on, instead of touching the screen itself:
//   { type: 'toast', text }          show a message
//   { type: 'shake', amount }        shake the camera (heavy landing)
//   { type: 'landing', use, zone }   touched down: share of suspension travel used, and where
//   { type: 'crash', reason, big }   the rider came off; always the last event
import { clamp } from './util.js';
import { TREE_BUCKET_LENGTH } from './forest.js';

export const G = 9.8;      // gravity on the ground
export const G_AIR = 15;   // deliberately 1.5 g in the air for snappier, shorter jumps

export function createBikeState() {
  return {
    x: 0, y: 0, z: 0, h: 0,          // position and heading (see CLAUDE.md conventions)
    s: 0,                            // distance along the trail (m)
    v: 0, vy: 0,                     // forward speed and vertical speed (m/s)
    lean: 0, pitch: 0, steerIn: 0,   // body lean (rad), nose up/down (rad), steering input -1..1
    air: false, airT: 0,             // in the air, and for how long
    compress: 0,                     // how far Space has crouched the rider, 0..1
    susX: 0, susV: 0,                // visible suspension spring: compression (m) and its speed
    grip: 0, slide: 0,               // share of tyre grip in use, and how hard it's sliding 0..1
    drift: 0, slipV: 0,              // visual drift angle, sideways slip speed (m/s)
    slideMem: 0, caught: false,      // fades after a slide; a berm can catch you while it lasts
    fromLip: false, popped: false,   // left the ground off a kicker; already popped this jump
    stuckT: 0, slideToastT: 0,       // timers: stuck in a hole, and gap between drift messages
  };
}

// Put the bike on the trail's centreline at distance s, facing down the trail.
export function placeBikeAt(b, trail, s, speed) {
  const p = trail.pointAt(s);
  Object.assign(b, {
    x: p.x, z: p.z, s, y: trail.ground(s, 0), h: trail.headingAt(s), v: speed, vy: 0,
    lean: 0, air: false, pitch: 0, airT: 0, susX: 0, susV: 0, compress: 0, steerIn: 0,
    drift: 0, slide: 0, slipV: 0, slideMem: 0, caught: false,
  });
}

const forward = h => [Math.sin(h), -Math.cos(h)];

export function stepRide(b, keys, trail, treeBuckets, timing, dt) {
  const { groundAt } = trail;
  const events = [];
  const toast = text => events.push({ type: 'toast', text });
  const crash = (reason, big) => { events.push({ type: 'crash', reason, big }); return events; };

  const here = trail.locate(b.x, b.z), sNow = here.s, off = here.off;
  b.v = Math.max(0, b.v + alongTrackAccel(b, keys, trail, sNow, off) * dt);
  steer(b, keys, dt);
  // The rider's right, taken before cornering turns the bike; sideways slip moves along it.
  const rx = Math.cos(b.h), rz = Math.sin(b.h);
  corner(b, trail, sNow, off, dt, toast);

  // move: sideways slip, then forward along the new heading
  b.x += rx * b.slipV * dt; b.z += rz * b.slipV * dt;
  const f = forward(b.h);
  b.x += f[0] * b.v * dt; b.z += f[1] * b.v * dt;
  b.s = trail.locate(b.x, b.z).s;
  const gNew = groundAt(b.x, b.z);
  const slopeNew = (groundAt(b.x + f[0] * 0.6, b.z + f[1] * 0.6) - gNew) / 0.6;

  const landing = flyOrFollowGround(b, trail, gNew, slopeNew, dt, events);
  if (landing) return crash(landing.reason, landing.big);
  hopAndPop(b, trail, keys, dt, toast);

  // stuck (e.g. rolled into a jump hole): after 2.5 s treat it as a small crash and walk it out
  if (timing && !b.air && b.v < 0.4 && !keys.pedal) b.stuckT += dt; else b.stuckT = 0;
  if (b.stuckT > 2.5) { b.stuckT = 0; return crash('stuck in the gap', false); }

  // nose follows the ground, or tips with the flight path in the air (visual only)
  const targetPitch = b.air ? Math.atan2(b.vy, Math.max(b.v, 1)) * 0.6 : Math.atan(slopeNew);
  b.pitch += (targetPitch - b.pitch) * Math.min(1, dt * 10);

  const tree = hitTree(b, treeBuckets);
  if (tree) return crash(tree.reason, tree.big);
  return events;
}

// Forward acceleration from slope, pedalling, braking, rolling resistance and drag.
function alongTrackAccel(b, keys, trail, s, off) {
  const { groundAt, halfWidth } = trail;
  if (b.air) return -0.003 * b.v * b.v; // only air drag
  const f = forward(b.h);
  const gy = groundAt(b.x, b.z), gAhead = groundAt(b.x + f[0] * 0.6, b.z + f[1] * 0.6);
  const slope = (gAhead - gy) / 0.6;
  let a = -G * slope / Math.sqrt(1 + slope * slope);
  if (keys.pedal) a += 3.0 * clamp((13 - b.v) / 5, 0, 1); // pedalling fades out between 8 and 13 m/s
  if (keys.brake && b.v > 0.1) a -= 8;
  const offTrail = Math.abs(off) > halfWidth(s) + 0.3;
  a -= (offTrail ? 1.8 : 0.12) + 0.0045 * b.v * b.v;
  return a;
}

// Progressive steering: holding left/right builds to full lean in about 0.3 s; a tap is a
// small correction. Turning the other way snaps across faster.
function steer(b, keys, dt) {
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir !== 0) {
    const rate = (b.steerIn !== 0 && Math.sign(b.steerIn) !== dir) ? 12 : 3.6;
    b.steerIn = clamp(b.steerIn + dir * rate * dt, -1, 1);
  } else {
    b.steerIn -= Math.sign(b.steerIn) * Math.min(Math.abs(b.steerIn), 8 * dt);
  }
  b.lean += (b.steerIn * 0.8 - b.lean) * Math.min(1, dt * (b.air ? 3 : 14));
}

// Cornering: lean asks for sideways grip; tyres and berms decide how much you get.
function corner(b, trail, s, off, dt, toast) {
  const { groundAt, halfWidth } = trail;
  b.slide = 0; b.grip = 0;
  const rx = Math.cos(b.h), rz = Math.sin(b.h); // rider's right, flat
  if (b.air) {
    b.drift *= Math.exp(-dt * 3);
  } else if (b.v > 3) {
    // Lean asks for lateral accel g*tan(lean). Tyres give mu*g on flat dirt; a berm rising
    // toward the outside of the turn adds support: aMax = g(mu + tan b)/(1 - mu tan b).
    const aDemand = G * Math.tan(b.lean), turn = Math.sign(aDemand) || 1;
    const gRight = groundAt(b.x + rx * 0.5, b.z + rz * 0.5), gLeft = groundAt(b.x - rx * 0.5, b.z - rz * 0.5);
    const mu = Math.abs(off) <= halfWidth(s) + 0.3 ? 0.75 : 0.5;
    const tanBank = clamp(turn * (gLeft - gRight), -0.6, 1 / mu - 0.15);
    const aMax = G * (mu + tanBank) / (1 - mu * tanBank);
    b.grip = Math.abs(aDemand) / aMax;
    let aUse = aDemand;
    if (Math.abs(aDemand) > aMax) {
      // Drift: the tyres let go, the rear steps out and you slide sideways toward the
      // outside of the corner, scrubbing a little speed.
      const excess = Math.abs(aDemand) - aMax;
      aUse = turn * aMax;
      b.slide = Math.min(1, excess / aMax * 1.5);
      b.v = Math.max(0, b.v - excess * 0.22 * dt);
      b.slipV = clamp(b.slipV - turn * excess * 0.55 * dt, -4, 4);
      b.slideMem = 1;
    }
    const onBerm = tanBank > 0.25;
    if (onBerm && b.slideMem > 0) {
      // Berm catch: the wall stops the sideways slide and pushes the bike back round the
      // corner, giving back some of the speed the slide scrubbed.
      b.slipV *= Math.exp(-9 * dt);
      aUse += turn * G * Math.min(0.6, tanBank * 0.8);
      b.v += Math.min(1.5, Math.abs(b.slipV) * 0.4) * dt;
      if (!b.caught && b.slide < 0.15) { toast('Berm caught you!'); b.caught = true; }
    } else {
      b.slipV *= Math.exp(-(b.slide > 0 ? 0.6 : 2.5) * dt);
    }
    b.h += clamp(aUse / b.v, -2.6, 2.6) * dt;
    b.drift += (turn * Math.max(b.slide, onBerm && b.slideMem > 0 ? 0.35 * b.slideMem : 0) * 0.55 - b.drift) * Math.min(1, dt * 6);
  } else {
    // walking pace: steer directly
    b.h += b.steerIn * 2.0 * dt; b.drift *= 0.9; b.slipV *= 0.9;
  }
  b.slideMem = Math.max(0, b.slideMem - dt * 0.8);
  if (b.slideMem === 0) b.caught = false;
  b.slideToastT -= dt;
  if (b.slide > 0.25 && b.slideToastT <= 0) { toast('Drifting: ride up the berm to hook back in'); b.slideToastT = 3; }
}

// In the air: fly and check for a landing. On the ground: follow it, or take off if the
// ground drops away faster than gravity can pull the bike down. Returns a crash or null.
function flyOrFollowGround(b, trail, gNew, slopeNew, dt, events) {
  if (!b.air) {
    const followVy = (gNew - b.y) / dt;
    if (followVy < b.vy - G * dt && followVy < -1.5) {
      b.fromLip = !!trail.kickerAt(b.s - 1.5); b.popped = false;
      b.air = true; b.airT = 0; b.vy -= G_AIR * dt; b.y += b.vy * dt;
    } else { b.vy = followVy; b.y = gNew; }
    return null;
  }
  b.airT += dt;
  b.vy -= G_AIR * dt; b.y += b.vy * dt;
  if (b.y > gNew) return null;

  // Landing. Impact is the speed into the ground surface (normal to the slope).
  // Fork, shock and legs give about 0.55 m of usable travel (less if already crouched).
  // Stopping in that travel at about 38 m/s^2 decides how the landing goes.
  const vi = Math.max(0, (slopeNew * b.v - b.vy) / Math.sqrt(1 + slopeNew * slopeNew));
  const travel = 0.55 - (b.compress > 0.5 ? 0.15 : 0);
  const use = (vi * vi / (2 * 38)) / travel + Math.max(0, Math.abs(b.lean) - 0.4) * 1.2;
  b.y = gNew; b.air = false; b.vy = slopeNew * b.v;
  b.susV += vi * 0.55;
  const zone = trail.jumpZone(b.s), big = b.airT > 0.45;
  events.push({ type: 'landing', use, zone });
  if (use >= 1.35) return { reason: zone === 'gap' || zone === 'knuckle' ? 'cased the landing' : 'flat landing, suspension bottomed out', big: true };
  if (use >= 1.0) return { reason: 'bottomed out the suspension', big: false };
  if (use >= 0.55) {
    b.v *= 0.93;
    events.push({ type: 'shake', amount: Math.min(0.5, use * 0.35) });
    if (big) events.push({ type: 'toast', text: 'Heavy landing' });
  } else if (big) events.push({ type: 'toast', text: zone === 'sweet' ? 'Sweet landing' : 'Clean landing' });
  b.airT = 0;
  return null;
}

// Space: hold to crouch, release to hop. Released at a jump lip it's a pop.
function hopAndPop(b, trail, keys, dt, toast) {
  if (keys.hop && !b.air) { b.compress = Math.min(1, b.compress + dt * 4); return; }
  if (keys.hop || b.compress <= 0) return;
  // Pop: release in the last 4 m of a kicker, or within 0.15 s of leaving the lip, for a big lift.
  const k = trail.kickerAt(b.s), c = b.compress;
  const popToast = () => toast(c > 0.8 ? 'Big pop!' : 'Pop (hold Space longer for more)');
  if (!b.air && k && k.u > -4) { b.vy += 1.0 + 2.0 * c; b.air = true; b.airT = 0; b.y += 0.02; b.popped = true; popToast(); }
  else if (b.air && b.airT < 0.15 && b.fromLip && !b.popped) { b.vy += (1.0 + 2.0 * c) * 0.85; b.popped = true; popToast(); }
  else if (!b.air && c > 0.3) { b.vy += 1.6 + 2.2 * c; b.air = true; b.airT = 0; b.y += 0.02; } // plain hop
  b.compress = 0;
}

// Trees: slower than 2.5 m/s you just stop against it; otherwise a crash, big from 9 m/s (32 km/h).
function hitTree(b, treeBuckets) {
  const bucket = Math.floor(b.s / TREE_BUCKET_LENGTH);
  for (let k = bucket - 1; k <= bucket + 1; k++) {
    const list = treeBuckets[k];
    if (!list) continue;
    for (const t of list) {
      const dx = t.x - b.x, dz = t.z - b.z, r = t.r + 0.38;
      if (dx * dx + dz * dz < r * r) {
        if (b.v < 2.5) {
          const d = Math.sqrt(dx * dx + dz * dz) || 1;
          b.x -= dx / d * (r - d + 0.02); b.z -= dz / d * (r - d + 0.02); b.v = 0;
        } else return { reason: 'hit a tree', big: b.v >= 9 };
      }
    }
  }
  return null;
}

// The visible suspension: a damped spring (k 170, c 18) that bottoms out at 0.18 m.
// Purely visual; landings kick it via b.susV.
export function stepSuspension(b, dt, onGround) {
  if (onGround) {
    const acc = -170 * b.susX - 18 * b.susV;
    b.susV += acc * dt; b.susX += b.susV * dt;
    if (b.susX > 0.18) { b.susX = 0.18; if (b.susV > 0) b.susV = 0; }
    if (b.susX < -0.03) { b.susX = -0.03; if (b.susV < 0) b.susV = 0; }
  } else { b.susX *= Math.exp(-dt * 6); b.susV = 0; }
}
