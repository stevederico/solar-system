import * as THREE from 'three';

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-world.xyz);
    gl_Position = projectionMatrix * world;
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 glowColor;
  uniform float strength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = 1.0 - abs(dot(vNormal, vView));
    float glow = pow(rim, 2.6) * strength;
    gl_FragColor = vec4(glowColor * glow, glow);
  }
`;

const SUN_VERTEX = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vPosition = position;
    vec4 world = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-world.xyz);
    gl_Position = projectionMatrix * world;
  }
`;

const SUN_FRAGMENT = /* glsl */ `
  uniform float time;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vView;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float total = 0.0;
    float weight = 0.5;
    for (int n = 0; n < 5; n++) {
      total += weight * noise(p);
      p = p * 2.03 + 11.7;
      weight *= 0.5;
    }
    return total;
  }

  void main() {
    vec3 p = normalize(vPosition) * 3.2;
    float flow = fbm(p + vec3(0.0, time * 0.06, time * 0.04));
    float cells = fbm(p * 3.0 + flow * 1.5 - vec3(time * 0.09));
    float heat = clamp(flow * 0.7 + cells * 0.6, 0.0, 1.0);
    vec3 deep = vec3(0.95, 0.32, 0.04);
    vec3 mid = vec3(1.0, 0.66, 0.18);
    vec3 hot = vec3(1.0, 0.96, 0.78);
    vec3 color = mix(deep, mid, smoothstep(0.25, 0.6, heat));
    color = mix(color, hot, smoothstep(0.6, 0.9, heat));
    float limb = pow(max(dot(vNormal, vView), 0.0), 0.45);
    gl_FragColor = vec4(color * (0.55 + 0.75 * limb), 1.0);
  }
`;

/** Thin glowing shell that fakes light scattering at a planet's edge. */
export function createAtmosphereMaterial(color: string, strength: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(color) }, strength: { value: strength } },
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

/** Animated churning surface for the Sun. Drive the time uniform each frame. */
export function createSunMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: SUN_VERTEX,
    fragmentShader: SUN_FRAGMENT,
  });
}
