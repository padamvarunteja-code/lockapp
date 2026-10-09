import React from 'react';

interface WordmarkProps {
  className?: string;
  showTagline?: boolean;
  scale?: number;
}

export const OnlyUsWordmark: React.FC<WordmarkProps> = ({
  className = '',
  showTagline = true,
  scale = 1,
}) => {
  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Primary Wordmark SVG for Pixel-Perfect Scalability & Typography */}
      <svg
        viewBox="0 0 420 110"
        width={420 * scale}
        height={110 * scale}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="max-w-full h-auto"
      >
        <defs>
          {/* Soft Lavender to Violet Metallic Gradient */}
          <linearGradient id="wordmarkPurpleGrad" x1="0" y1="0" x2="380" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#F3E8FF" />
            <stop offset="75%" stopColor="#DDD6FE" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>

          {/* Heart Emblem Gradient */}
          <linearGradient id="heartEmblemGrad" x1="180" y1="20" x2="220" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EDE9FE" />
            <stop offset="60%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#7E22CE" />
          </linearGradient>

          {/* Subtle Glow */}
          <filter id="wordmarkGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 
          Typography "OnlyUs" with custom integrated heart knot 
        */}
        <g filter="url(#wordmarkGlow)">
          {/* "Only" in refined elegant geometric grotesque */}
          <text
            x="48"
            y="68"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif"
            fontSize="54"
            fontWeight="500"
            letterSpacing="-1.5"
            fill="url(#wordmarkPurpleGrad)"
          >
            Only
          </text>

          {/* Interconnected Heart Glyph joining Only and Us */}
          <g transform="translate(196, 26) scale(0.48)">
            {/* Left Ring of glyph */}
            <path
              d="M 28 8 C 10 8, 2 24, 2 42 C 2 64, 24 82, 50 96 C 36 78, 24 60, 24 42 C 24 28, 32 16, 44 14"
              stroke="url(#heartEmblemGrad)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* Right Ring of glyph */}
            <path
              d="M 50 20 C 62 8, 78 8, 88 16 C 98 26, 100 42, 94 56 C 84 76, 62 90, 50 96 C 38 90, 16 76, 6 56 C 0 42, 2 26, 12 16 C 22 8, 38 8, 50 20 Z"
              stroke="url(#heartEmblemGrad)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* Front Knot Weave */}
            <path
              d="M 50 20 C 38 8, 22 8, 12 16 C 2 26, 0 42, 6 56 C 16 76, 38 90, 50 96 C 60 92, 72 82, 80 70"
              stroke="url(#heartEmblemGrad)"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </g>

          {/* "Us" in harmonized bold clarity */}
          <text
            x="254"
            y="68"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif"
            fontSize="54"
            fontWeight="700"
            letterSpacing="-1.5"
            fill="#FFFFFF"
          >
            Us
          </text>

          {/* Tiny accent period in radiant purple */}
          <circle cx="342" cy="65" r="3.5" fill="#A855F7" />
        </g>

        {/* Tagline: A space just for us. */}
        {showTagline && (
          <text
            x="210"
            y="98"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif"
            fontSize="13"
            fontWeight="400"
            letterSpacing="4.5"
            fill="#DDD6FE"
            opacity="0.9"
            style={{ textTransform: 'uppercase' }}
          >
            A space just for us
          </text>
        )}
      </svg>
    </div>
  );
};
