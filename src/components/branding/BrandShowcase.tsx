import React, { useState } from 'react';
import { OnlyUsLogoIcon } from './OnlyUsLogoIcon';
import { OnlyUsWordmark } from './OnlyUsWordmark';
import { OnlyUsCombinedLogo } from './OnlyUsCombinedLogo';
import { OnlyUsAndroidIcon } from './OnlyUsAndroidIcon';
import { Sparkles, Copy, Check, Download, Layers } from 'lucide-react';

export const BrandShowcase: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copySvgCode = (elementName: string, svgString: string) => {
    navigator.clipboard.writeText(svgString);
    setCopiedSection(elementName);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#07060B] text-neutral-100 p-6 sm:p-12 font-sans selection:bg-purple-900/60 selection:text-purple-200">
      {/* Brand Header */}
      <div className="max-w-4xl mx-auto mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#18122B] border border-purple-900/60 text-purple-300 text-xs font-mono mb-4 tracking-wider uppercase">
          <Sparkles size={12} className="text-purple-400" />
          <span>Brand Identity System</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-2">
          OnlyUs
        </h1>
        <p className="text-sm font-sans tracking-widest text-purple-200/90 uppercase font-medium">
          A space just for us.
        </p>

        <p className="mt-4 text-xs text-neutral-400 max-w-lg mx-auto leading-relaxed">
          Logo concept: Two interconnected rings forming a subtle heart symbol, embodying intimacy, trust, privacy, and an unbreakable bond between loved ones.
        </p>

        {/* Color Palette Chips */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <div className="flex items-center gap-2 bg-[#0E0A17] border border-neutral-800 px-3 py-1.5 rounded-full text-xs">
            <span className="w-3 h-3 rounded-full bg-[#07060B] border border-neutral-700"></span>
            <span className="text-neutral-300 font-mono text-[11px]">Deep Black (#07060B)</span>
          </div>

          <div className="flex items-center gap-2 bg-[#0E0A17] border border-neutral-800 px-3 py-1.5 rounded-full text-xs">
            <span className="w-3 h-3 rounded-full bg-[#18122B] border border-purple-900"></span>
            <span className="text-neutral-300 font-mono text-[11px]">Midnight Purple (#140E24)</span>
          </div>

          <div className="flex items-center gap-2 bg-[#0E0A17] border border-neutral-800 px-3 py-1.5 rounded-full text-xs">
            <span className="w-3 h-3 rounded-full bg-[#DDD6FE] border border-purple-400"></span>
            <span className="text-neutral-300 font-mono text-[11px]">Soft Lavender & Purple (#DDD6FE)</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-12">
        {/* ========================================================
            ELEMENT 1: STANDALONE LOGO ICON
            ======================================================== */}
        <section className="bg-[#0E0A17] border border-purple-900/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-6 border-b border-purple-900/30 pb-4">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-purple-400 uppercase font-bold">
                Element 01
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Standalone Logo Icon
              </h2>
            </div>
            <span className="text-[11px] font-mono text-purple-300 bg-[#18122B] px-2.5 py-1 rounded-full border border-purple-900/40">
              Vector SVG • Interconnected Rings Heart
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Dark Studio Preview */}
            <div className="h-64 rounded-2xl bg-gradient-to-b from-[#1A0F2E] to-[#07060B] border border-purple-900/40 flex flex-col items-center justify-center relative p-6 shadow-inner group">
              <OnlyUsLogoIcon size={140} variant="glow" />
              <span className="absolute bottom-3 text-[10px] font-mono text-purple-400/60">
                Primary Dark Display (Deep Black & Midnight Purple)
              </span>
            </div>

            {/* Geometry & Concept Notes */}
            <div className="space-y-4 text-xs text-purple-200/80 leading-relaxed">
              <div className="p-4 bg-[#07060B] rounded-2xl border border-purple-900/40 space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Layers size={14} className="text-purple-400" />
                  <span>Geometric Construction</span>
                </div>
                <p className="text-[11px] text-purple-300/70">
                  Two continuous orbital rings weave through one another with satin metallic curvature. The overlapping intersection naturally sculpts the dip and cleft of a subtle heart, signifying mutual commitment and discreet privacy.
                </p>
              </div>

              {/* Contrast preview tile */}
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-[#18122B] border border-purple-700/40 flex items-center justify-center p-1 shadow-md">
                  <OnlyUsLogoIcon size={44} variant="flat" />
                </div>
                <div className="w-16 h-16 rounded-xl bg-[#07060B] border border-purple-900/50 flex items-center justify-center p-1 shadow-md">
                  <OnlyUsLogoIcon size={44} variant="glow" />
                </div>
                <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center p-1 shadow-md">
                  <OnlyUsLogoIcon size={44} variant="flat" />
                </div>
                <div className="text-[11px] text-purple-400/60 font-mono">
                  High-contrast legibility across dark, midnight, and light backdrops.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            ELEMENT 2: ONLYUS WORDMARK WITH HEART SYMBOL
            ======================================================== */}
        <section className="bg-[#0E0A17] border border-purple-900/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-6 border-b border-purple-900/30 pb-4">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-purple-400 uppercase font-bold">
                Element 02
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                OnlyUs Wordmark with Heart Symbol
              </h2>
            </div>
            <span className="text-[11px] font-mono text-purple-300 bg-[#18122B] px-2.5 py-1 rounded-full border border-purple-900/40">
              Bespoke Typography + Heart Glyph
            </span>
          </div>

          <div className="py-10 px-4 rounded-2xl bg-gradient-to-b from-[#1A0F2E] to-[#07060B] border border-purple-900/40 flex flex-col items-center justify-center shadow-inner">
            <OnlyUsWordmark scale={1.1} showTagline={true} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-purple-300/70 pt-2 px-1">
            <span className="font-mono text-[11px]">
              Spelling: <strong>OnlyUs</strong> (Exact case-sensitive match)
            </span>
            <span className="font-mono text-[11px]">
              Tagline: <strong>&ldquo;A space just for us.&rdquo;</strong>
            </span>
          </div>
        </section>

        {/* ========================================================
            ELEMENT 3: COMBINED ICON AND WORDMARK
            ======================================================== */}
        <section className="bg-[#0E0A17] border border-purple-900/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-6 border-b border-purple-900/30 pb-4">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-purple-400 uppercase font-bold">
                Element 03
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Combined Icon & Wordmark Lockup
              </h2>
            </div>
            <span className="text-[11px] font-mono text-purple-300 bg-[#18122B] px-2.5 py-1 rounded-full border border-purple-900/40">
              Master Brand Lockup
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Primary Vertical Lockup */}
            <div className="h-80 rounded-2xl bg-gradient-to-b from-[#1A0F2E] to-[#07060B] border border-purple-900/40 flex flex-col items-center justify-center p-6 shadow-inner">
              <OnlyUsCombinedLogo layout="vertical" />
              <span className="mt-4 text-[10px] font-mono text-purple-400/60">
                Primary Master Lockup (Centered)
              </span>
            </div>

            {/* Horizontal Lockup */}
            <div className="h-80 rounded-2xl bg-gradient-to-b from-[#1A0F2E] to-[#07060B] border border-purple-900/40 flex flex-col items-center justify-center p-6 shadow-inner">
              <OnlyUsCombinedLogo layout="horizontal" />
              <span className="mt-8 text-[10px] font-mono text-purple-400/60">
                Horizontal Lockup (Navigation & Headers)
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================
            ELEMENT 4: ANDROID APP ICON VERSION
            ======================================================== */}
        <section className="bg-[#0E0A17] border border-purple-900/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-6 border-b border-purple-900/30 pb-4">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-purple-400 uppercase font-bold">
                Element 04
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Android App Icon Version
              </h2>
            </div>
            <span className="text-[11px] font-mono text-purple-300 bg-[#18122B] px-2.5 py-1 rounded-full border border-purple-900/40">
              Adaptive Squircle • Launcher Ready
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Android Launcher Icon Presentation */}
            <div className="h-72 rounded-2xl bg-gradient-to-b from-[#1A0F2E] to-[#07060B] border border-purple-900/40 flex flex-col items-center justify-center p-6 shadow-inner">
              <OnlyUsAndroidIcon size={140} showShadow={true} />
              <span className="text-xs font-semibold text-white mt-4 font-sans tracking-wide">
                OnlyUs
              </span>
              <span className="text-[10px] font-mono text-purple-400/60">
                Android Adaptive Squircle (xxxhdpi 192×192 base)
              </span>
            </div>

            {/* Android Home Screen Context Simulation */}
            <div className="space-y-4">
              <div className="p-4 bg-[#07060B] rounded-2xl border border-purple-900/40 space-y-3">
                <div className="text-xs font-semibold text-white">
                  Launcher Specifications
                </div>
                <ul className="space-y-2 text-[11px] text-purple-300/70">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span><strong>Corner Radius:</strong> Exact Android 22% squircle radius for seamless launcher harmony.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span><strong>Lighting:</strong> Subtle soft lavender rim lighting along the upper edge giving premium glass-depth.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span><strong>Privacy Discretion:</strong> Refined, abstract, and sophisticated icon that feels intimate without broadcasting explicit messenger cues.</span>
                  </li>
                </ul>
              </div>

              {/* Launcher preview dock row */}
              <div className="p-4 bg-[#1A0F2E]/60 border border-purple-900/30 rounded-2xl flex items-center justify-around">
                <div className="flex flex-col items-center gap-1.5 opacity-40">
                  <div className="w-12 h-12 rounded-2xl bg-[#07060B] border border-purple-900/40"></div>
                  <span className="text-[9px] text-purple-400/50">Phone</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <OnlyUsAndroidIcon size={52} showShadow={false} />
                  <span className="text-[10px] text-purple-200 font-medium font-sans">OnlyUs</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 opacity-40">
                  <div className="w-12 h-12 rounded-2xl bg-[#07060B] border border-purple-900/40"></div>
                  <span className="text-[9px] text-purple-400/50">Camera</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 opacity-40">
                  <div className="w-12 h-12 rounded-2xl bg-[#07060B] border border-purple-900/40"></div>
                  <span className="text-[9px] text-purple-400/50">Settings</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Brand Signoff */}
      <div className="max-w-4xl mx-auto mt-16 pt-8 border-t border-neutral-900 text-center text-xs text-neutral-500 font-mono">
        OnlyUs Brand Identity • Crafted exclusively for private communication between loved ones.
      </div>
    </div>
  );
};
