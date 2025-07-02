// src/components/ProgressLoader.tsx
import React from 'react';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';
import './ProgressLoader.css';

interface ProgressLoaderProps {
  progress: number; // 0-100
  message?: string;
  submessage?: string;
  size?: number;
}

export const ProgressLoader: React.FC<ProgressLoaderProps> = ({ 
  progress, 
  message = 'Loading...', 
  submessage,
  size = 100 
}) => {
  return (
    <div className="progress-loader-container">
      <div className="progress-loader-content">
        <Lottie 
          animationData={loaderAnimation}
          loop={true}
          autoplay={true}
          style={{ width: size, height: size }}
        />
        
        <div className="progress-info">
          <h3 className="progress-message">{message}</h3>
          {submessage && <p className="progress-submessage">{submessage}</p>}
        </div>
        
        <div className="progress-loader-bar-container"> {/* CHANGED CLASS NAME */}
          <div className="progress-loader-bar"> {/* CHANGED CLASS NAME */}
            <div 
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <span className="progress-percentage">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
};