/** Whether this browser can draw WebGL. Kept apart from VoiceOrb so checking it doesn't load three.js. */
export function supportsWebGL() {
  if (typeof window === 'undefined' || typeof window.WebGLRenderingContext === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
