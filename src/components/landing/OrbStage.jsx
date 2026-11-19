import { lazy, Suspense, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { supportsWebGL } from './webgl';

const VoiceOrb = lazy(() => import('./VoiceOrb'));

/*
 * Static orb, drawn in the 3D scene's own units (x right, y down here) so it lines up with VoiceOrb:
 * shown while three.js loads and wherever WebGL is unavailable.
 */
const FALLBACK_BARS = [0.22, 0.34, 0.5, 0.42, 0.66, 0.82, 0.58, 0.94, 0.62, 0.86, 0.7, 0.48, 0.56, 0.36, 0.24];

function OrbFallback() {
  return (
    <svg aria-hidden viewBox="-2.4 -2.13 4.8 4.36" className="absolute inset-0 h-full w-full">
      <defs>
        <radialGradient id="nvp-fb-sphere" cx="42%" cy="36%" r="70%">
          <stop offset="0" stopColor="#2E2422" />
          <stop offset="0.6" stopColor="#0E0A0A" />
          <stop offset="1" stopColor="#050404" />
        </radialGradient>
        <radialGradient id="nvp-fb-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FE7725" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FE7725" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="nvp-fb-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FE7725" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FE7725" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="nvp-fb-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5A5E69" />
          <stop offset="1" stopColor="#1C1E24" />
        </linearGradient>
        <linearGradient id="nvp-fb-stand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A2B31" />
          <stop offset="1" stopColor="#111216" />
        </linearGradient>
        <clipPath id="nvp-fb-front"><rect x="-2.4" y="-0.3" width="4.8" height="3" /></clipPath>
      </defs>
      {/* stand */}
      <ellipse cx="0" cy="1.62" rx="1.55" ry="0.3" fill="#111216" />
      <rect x="-1.55" y="1.5" width="3.1" height="0.12" fill="url(#nvp-fb-stand)" />
      <ellipse cx="0" cy="1.5" rx="1.5" ry="0.29" fill="#1C1D22" stroke="#FE7725" strokeOpacity="0.55" strokeWidth="0.02" />
      <rect x="-1.28" y="1.28" width="2.56" height="0.22" fill="url(#nvp-fb-stand)" />
      <ellipse cx="0" cy="1.5" rx="1.28" ry="0.25" fill="#16171C" />
      <ellipse cx="0" cy="1.28" rx="1.25" ry="0.25" fill="#1E1F25" stroke="#FF8A3D" strokeWidth="0.03" />
      <ellipse cx="0" cy="1.28" rx="0.95" ry="0.17" fill="#FE7725" fillOpacity="0.35" />
      <path d="M -1.1 1.28 L -0.78 0.62 L 0.78 0.62 L 1.1 1.28 Z" fill="url(#nvp-fb-beam)" />
      {/* orbit ring, back half */}
      <g transform="rotate(-12 0 -0.3)">
        <ellipse cx="0" cy="-0.3" rx="1.5" ry="0.42" fill="none" stroke="#FF7A2F" strokeWidth="0.028" />
      </g>
      {/* glass sphere and its voice */}
      <circle cx="0" cy="-0.3" r="1" fill="url(#nvp-fb-sphere)" />
      <circle cx="0" cy="-0.3" r="0.75" fill="url(#nvp-fb-glow)" />
      {FALLBACK_BARS.map((h, i) => (
        <rect
          key={i}
          x={-0.66 + i * 0.0943 - 0.022}
          y={-0.3 - h * 0.42}
          width="0.044"
          height={h * 0.84}
          rx="0.022"
          fill="#FF8A3D"
        />
      ))}
      <circle cx="0" cy="-0.3" r="0.99" fill="none" stroke="#FF8A3D" strokeOpacity="0.5" strokeWidth="0.03" />
      <ellipse cx="-0.4" cy="-0.86" rx="0.26" ry="0.11" fill="#FFFFFF" fillOpacity="0.22" transform="rotate(-28 -0.4 -0.86)" />
      {/* headphones */}
      <path d="M -1.16 -0.3 A 1.16 1.16 0 0 1 1.16 -0.3" fill="none" stroke="url(#nvp-fb-metal)" strokeWidth="0.15" />
      <rect x="-1.3" y="-0.66" width="0.28" height="0.74" rx="0.12" fill="url(#nvp-fb-metal)" />
      <rect x="1.02" y="-0.66" width="0.28" height="0.74" rx="0.12" fill="url(#nvp-fb-metal)" />
      <rect x="-1.33" y="-0.56" width="0.05" height="0.54" rx="0.025" fill="#FF7A2F" />
      <rect x="1.28" y="-0.56" width="0.05" height="0.54" rx="0.025" fill="#FF7A2F" />
      {/* orbit ring, front half */}
      <g transform="rotate(-12 0 -0.3)" clipPath="url(#nvp-fb-front)">
        <ellipse cx="0" cy="-0.3" rx="1.5" ry="0.42" fill="none" stroke="#FF7A2F" strokeWidth="0.028" />
      </g>
    </svg>
  );
}

/**
 * The NVIP voice orb on its stand, filling its (positioned) parent: the three.js scene where WebGL works,
 * the matching static SVG while it loads or where it does not. Decorative: callers give the wrapper a role and label.
 * Shared by the landing hero and the sign-in page.
 */
export default function OrbStage({ className, shadow = 'rgba(120,53,15,0.28)' }) {
  const [webgl, setWebgl] = useState(supportsWebGL);
  const onUnsupported = useCallback(() => setWebgl(false), []);
  return (
    <div className={cn('absolute inset-0', className)}>
      {/* contact shadow under the stand */}
      <div
        aria-hidden
        className="absolute bottom-[6%] left-1/2 h-[9%] w-[66%] -translate-x-1/2 rounded-[50%] blur-2xl"
        style={{ background: shadow }}
      />
      {webgl ? (
        <Suspense fallback={<OrbFallback />}>
          <VoiceOrb className="absolute inset-0 touch-pan-y" onUnsupported={onUnsupported} />
        </Suspense>
      ) : (
        <OrbFallback />
      )}
    </div>
  );
}
