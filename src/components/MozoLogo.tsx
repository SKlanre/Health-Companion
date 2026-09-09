import React from 'react';
import { BrandLogo, BrandLogoProps } from './BrandLogo';

export interface MozoLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'wordmark' | 'badge' | 'icon';
  alt?: string;
  invertInDark?: boolean;
  renderMode?: 'svg' | 'image';
  withBacking?: boolean;
}

/**
 * MozoLogo Component (Compatibility wrapper around BrandLogo)
 * Renders the approved MOZO wordmark vector artwork from `public/brand/mozo-logo.svg`.
 * Adheres to brand guidelines: preserves original black vector paths without CSS invert or tinting,
 * using a neutral light backing surface for dark-mode contrast.
 */
export const MozoLogo: React.FC<MozoLogoProps> = ({
  className = '',
  size = 32,
  variant = 'wordmark',
  alt = 'MOZO',
  withBacking = true,
}) => {
  const heightValue = typeof size === 'number' ? `${size}px` : size;

  return (
    <BrandLogo
      alt={alt}
      className={className}
      height={variant === 'wordmark' ? heightValue : undefined}
      width={variant !== 'wordmark' ? heightValue : undefined}
      withBacking={withBacking}
    />
  );
};

export default MozoLogo;
