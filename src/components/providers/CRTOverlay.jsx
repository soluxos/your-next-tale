"use client";

// WebGL CRT overlay — ported from gingerbeardman/webgl-crt-shader (MIT)
// https://github.com/gingerbeardman/webgl-crt-shader
//
// Architecture (two layers):
//   1. A fixed CSS backdrop-filter div applies brightness/contrast/saturation to
//      the page beneath it — matching the repo's colour correction pass.
//   2. A WebGL canvas on top outputs the lighting mask (scanlines, vignette,
//      curvature, flicker, RGB shift) as a mix-blend-mode:multiply layer.
//
// The component returns null — both elements are created imperatively so that
// the backdrop-filter div sits between the page and the canvas in the DOM.

import { useEffect } from "react";

// ─── Tunable settings — repo defaults from CRTShader.js / crt-webgl.js ───────
const CRT_SETTINGS = {
  // ── Scanlines ──────────────────────────────────────────────────────────────
  scanlineIntensity: 0.1, // repo default: 0.50
  scanlineCount: 256, // repo demo default: 256 — match to screen height
  adaptiveIntensity: 0.1, // repo default: 0.30 — subtle per-row variation

  // ── Colour correction (backdrop-filter on a fixed div beneath the canvas) ──
  brightness: 1.0, // repo default: 1.50 — compensates for scanline dimming
  contrast: 1.0, // repo default: 1.05
  saturation: 1.0, // repo default: 1.10

  // ── Bloom (approximated as an additive brightness boost in backdrop-filter) ─
  bloomIntensity: 0.5, // repo default: 0.50
  bloomThreshold: 0.5, // repo default: 0.50 (threshold not reproducible in overlay)

  // ── RGB Shift (chromatic aberration — UV scale matches repo: shift × 0.005) ─
  rgbShift: 1.0, // repo default: 1.00 (0 = off)

  // ── Framing ────────────────────────────────────────────────────────────────
  vignetteStrength: 0, // repo default: 0.30 — 0 = off
  curvature: 0.0, // repo default: 0.10 — 0 = flat
  bezelFade: 0.0, // gradient fade at screen edges — 0 = off, 0.04 = subtle
  flickerStrength: 0.0, // repo default: 0.010 — ~17 Hz flicker

  // ── Scanline roll (extra — creates CRT refresh sweep feel) ─────────────────
  rollSpeed: 0.04 // full screens per second; 0 = static scanlines
};
// ─────────────────────────────────────────────────────────────────────────────

// ─── Shaders ─────────────────────────────────────────────────────────────────
const VS = `
  attribute vec2 a_pos;
  varying vec2 vUv;
  void main() {
    vUv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

// Fragment shader ported from gingerbeardman/webgl-crt-shader (CRTShader.js).
// Outputs a colour lighting mask for mix-blend-mode: multiply.
//   (1,1,1) = page pixel unchanged   |   lower = that area dimmed
//
// Bezel edge:
//   Computed in PRE-curvature UV space using smoothstep — a smooth gradient
//   fade to black. No hard branch, no pixel-sharp line at the barrel edge.
//
// Vignette:
//   Uses squared Euclidean distance (dot product) instead of Chebyshev max().
//   This produces a smooth oval/circular gradient, not a rounded rectangle.
//   Scanline amplitude is faded proportionally to vignette darkness so no
//   scanline stripes appear inside dark corners.
//
// RGB shift:
//   R and B evaluate their scanline value at horizontally offset UVs.
const FS = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  varying vec2 vUv;

  uniform float time;
  uniform float yOffset;
  uniform float scanlineIntensity;
  uniform float scanlineCount;
  uniform float adaptiveIntensity;
  uniform float vignetteStrength;
  uniform float curvature;
  uniform float flickerStrength;
  uniform float rgbShiftUV;
  uniform float bezelFade;

  const float PI = 3.14159265;

  // Verbatim from gingerbeardman/webgl-crt-shader — CRTShader.js
  vec2 curveRemapUV(vec2 uv, float curv) {
    vec2 coords = uv * 2.0 - 1.0;
    float d = dot(coords, coords);
    coords = coords * (1.0 + d * curv * 0.25);
    return coords * 0.5 + 0.5;
  }

  float scanAt(vec2 uv) {
    float y = (uv.y + yOffset) * scanlineCount;
    float pattern = abs(sin(y * PI));
    float adapt = 1.0;
    if (adaptiveIntensity > 0.001) {
      adapt = 1.0 - (sin(uv.y * 30.0) * 0.5 + 0.5) * adaptiveIntensity * 0.2;
    }
    return 1.0 - pattern * scanlineIntensity * adapt;
  }

  void main() {
    // ── Smooth bezel fade (pre-curvature) ─────────────────────────────────
    // bezelFade = 0 disables entirely; > 0 fades edges to black.
    float bezel = 1.0;
    if (bezelFade > 0.001) {
      vec2 bv = smoothstep(vec2(0.0), vec2(bezelFade), vUv)
              * (1.0 - smoothstep(vec2(1.0 - bezelFade), vec2(1.0), vUv));
      bezel = pow(bv.x * bv.y, 0.6);
    }

    // ── Curvature ─────────────────────────────────────────────────────────
    vec2 uv = vUv;
    if (curvature > 0.001) {
      uv = curveRemapUV(uv, curvature);
      uv = clamp(uv, 0.0, 1.0); // clamp — bezel fade handles the gradient
    }

    // ── Vignette — smooth circular gradient (squared Euclidean) ──────────
    // dot(c,c) = squared length: gives an oval gradient, not Chebyshev squares.
    // The vignette is a smooth radial fade with no visible straight edges.
    float vig = 1.0;
    if (vignetteStrength > 0.001) {
      vec2 c = uv * 2.0 - 1.0;
      float dist = dot(c, c);
      vig = clamp(1.0 - dist * vignetteStrength, 0.0, 1.0);
    }

    // Fade scanline amplitude to zero in dark vignette regions.
    // Prevents visible stripe patterns inside dim corners.
    float scanBlend = smoothstep(0.05, 0.6, vig);

    // ── Scanlines + RGB shift ─────────────────────────────────────────────
    float maskR = 1.0, maskG = 1.0, maskB = 1.0;
    if (scanlineIntensity > 0.001) {
      maskG = mix(1.0, scanAt(uv), scanBlend);
      if (rgbShiftUV > 0.0001) {
        maskR = mix(1.0, scanAt(vec2(uv.x + rgbShiftUV, uv.y)), scanBlend);
        maskB = mix(1.0, scanAt(vec2(uv.x - rgbShiftUV, uv.y)), scanBlend);
      } else {
        maskR = maskG;
        maskB = maskG;
      }
    }

    // ── Flicker ───────────────────────────────────────────────────────────
    float flick = 1.0;
    if (flickerStrength > 0.001) {
      flick = 1.0 + sin(time * 110.0) * flickerStrength;
    }

    // Final: scanlines × vignette × bezel fade × flicker
    gl_FragColor = vec4(
      clamp(maskR * vig * bezel * flick, 0.0, 1.0),
      clamp(maskG * vig * bezel * flick, 0.0, 1.0),
      clamp(maskB * vig * bezel * flick, 0.0, 1.0),
      1.0
    );
  }
`;

