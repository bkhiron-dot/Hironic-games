// Textures painted on a canvas (dirt, bark, signs, number plates), kept as pixels in memory.
// Why not THREE.CanvasTexture: on phones the browser can drop the page's 3D graphics (WebGL)
// when you switch tabs or apps, and may also wipe hidden canvases to save memory. When the
// game comes back, Three.js uploads every texture again, from its canvas: a wiped canvas
// comes back black (Ben's phone, 25 Oct: black dirt, trunks and fence tape). A copy of the
// pixels can always be uploaded again.
import * as THREE from './three.js';

export function paintedTexture(canvas) {
  const { width, height } = canvas;
  const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  // a canvas's rows run top to bottom, a texture's bottom to top
  const flipped = new Uint8Array(pixels.length), row = width * 4;
  for (let y = 0; y < height; y++) flipped.set(pixels.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
  const texture = new THREE.DataTexture(flipped, width, height, THREE.RGBAFormat);
  // smooth and mipmapped, as a canvas texture would be (a data texture defaults to blocky pixels)
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
