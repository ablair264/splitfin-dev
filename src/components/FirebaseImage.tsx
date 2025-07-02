// src/components/FirebaseImage.tsx
import React, { useState, useEffect } from 'react';
import { getDownloadURL, ref as storageRef, getBytes, getStorage } from 'firebase/storage';
import { useInView } from 'react-intersection-observer';

const storage = getStorage();

interface FirebaseImageProps {
  sku: string;
  className?: string;
  onLoadBlob?: (objectUrl: string) => void;
  /** optional scroll container for IntersectionObserver */
  root?: Element | null;
}

const FirebaseImage: React.FC<FirebaseImageProps> = ({
  sku,
  className,
  onLoadBlob,
  root,
}) => {
  const [url, setUrl] = useState<string>();
  const { ref: inViewRef, inView } = useInView({
    /** watch your grid wrapper instead of window */
    root: root || undefined,
    rootMargin: '200px',
    triggerOnce: true,
  });

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    (async () => {
      // try both folders and extensions
      const folders = ['product-images', 'products'];
      let downloadUrl: string | undefined;
      for (const folder of folders) {
        for (const ext of ['jpg', 'png']) {
          try {
            const fileRef = storageRef(storage, `${folder}/${sku}.${ext}`);
            downloadUrl = await getDownloadURL(fileRef);
            break;
          } catch { /* try next */ }
        }
        if (downloadUrl) break;
      }
      if (!downloadUrl || cancelled) return;
      setUrl(downloadUrl);

      // optional blob fetch
      if (onLoadBlob) {
        try {
          const pathSegment = downloadUrl.split('/o/')[1].split('?')[0];
          const decoded = decodeURIComponent(pathSegment);
          const blobRef = storageRef(storage, decoded);
          const bytes = await getBytes(blobRef);
          if (!cancelled) {
            const objUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
            onLoadBlob(objUrl);
          }
        } catch { /* swallow */ }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inView, sku, onLoadBlob]);

  return (
    <div ref={inViewRef}>
      {url ? <img src={url} className={className} alt={sku} /> : <div className={className} />}
    </div>
  );
};

export default FirebaseImage;