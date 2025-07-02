import React from 'react';
import './ProgressBar.css';

interface ProgressStep {
  id: number;
  label: string;
  active: boolean;
  completed: boolean;
}

interface ProgressBarProps {
  currentStep: number;
}

const PROGRESS_STEPS = [
  { id: 1, label: 'Select Brand' },
  { id: 2, label: 'Browse Products' },
  { id: 3, label: 'Review Cart' },
  { id: 4, label: 'Place Order' },
  { id: 5, label: 'Order Confirmed' },
];

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep }) => {
  const steps = PROGRESS_STEPS.map(step => ({
    ...step,
    active: step.id === currentStep,
    completed: step.id < currentStep
  }));

  return (
    <div className="progress-bar-container">
      <div className="progress-bar">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className={`progress-step ${step.active ? 'active' : ''} ${step.completed ? 'completed' : ''}`}>
              <div className="progress-circle">
                {step.completed ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13.5 4.5L6 12L2.5 8.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span>{step.id}</span>
                )}
              </div>
              <span className="progress-label">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`progress-line ${step.completed ? 'completed' : ''}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};