// src/services/aiAnalyticsService.ts (Frontend service)

const API_BASE = import.meta.env.VITE_API_BASE || 'https://splitfin-zoho-api.onrender.com';

// Get auth token
const getAuthToken = () => {
  return localStorage.getItem('authToken') || '';
};

// Helper for API calls
const apiCall = async (endpoint: string, data: any) => {
  const response = await fetch(`${API_BASE}/api/ai-insights/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
      'x-user-id': localStorage.getItem('userId') || ''
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'AI service error');
  }

  return response.json();
};

export async function generatePurchaseOrderInsights(
  brand: string,
  suggestions: any[],
  historicalSales: any,
  marketData: any
) {
  try {
    const result = await apiCall('purchase-order-insights', {
      brand,
      suggestions,
      historicalSales,
      marketData
    });
    
    return result.data;
  } catch (error) {
    console.error('Purchase order insights error:', error);
    // Return fallback data
    return {
      executiveSummary: "AI analysis temporarily unavailable",
      marketTiming: "Unable to assess",
      riskAssessment: "Analysis pending",
      categoryOptimization: [],
      cashFlowImpact: "Unknown",
      alternativeStrategies: [],
      confidenceAssessment: "Low confidence"
    };
  }
}

export async function generateProductPurchaseInsights(
  product: any,
  suggestion: any,
  competitorData: any,
  searchTrends: any
) {
  try {
    const result = await apiCall('product-purchase-insights', {
      product,
      suggestion,
      competitorData,
      searchTrends
    });
    
    return result.data;
  } catch (error) {
    console.error('Product insights error:', error);
    return null;
  }
}

export async function validatePurchaseAdjustments(
  originalSuggestions: any[],
  userAdjustments: any[],
  brand: string
) {
  try {
    const result = await apiCall('validate-adjustments', {
      originalSuggestions,
      userAdjustments,
      brand
    });
    
    return result.data;
  } catch (error) {
    console.error('Validation error:', error);
    return {
      adjustmentAssessment: "Unable to validate",
      potentialRisks: [],
      improvements: [],
      alternativeSuggestions: [],
      confidenceInAdjustments: 50
    };
  }
}

// Check AI service health
export async function checkAIHealth() {
  try {
    const response = await fetch(`${API_BASE}/api/ai-insights/health`);
    return response.json();
  } catch (error) {
    console.error('AI health check failed:', error);
    return { success: false, aiEnabled: false };
  }
}