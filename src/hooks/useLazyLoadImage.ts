import { useState, useEffect, useRef } from 'react';

export const useLazyLoadImage = (src: string | null) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageRef, setImageRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let observer: IntersectionObserver;
    
    if (imageRef && src) {
      observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setImageSrc(src);
              observer.unobserve(entry.target);
            }
          });
        },
        { 
          threshold: 0.1,
          rootMargin: '50px' // Start loading 50px before the image comes into view
        }
      );
      
      observer.observe(imageRef);
    }
    
    return () => {
      if (observer && observer.unobserve) {
        observer.disconnect();
      }
    };
  }, [imageRef, src]);

  return [setImageRef, imageSrc] as const;
};