import React from 'react';
import './Skeleton.css';

/**
 * Generic shimmer skeleton loader
 * @param {Object} props
 * @param {number} props.width - Width in pixels (default: 100%)
 * @param {number} props.height - Height in pixels (default: 20)
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.variant - 'rounded' | 'circle' | 'default'
 */
export function Skeleton({
  width = '100%',
  height = 20,
  className = '',
  variant = 'default',
}) {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  const variantClass = `skeleton-${variant}`;

  return (
    <div className={`skeleton ${variantClass} ${className}`} style={style} />
  );
}

/**
 * Skeleton for loading a post card in the feed
 */
export function PostCardSkeleton() {
  return (
    <div className="post-card skeleton-card">
      <div className="post-header">
        <div className="skeleton-wrapper">
          <Skeleton width={40} height={40} variant="circle" />
        </div>
        <div className="skeleton-content" style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width="60%" height={16} className="skeleton-mb-8" />
          <Skeleton width="40%" height={12} />
        </div>
        <Skeleton width={20} height={20} variant="rounded" />
      </div>

      <div style={{ marginTop: 16 }}>
        <Skeleton width="100%" height={14} className="skeleton-mb-8" />
        <Skeleton width="95%" height={14} className="skeleton-mb-8" />
        <Skeleton width="85%" height={14} />
      </div>

      <Skeleton width="100%" height={200} className="skeleton-rounded-lg skeleton-mt-16" />

      <div className="post-actions">
        <Skeleton width={60} height={32} variant="rounded" />
        <Skeleton width={60} height={32} variant="rounded" />
        <Skeleton width={60} height={32} variant="rounded" />
      </div>
    </div>
  );
}

/**
 * Skeleton for loading a media card (video/audio)
 */
export function MediaCardSkeleton() {
  return (
    <div className="media-card skeleton-card">
      <div className="skeleton-wrapper">
        <Skeleton width="100%" height={240} variant="rounded" />
      </div>
      <div style={{ padding: 12 }}>
        <Skeleton width="80%" height={16} className="skeleton-mb-8" />
        <Skeleton width="100%" height={14} className="skeleton-mb-8" />
        <Skeleton width="60%" height={12} />
      </div>
    </div>
  );
}

/**
 * Skeleton for loading a hangout room card
 */
export function HangoutCardSkeleton() {
  return (
    <div className="hangout-card skeleton-card">
      <div className="skeleton-wrapper">
        <Skeleton width="100%" height={180} variant="rounded" />
      </div>
      <div style={{ padding: 12 }}>
        <Skeleton width="70%" height={18} className="skeleton-mb-8" />
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton width={32} height={32} variant="circle" />
          <Skeleton width={32} height={32} variant="circle" />
          <Skeleton width={32} height={32} variant="circle" />
        </div>
      </div>
    </div>
  );
}

/**
 * Grid of skeleton loaders for lists
 */
export function SkeletonGrid({
  count = 4,
  variant = 'media',
  columns = 2,
}) {
  const SkeletonComponent =
    variant === 'post'
      ? PostCardSkeleton
      : variant === 'hangout'
        ? HangoutCardSkeleton
        : MediaCardSkeleton;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 16,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
}

export default Skeleton;
