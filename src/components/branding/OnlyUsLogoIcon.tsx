import React from 'react';

interface LogoProps {
  size?: number | string;
  className?: string;
  variant?: 'glow' | 'flat' | 'solid' | 'monochrome';
}

export const OnlyUsLogoIcon: React.FC<LogoProps> = ({
  size = 120,
  className = '',
  variant = 'glow',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Soft Lavender to Deep Vibrant Purple Metallic Gradient */}
        <linearGradient id="ringPurpleGrad1" x1="40" y1="30" x2="160" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="25%" stopColor="#EDE9FE" />
          <stop offset="65%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#6B21A8" />
        </linearGradient>

        <linearGradient id="ringPurpleGrad2" x1="160" y1="30" x2="40" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="30%" stopColor="#DDD6FE" />
          <stop offset="70%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#581C87" />
        </linearGradient>

        {/* Ambient Glow Filter */}
        <filter id="softHeartGlow" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Inner Shadow for Interlocking Overlap */}
        <filter id="interlockShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#07060B" floodOpacity="0.8" />
        </filter>

        {/* Core Radial Glow for Dark Backdrops */}
        <radialGradient id="centerGlow" cx="50%" cy="45%" r="45%">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.38" />
          <stop offset="60%" stopColor="#581C87" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#07060B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Subtle Background Radial Aura */}
      {variant === 'glow' && (
        <circle cx="100" cy="95" r="70" fill="url(#centerGlow)" />
      )}

      {/* 
        THE TWO INTERCONNECTED RINGS FORMING A SUBTLE HEART
        Ring 1 (Left Loop tilted +22deg, sweeps down to heart point)
        Ring 2 (Right Loop tilted -22deg, intertwines and bonds at base)
      */}
      <g filter={variant === 'glow' ? 'url(#softHeartGlow)' : undefined}>
        {/* Left Ring (Underpass section behind right ring) */}
        <path
          d="M 72 48 
             C 42 48, 22 72, 22 102 
             C 22 134, 52 158, 100 178 
             C 72 152, 54 126, 54 102 
             C 54 84, 64 68, 80 66"
          stroke="url(#ringPurpleGrad1)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Right Ring (Main sweep forming the heart crest & cleft) */}
        <path
          d="M 100 66 
             C 118 48, 142 46, 160 56 
             C 178 68, 182 92, 174 114 
             C 162 144, 128 166, 100 178 
             C 72 166, 38 144, 26 114
             C 18 92, 22 68, 40 56
             C 58 46, 82 48, 100 66 Z"
          stroke="url(#ringPurpleGrad2)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#interlockShadow)"
        />

        {/* Left Ring Overlap (Interlocking front weave) */}
        <path
          d="M 100 66 
             C 82 48, 58 46, 40 56
             C 22 68, 18 92, 26 114
             C 38 144, 72 166, 100 178
             C 114 172, 132 158, 146 142"
          stroke="url(#ringPurpleGrad1)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Subtle Specular Metallic Shimmer Accents */}
        <path
          d="M 52 58 C 42 66, 36 78, 36 92"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />
        <path
          d="M 148 58 C 158 66, 164 78, 164 92"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />

        {/* Central Union Accent - Tiny delicate luminous heart core */}
        <circle cx="100" cy="98" r="3.5" fill="#DDD6FE" opacity="0.9" />
      </g>
    </svg>
  );
};
