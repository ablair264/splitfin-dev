// src/components/LazyImage/LazyImage.tsx
import React, { useState } from 'react';
import { useLazyLoadImage } from '../../hooks/useLazyLoadImage';
import './LazyImage.css';

interface LazyImageProps {
  src: string | null;
  alt: string;
  placeholder?: React.ReactNode;
}

export const LazyImage: React.FC<LazyImageProps> = ({ src, alt, placeholder }) => {
  const [setRef, imageSrc] = useLazyLoadImage(src);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div ref={setRef} className="lazy-image-container">
      {/* Show placeholder while image hasn't started loading */}
      {!imageSrc && (
        <div className="lazy-image-placeholder">
          {placeholder || <div className="dmb-image-placeholder"><span>Loading...</span></div>}
        </div>
      )}
      
      {/* Show loading spinner while image is loading */}
      {imageSrc && !isLoaded && !hasError && (
        <div className="lazy-image-loading">
          <div className="dmb-spinner"></div>
        </div>
      )}
      
      {/* Show error state if image fails to load */}
      {hasError && (
        <div className="dmb-image-placeholder">
          <span>No Image</span>
        </div>
      )}
      
      {/* The actual image */}
      {imageSrc && !hasError && (
        <img
          src={imageSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`lazy-image ${isLoaded ? 'loaded' : ''}`}
        />
      )}
    </div>
  );
};