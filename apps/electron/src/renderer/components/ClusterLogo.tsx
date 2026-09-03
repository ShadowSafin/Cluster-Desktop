import React from 'react';
import logoUrl from '../assets/logo.png';

export interface ClusterLogoProps {
  size?: number | string;
  className?: string;
  rounded?: boolean;
  withShadow?: boolean;
  alt?: string;
}

export const ClusterLogo: React.FC<ClusterLogoProps> = ({
  size = 24,
  className = '',
  rounded = true,
  withShadow = false,
  alt = 'Cluster Logo',
}) => {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <img
      src={logoUrl}
      alt={alt}
      style={{
        width: dimension,
        height: dimension,
        minWidth: dimension,
        minHeight: dimension,
        objectFit: 'contain',
      }}
      className={`shrink-0 select-none ${rounded ? 'rounded-lg' : ''} ${
        withShadow ? 'shadow-md shadow-black/40' : ''
      } ${className}`}
      draggable={false}
    />
  );
};

export default ClusterLogo;