// ─── WebGL helper ─────────────────────────────────────────────────────────────
function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("[CRTOverlay] shader error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CRTOverlay() {
  useEffect(() => {
    const s = CRT_SETTINGS;

    // ── Layer 1: colour correction backdrop ───────────────────────────────
    // A fixed div with backdrop-filter applies brightness/contrast/saturation
    // to the page content beneath it. Bloom is approximated as extra brightness.
    // This matches the repo's colour pass without needing access to page pixels.
    const backdrop = document.createElement("div");
    backdrop.setAttribute("aria-hidden", "true");
    const effectiveBrightness = (
      s.brightness +
      s.bloomIntensity * 0.15
    ).toFixed(3);
    const bdf = `brightness(${effectiveBrightness}) contrast(${s.contrast}) saturate(${s.saturation})`;
    Object.assign(backdrop.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "9998"
      // backdropFilter: bdf,
      // WebkitBackdropFilter: bdf
    });
    document.body.appendChild(backdrop);

    // ── Layer 2: WebGL lighting mask ──────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "9999",
      mixBlendMode: "multiply"
    });
    document.body.appendChild(canvas);

    // ── Page inset ────────────────────────────────────────────────────────
    // At corners the barrel formula gives scale = 1 + curvature * 0.5, so the
    // overflow is exactly curvature * 50% of the screen. We add a small extra
    // margin so content doesn't graze the bezel gradient.
    // A <style> tag with box-sizing: border-box ensures padding shrinks the
    // content area rather than expanding the element beyond the viewport.
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-crt-inset", "");
    styleEl.textContent = `html { box-sizing: border-box !important; overflow-x: hidden; }`;
    document.head.appendChild(styleEl);

    // ── WebGL setup ───────────────────────────────────────────────────────
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    function cleanup() {
      backdrop.remove();
      canvas.remove();
      styleEl.remove();
    }

    if (!gl) {
      cleanup();
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VS);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) {
      cleanup();
      return;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[CRTOverlay] link error:", gl.getProgramInfoLog(prog));
      cleanup();
      return;
    }
    gl.useProgram(prog);

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations (names match CRTShader.js where applicable)
    const uTime = gl.getUniformLocation(prog, "time");
    const uYOffset = gl.getUniformLocation(prog, "yOffset");
    const uScanInt = gl.getUniformLocation(prog, "scanlineIntensity");
    const uScanCount = gl.getUniformLocation(prog, "scanlineCount");
    const uAdaptive = gl.getUniformLocation(prog, "adaptiveIntensity");
    const uVignette = gl.getUniformLocation(prog, "vignetteStrength");
    const uCurve = gl.getUniformLocation(prog, "curvature");
    const uFlicker = gl.getUniformLocation(prog, "flickerStrength");
    const uRgbShift = gl.getUniformLocation(prog, "rgbShiftUV");
    const uBezelFade = gl.getUniformLocation(prog, "bezelFade");

    // Static uniforms
    gl.uniform1f(uScanInt, s.scanlineIntensity);
    gl.uniform1f(uScanCount, s.scanlineCount);
    gl.uniform1f(uAdaptive, s.adaptiveIntensity);
    gl.uniform1f(uVignette, s.vignetteStrength);
    gl.uniform1f(uCurve, s.curvature);
    gl.uniform1f(uFlicker, s.flickerStrength);
    // Repo uses RGB_SHIFT_SCALE = 0.005; match that scale here
    gl.uniform1f(uRgbShift, s.rgbShift * 0.005);
    gl.uniform1f(uBezelFade, s.bezelFade);

    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    resize();

    // Animation loop — time drives flicker; yOffset scrolls scanlines for roll
    const t0 = performance.now();
    let raf;
    function draw() {
      const t = (performance.now() - t0) / 1000;
      gl.uniform1f(uTime, t);
      gl.uniform1f(uYOffset, (t * s.rollSpeed) % 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(draw);
    }
    draw();

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      cleanup();
    };
  }, []);

  // Returns null — both DOM elements are created imperatively in useEffect
  return null;
}
