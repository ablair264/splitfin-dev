// src/hooks/useProgressTracking.ts
import { useState, useCallback, useRef } from 'react';

interface ProgressStep {
  name: string;
  weight: number;
}

export const useProgressTracking = (steps: ProgressStep[]) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const stepProgressRef = useRef<Map<string, number>>(new Map());
  
  const updateStepProgress = useCallback((stepName: string, stepProgressValue: number) => {
    const step = steps.find(s => s.name === stepName);
    if (!step) return;
    
    // Store this step's progress
    stepProgressRef.current.set(stepName, Math.min(100, Math.max(0, stepProgressValue)));
    
    // Calculate total progress
    let totalProgress = 0;
    let totalWeight = 0;
    
    steps.forEach(step => {
      const progress = stepProgressRef.current.get(step.name) || 0;
      totalProgress += (progress * step.weight) / 100;
      totalWeight += step.weight;
    });
    
    const overallProgress = totalWeight > 0 ? (totalProgress / totalWeight) * 100 : 0;
    setProgress(overallProgress);
  }, [steps]);
  
  const startStep = useCallback((stepName: string) => {
    setCurrentStep(stepName);
    updateStepProgress(stepName, 0);
  }, [updateStepProgress]);
  
  const completeStep = useCallback((stepName: string) => {
    updateStepProgress(stepName, 100);
  }, [updateStepProgress]);
  
  const reset = useCallback(() => {
    stepProgressRef.current.clear();
    setProgress(0);
    setCurrentStep('');
  }, []);
  
  return {
    progress,
    currentStep,
    updateStepProgress,
    startStep,
    completeStep,
    reset
  };
};