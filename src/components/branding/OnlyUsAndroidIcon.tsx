import React from 'react';
import { OnlyUsLogoIcon } from './OnlyUsLogoIcon';

interface AndroidIconProps {
  size?: number;
  className?: string;
  showShadow?: boolean;
}

export const OnlyUsAndroidIcon: React.FC<AndroidIconProps> = ({
  size = 140,
  className = '',
  showShadow = true,
}) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative select-none flex items-center justify-center ${className}`}
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          {/* Android Squircle Base Gradient: Deep Obsidian to Midnight Purple */}
          <linearGradient id="androidTileGrad" x1="20" y1="10" x2="180" y2="190" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#25143D" />
            <stop offset="45%" stopColor="#160D27" />
            <stop offset="100%" stopColor="#07060B" />
          </linearGradient>

          {/* Soft Lavender / Purple Bevel Rim Lighting */}
          <linearGradient id="androidRimLighting" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#C084FC" stopOpacity="0.5" />
            <stop offset="30%" stopColor="#A855F7" stopOpacity="0.2" />
            <stop offset="70%" stopColor="#6B21A8" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#9333EA" stopOpacity="0.35" />
          </linearGradient>

          {/* Ambient launcher drop shadow */}
          <filter id="androidLauncherShadow" x="-20%" y="-15%" width="140%" height="145%">
            <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#000000" floodOpacity="0.65" />
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#2E1065" floodOpacity="0.5" />
          </filter>

          {/* Inner Tile Glow */}
          <radialGradient id="tileCenterGlow" cx="50%" cy="46%" r="50%">
            <stop offset="0%" stopColor="#9333EA" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Squircle Tile with Adaptive Corner Radii (44px on 200px tile = Android standard) */}
        <g filter={showShadow ? 'url(#androidLauncherShadow)' : undefined}>
          <rect
            x="10"
            y="10"
            width="180"
            height="180"
            rx="42"
            fill="url(#androidTileGrad)"
          />
          {/* Subtle Inner Glow */}
          <rect
            x="10"
            y="10"
            width="180"
            height="180"
            rx="42"
            fill="url(#tileCenterGlow)"
          />
          {/* Outer Rim Bevel Stroke */}
          <rect
            x="10.5"
            y="10.5"
            width="179"
            height="179"
            rx="41.5"
            stroke="url(#androidRimLighting)"
            strokeWidth="1.5"
          />
        </g>
      </svg>

      {/* Centered Interconnected Rings Heart Emblem */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none transform scale-[0.68] -translate-y-0.5">
        <OnlyUsLogoIcon size={180} variant="glow" />
      </div>
    </div>
  );
};
