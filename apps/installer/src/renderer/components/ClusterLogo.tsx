import React from 'react';
import logoUrl from '../assets/logo.png';

export interface ClusterLogoProps {
  size?: number;
  className?: string;
  rounded?: boolean;
}

export const ClusterLogo: React.FC<ClusterLogoProps> = ({
  size = 48,
  className = '',
  rounded = true,
}) => {
  const px = `${size}px`;

  return (
    <div
      style={{
        width: px,
        height: px,
        minWidth: px,
        minHeight: px,
        maxWidth: px,
        maxHeight: px,
      }}
      className={`relative shrink-0 overflow-hidden flex items-center justify-center ${
        rounded ? 'rounded-xl' : ''
      } ${className}`}
    >
      <img
        src={logoUrl}
        alt="Cluster Logo"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        className="w-full h-full object-contain pointer-events-none select-none"
        draggable={false}
      />
    </div>
  );
};

export default ClusterLogo;
