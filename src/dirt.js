// Dirt thrown up by the tyres. Visual only: the physics never reads it.
//  - rolling straight: a few small crumbs flick up behind the back wheel, more the faster you go;
//  - drifting: progressively more, bigger clods and a dust cloud thrown out the side;
//  - a berm hit: an explosion of dirt off the berm wall;
//  - landings: a puff of dust under the wheels.
// Two kinds of particle share one buffer: clods (heavy, fall fast) and dust (light, drifts and spreads).
import * as THREE from './three.js';

const COUNT = 700; // particles are reused in a ring
const SOIL = [0x6e4a2c, 0x5a3b22, 0x8a5e38, 0x7a5434, 0x4a3020];
const DUST = [0xb48c60, 0xa47c52, 0xc09a70];

// Round, soft-edged points sized in metres, coloured per particle, with fog.
function dirtMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { scale: { value: 400 } }]),
    vertexShader: `
      attribute float size; attribute vec4 tint; varying vec4 vTint;
      uniform float scale;
      #include <fog_pars_vertex>
      void main() {
        vTint = tint;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / max(0.1, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      varying vec4 vTint;
      #include <fog_pars_fragment>
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        gl_FragColor = vec4(vTint.rgb, vTint.a * (1.0 - r * r));
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
}

export function createDirt(scene, camera) {
  const position = new Float32Array(COUNT * 3), velocity = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT), tint = new Float32Array(COUNT * 4);
  const life = new Float32Array(COUNT), maxLife = new Float32Array(COUNT), grow = new Float32Array(COUNT);
  const isDust = new Uint8Array(COUNT), alpha = new Float32Array(COUNT);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tint, 4));
  const material = dirtMaterial();
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  const colour = new THREE.Color();
  let next = 0, crumbsOwed = 0, roostOwed = 0, dustOwed = 0;

  // One particle at (x, y, z) moving at (vx, vy, vz).
  function emit(x, y, z, vx, vy, vz, metres, seconds, dust, opacity) {
    const i = next;
    next = (next + 1) % COUNT;
    position.set([x, y, z], i * 3); velocity.set([vx, vy, vz], i * 3);
    size[i] = metres; life[i] = maxLife[i] = seconds; isDust[i] = dust ? 1 : 0;
    grow[i] = dust ? metres * 0.9 : 0; alpha[i] = opacity;
    colour.setHex(pick(dust ? DUST : SOIL));
    tint.set([colour.r, colour.g, colour.b, opacity], i * 4);
  }
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const spread = k => (Math.random() - 0.5) * k;

  // The back tyre's contact patch and the bike's directions, from the bike state.
  function wheelFrame(b) {
    const yaw = b.h + b.drift, fx = Math.sin(yaw), fz = -Math.cos(yaw);
    return { fx, fz, rx: Math.cos(yaw), rz: Math.sin(yaw), x: b.x - fx * 0.55, y: b.y + 0.04, z: b.z - fz * 0.55 };
  }

  // Every frame while riding.
  function update(dt, b, riding) {
    material.uniforms.scale.value = window.innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    if (riding && !b.air && b.v > 1.5) {
      const w = wheelFrame(b);
      const drift = Math.min(1, Math.max(b.slide, Math.abs(b.drift) / 0.55)); // 0 straight .. 1 full drift
      const out = -Math.sign(b.drift || b.slipV) || 1; // which way the back wheel throws (outside of the turn)
      // crumbs: always a few, more with speed
      crumbsOwed += dt * (2 + b.v * 0.9);
      while (crumbsOwed >= 1) {
        crumbsOwed--;
        emit(w.x + spread(0.1), w.y, w.z + spread(0.1),
          -w.fx * b.v * (0.1 + Math.random() * 0.15) + spread(0.6), 0.6 + Math.random() * 1.2, -w.fz * b.v * (0.1 + Math.random() * 0.15) + spread(0.6),
          0.03 + Math.random() * 0.04, 0.5 + Math.random() * 0.3, false, 1);
      }
      // roost: clods thrown out the side, rising steeply with drift
      roostOwed += dt * drift * drift * 260;
      while (roostOwed >= 1) {
        roostOwed--;
        const kick = 1.5 + Math.random() * 3.5 * (0.4 + drift);
        emit(w.x, w.y + 0.05, w.z,
          w.rx * out * kick - w.fx * b.v * 0.25 + spread(1), 1 + Math.random() * 2.5 * drift, w.rz * out * kick - w.fz * b.v * 0.25 + spread(1),
          0.04 + Math.random() * 0.1 * (0.5 + drift), 0.7 + Math.random() * 0.5, false, 1);
      }
      // dust cloud behind a drift
      dustOwed += dt * drift * 18;
      while (dustOwed >= 1) {
        dustOwed--;
        emit(w.x + spread(0.4), w.y + 0.2, w.z + spread(0.4), w.rx * out * 1.2 + spread(0.8), 0.4 + Math.random() * 0.6, w.rz * out * 1.2 + spread(0.8),
          0.3 + Math.random() * 0.3, 0.7 + Math.random() * 0.4, true, 0.22);
      }
    }
    for (let i = 0; i < COUNT; i++) {
      if (life[i] <= 0) { size[i] = 0; continue; }
      life[i] -= dt;
      const k = i * 3;
      if (isDust[i]) {
        velocity[k] *= 1 - dt * 1.5; velocity[k + 2] *= 1 - dt * 1.5; velocity[k + 1] += (0.25 - velocity[k + 1]) * dt; // air holds dust up
        size[i] += grow[i] * dt;
      } else velocity[k + 1] -= 9.8 * dt;
      position[k] += velocity[k] * dt; position[k + 1] += velocity[k + 1] * dt; position[k + 2] += velocity[k + 2] * dt;
      tint[i * 4 + 3] = alpha[i] * Math.min(1, life[i] / (maxLife[i] * 0.4)); // fade out at the end
      if (life[i] <= 0) size[i] = 0;
    }
    geometry.attributes.position.needsUpdate = geometry.attributes.size.needsUpdate = geometry.attributes.tint.needsUpdate = true;
  }

  // Slid into a berm: an explosion of dirt off the wall, out the side and up. strength 0..1.
  function bermHit(b, strength, side) {
    const w = wheelFrame(b), out = -side; // the berm is on the outside of the turn
    const clods = Math.round(80 + 160 * strength);
    for (let n = 0; n < clods; n++) {
      // a fan of dirt up the berm wall: out to the side, up, and carried along with the bike
      const kick = 2 + Math.random() * 5 * (0.5 + strength);
      emit(w.x + w.rx * out * 0.3, w.y + 0.1, w.z + w.rz * out * 0.3,
        w.rx * out * kick + w.fx * b.v * (0.3 + Math.random() * 0.5) + spread(2.5), 2.5 + Math.random() * 5 * (0.5 + strength), w.rz * out * kick + w.fz * b.v * (0.3 + Math.random() * 0.5) + spread(2.5),
        0.07 + Math.random() * 0.2, 0.8 + Math.random() * 0.6, false, 1);
    }
    for (let n = 0; n < 8 + 12 * strength; n++) {
      emit(w.x + spread(1), w.y + 0.3, w.z + spread(1), w.rx * out * 2 + w.fx * b.v * 0.4 + spread(2), 0.6 + Math.random(), w.rz * out * 2 + w.fz * b.v * 0.4 + spread(2),
        0.6 + Math.random() * 0.6, 1 + Math.random() * 0.6, true, 0.3);
    }
  }

  // Touchdown: a puff of dust, bigger for a harder landing (use = share of suspension travel).
  function landing(b, use) {
    const n = Math.round(6 + 20 * Math.min(1, use));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.5 * Math.min(1, use + 0.3);
      emit(b.x + spread(0.6), b.y + 0.1, b.z + spread(0.6), Math.cos(a) * s, 0.3 + Math.random() * 0.8, Math.sin(a) * s,
        0.3 + Math.random() * 0.4, 0.7 + Math.random() * 0.5, true, 0.25);
    }
  }

  return { update, bermHit, landing };
}
