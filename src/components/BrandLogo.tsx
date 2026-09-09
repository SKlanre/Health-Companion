import React, { useState } from 'react';

export interface BrandLogoProps {
  /** Optional additional CSS classes for sizing and layout */
  className?: string;
  /** Explicit width in pixels or CSS units (e.g. 200, '12rem') */
  width?: number | string;
  /** Explicit height in pixels or CSS units (e.g. 48, 'auto') */
  height?: number | string;
  /** Accessible alt text; defaults to 'MOZO'. Pass '' if accompanied by adjacent brand title */
  alt?: string;
  /** Whether to place the logo on a neutral light backing surface for high dark-mode contrast */
  withBacking?: boolean;
  /** Optional custom image source URL */
  src?: string;
}

/**
 * BrandLogo Component
 * Renders the approved MOZO wordmark vector artwork from `public/brand/mozo-logo.svg`.
 * - Preserves exact aspect ratio and all vector path details without cropping or distortion.
 * - Adheres to brand guidelines: no CSS invert, no color tints or gradients applied to the artwork.
 * - Provides an optional clean, neutral light backing surface to ensure contrast in dark mode.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  width,
  height,
  alt = 'MOZO',
  withBacking = true,
  src,
}) => {
  const metaEnv = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const baseUrl = (metaEnv?.BASE_URL || '/').replace(/\/$/, '') + '/';
  const primarySrc = src || `${baseUrl}brand/mozo-logo.svg`;
  const [currentSrc, setCurrentSrc] = useState<string>(primarySrc);

  const handleImageError = () => {
    // Graceful fallback chain if asset base path differs
    if (currentSrc !== '/brand/mozo-logo.svg' && currentSrc !== '/mozo-logo.svg') {
      setCurrentSrc('/brand/mozo-logo.svg');
    } else if (currentSrc === '/brand/mozo-logo.svg') {
      setCurrentSrc('/mozo-logo.svg');
    }
  };

  const styleObj: React.CSSProperties = {
    ...(width ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
  };

  const imageElement = (
    <img
      src={currentSrc}
      alt={alt}
      className={`object-contain ${withBacking ? 'w-full h-auto max-h-full' : className}`}
      style={!withBacking ? styleObj : undefined}
      onError={handleImageError}
      loading="eager"
      decoding="async"
    />
  );

  if (!withBacking) {
    return imageElement;
  }

  // Neutral backing container ensuring strong contrast in both light and dark modes
  // The artwork itself remains untinted black on transparent
  return (
    <div
      className={`inline-flex items-center justify-center bg-white dark:bg-white/95 rounded-2xl px-3.5 py-1.5 shadow-sm border border-slate-200/70 dark:border-slate-700/60 select-none ${className}`}
      style={styleObj}
    >
      {imageElement}
    </div>
  );
};

export default BrandLogo;
