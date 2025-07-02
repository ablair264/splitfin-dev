// src/components/ProgressBar.tsx
import React from 'react';
import './ProgressBar.css';

interface ProgressStep {
  id: number;
  label: string;
  subLabel?: string;
  status: 'completed' | 'active' | 'pending';
}

interface ProgressBarProps {
  currentStep: number;
  theme?: 'light' | 'dark';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, theme = 'dark' }) => {
  const steps: ProgressStep[] = [
    { 
      id: 1, 
      label: 'Select Brand',
      subLabel: 'Completed',
      status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'active' : 'pending' 
    },
    { 
      id: 2, 
      label: 'Browse Items',
      subLabel: 'In Progress',
      status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : 'pending' 
    },
    { 
      id: 3, 
      label: 'Review Order',
      subLabel: 'Pending',
      status: currentStep > 3 ? 'completed' : currentStep === 3 ? 'active' : 'pending' 
    },
    { 
      id: 4, 
      label: 'Place Order',
      subLabel: 'Pending',
      status: currentStep > 4 ? 'completed' : currentStep === 4 ? 'active' : 'pending' 
    },
    { 
      id: 5, 
      label: 'Order Confirmed',
      subLabel: 'Pending',
      status: currentStep >= 5 ? 'completed' : 'pending' 
    },
  ];

  return (
    <div className={`progress-bar-wrapper ${theme}`}>
      <div className="progress-bar">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className={`progress-step ${step.status}`}>
              <div className="step-indicator">
                {step.status === 'completed' ? (
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                    <path 
                      d="M1 5L5 9L13 1" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="step-number">{step.id}</span>
                )}
              </div>
              <div className="step-content">
                <span className="step-label">{step.label}</span>
                <span className="step-sublabel">{step.subLabel}</span>
              </div>
            </div>
            
            {index < steps.length - 1 && (
              <div className={`progress-connector ${
                steps[index + 1].status !== 'pending' ? 'completed' : ''
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};