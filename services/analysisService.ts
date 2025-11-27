import { AIAnalysisResult } from '../types';

export interface AnalysisRecord {
  id: number;
  ticker: string;
  date_created: string;
  signal: string;
  entry_price: number;
  tp1: number;
  tp2: number;
  stop_loss: number;
  reasoning: string;
  status: string;
  highest_price: number;
  lowest_price: number;
}

const parsePrice = (priceStr: string): number => {
  const match = priceStr.match(/[\d,.]+/);
  if (match) {
    return parseFloat(match[0].replace(/,/g, ''));
  }
  return 0;
};

export const saveAnalysis = async (analysis: AIAnalysisResult, ticker: string) => {
  try {
    const response = await fetch('/_svc/analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticker,
        signal: analysis.signal,
        entry_price: parsePrice(analysis.entryArea),
        tp1: parsePrice(analysis.takeProfit1),
        tp2: parsePrice(analysis.takeProfit2),
        stop_loss: parsePrice(analysis.stopLoss),
        reasoning: analysis.reasoning,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save analysis');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error saving analysis:', error);
    throw error;
  }
};

export const getAnalysisHistory = async (limit: number = 5, offset: number = 0): Promise<AnalysisRecord[]> => {
  try {
    const response = await fetch(`/_svc/analysis?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error('Failed to fetch history');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching history:', error);
    throw error;
  }
};
