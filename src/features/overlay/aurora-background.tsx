import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl';

const vertexShader = `#version 300 es
in vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
    0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
    0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) { \
  int index = 0; \
  for (int i = 0; i < 2; i++) { \
    ColorStop currentColor = colors[i]; \
    bool isInBetween = currentColor.position <= factor; \
    index = int(mix(float(index), float(i), float(isInBetween))); \
  } \
  ColorStop currentColor = colors[index]; \
  ColorStop nextColor = colors[index + 1]; \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  // Keep the aurora moving through the full lyrics viewport instead of anchoring it near the bottom.
  float flow = snoise(vec2(uv.x * 1.7 + uTime * 0.08, uTime * 0.16));
  float center = 0.5 + flow * 0.28;
  float band = 1.0 - smoothstep(0.0, 0.34 + uBlend * 0.28, abs(uv.y - center));

  vec2 driftA = vec2(
    0.5 + sin(uTime * 0.13) * 0.38,
    0.5 + cos(uTime * 0.11) * 0.34
  );
  vec2 driftB = vec2(
    0.5 + cos(uTime * 0.09 + 1.7) * 0.36,
    0.5 + sin(uTime * 0.15 + 0.6) * 0.32
  );
  vec2 uvAspect = vec2(uv.x * aspect, uv.y);
  float glowA = 1.0 - smoothstep(0.0, 0.46, distance(uvAspect, vec2(driftA.x * aspect, driftA.y)));
  float glowB = 1.0 - smoothstep(0.0, 0.52, distance(uvAspect, vec2(driftB.x * aspect, driftB.y)));

  float noise = snoise(vec2(uv.x * 3.0 + uTime * 0.18, uv.y * 2.2 - uTime * 0.12));
  float intensity = clamp((band * 0.78 + glowA * 0.34 + glowB * 0.28) * (0.72 + noise * 0.24), 0.0, 1.0);
  float auroraAlpha = smoothstep(0.08, 0.82, intensity) * 0.72 * uAmplitude;

  vec3 auroraColor = rampColor * (0.65 + intensity * 0.85);
  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

interface AuroraBackgroundProps {
  amplitude?: number;
  blend?: number;
  colorStops?: [string, string, string];
  enabled?: boolean;
  speed?: number;
  style?: CSSProperties;
}

const defaultColorStops: [string, string, string] = ['#7cff67', '#b497cf', '#5227ff'];
const maxDevicePixelRatio = 1;
const targetFrameIntervalMs = 1000 / 24;

function hasWebGl2Support(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.WebGL2RenderingContext !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

function toColorStopValue(colorStops: [string, string, string]) {
  return colorStops.map((hex) => {
    const color = new Color(hex);
    return [color.r, color.g, color.b];
  });
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    syncPreference();
    mediaQuery.addEventListener('change', syncPreference);

    return () => {
      mediaQuery.removeEventListener('change', syncPreference);
    };
  }, []);

  return prefersReducedMotion;
}

export function AuroraBackground({
  amplitude = 1,
  blend = 0.5,
  colorStops = defaultColorStops,
  enabled = true,
  speed = 1,
  style,
}: AuroraBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const colorStopValues = useMemo(() => toColorStopValue(colorStops), [colorStops]);
  const propsRef = useRef({
    amplitude,
    blend,
    colorStopValues,
    speed,
  });
  propsRef.current = {
    amplitude,
    blend,
    colorStopValues,
    speed,
  };

  useEffect(() => {
    const container = containerRef.current;

    if (!enabled || prefersReducedMotion || !container || !hasWebGl2Support()) {
      return;
    }

    let renderer: Renderer | null = null;
    let animationFrameId = 0;
    let lastRenderTime = 0;
    let resizeObserver: ResizeObserver | null = null;

    try {
      renderer = new Renderer({
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio),
        premultipliedAlpha: true,
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = 'transparent';
    gl.canvas.style.display = 'block';
    gl.canvas.style.height = '100%';
    gl.canvas.style.width = '100%';

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) {
      delete geometry.attributes.uv;
    }

    const program = new Program(gl, {
      fragment: fragmentShader,
      vertex: vertexShader,
      uniforms: {
        uAmplitude: { value: propsRef.current.amplitude },
        uBlend: { value: propsRef.current.blend },
        uColorStops: { value: propsRef.current.colorStopValues },
        uResolution: { value: [container.offsetWidth, container.offsetHeight] },
        uTime: { value: 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const width = container.offsetWidth;
      const height = container.offsetHeight;

      if (width <= 0 || height <= 0 || !renderer) {
        return;
      }

      renderer.setSize(width, height);
      program.uniforms.uResolution.value = [width, height];
    };

    const startAnimation = () => {
      if (animationFrameId !== 0 || document.visibilityState === 'hidden') {
        return;
      }

      animationFrameId = requestAnimationFrame(update);
    };

    const stopAnimation = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
    };

    function update(time: number) {
      animationFrameId = 0;

      if (document.visibilityState === 'hidden') {
        return;
      }

      animationFrameId = requestAnimationFrame(update);

      if (time - lastRenderTime < targetFrameIntervalMs) {
        return;
      }

      lastRenderTime = time;
      program.uniforms.uAmplitude.value = propsRef.current.amplitude;
      program.uniforms.uBlend.value = propsRef.current.blend;
      program.uniforms.uColorStops.value = propsRef.current.colorStopValues;
      program.uniforms.uTime.value = time * 0.001 * propsRef.current.speed;
      renderer?.render({ scene: mesh });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopAnimation();
        return;
      }

      lastRenderTime = 0;
      startAnimation();
    };

    container.appendChild(gl.canvas);
    resize();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', resize);
    }

    startAnimation();

    return () => {
      stopAnimation();
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', resize);

      if (gl.canvas.parentNode === container) {
        container.removeChild(gl.canvas);
      }

      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [enabled, prefersReducedMotion]);

  return (
    <div
      aria-hidden="true"
      data-lyra-aurora-canvas="true"
      ref={containerRef}
      style={{
        height: '100%',
        inset: 0,
        pointerEvents: 'none',
        position: 'absolute',
        width: '100%',
        ...style,
      }}
    />
  );
}
