import React, { useEffect, useState } from "react";
import { AIAnalysisResult, SignalType } from "../types";
import { Sparkles, TrendingUp, TrendingDown, BarChart2, RefreshCw } from "lucide-react";

interface OraclePanelProps {
  analysis: AIAnalysisResult | null;
  loading: boolean;
  onAnalyze: () => void;
}

// Progress bar messages for AI processing
const PROGRESS_MESSAGES = [
  "Initializing neural network...",
  "Fetching market data...",
  "Analyzing price patterns...",
  "Computing technical indicators...",
  "Scanning news sentiment...",
  "Processing neural vectors...",
  "Generating trade signals...",
  "Finalizing analysis...",
];

const OraclePanel: React.FC<OraclePanelProps> = ({ analysis, loading, onAnalyze }) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // Animate progress bar when loading
  useEffect(() => {
    if (!loading) {
      setProgress(0);
      setMessageIndex(0);
      return;
    }

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev; // Cap at 95% until complete
        return prev + Math.random() * 8 + 2; // Random increment 2-10%
      });
    }, 300);

    // Message rotation
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % PROGRESS_MESSAGES.length);
    }, 1500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [loading]);

  return (
    <div className="bg-terminal-dark border border-gray-800 rounded-lg p-4 sm:p-6 flex flex-col relative overflow-hidden min-h-[400px]">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-purple-900 opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex justify-between items-center mb-4 sm:mb-6 z-10 relative">
        <h2 className="text-base sm:text-lg md:text-xl font-bold font-mono text-white flex items-center">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 mr-1.5 sm:mr-2" />
          THE ORACLE AI
        </h2>
        {!analysis && !loading && (
          <button
            onClick={onAnalyze}
            className="bg-purple-600 hover:bg-purple-700 text-white font-mono text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4 rounded transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)]"
          >
            ANALYZE
          </button>
        )}
      </div>

      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 sm:space-y-6 z-10 relative">
          {/* Animated spinner */}
          <div className="relative">
            <div className="w-14 h-14 sm:w-16 sm:h-16 border-4 border-purple-500/30 rounded-full"></div>
            <div className="absolute inset-0 w-14 h-14 sm:w-16 sm:h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-purple-400 animate-pulse" />
          </div>
          
          {/* Progress bar */}
          <div className="w-full max-w-xs space-y-2">
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 via-purple-500 to-purple-400 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-purple-400 font-mono text-[10px] sm:text-xs animate-pulse">
                {PROGRESS_MESSAGES[messageIndex]}
              </span>
              <span className="text-purple-500 font-mono text-[10px] sm:text-xs font-bold">
                {Math.round(Math.min(progress, 99))}%
              </span>
            </div>
          </div>
        </div>
      )}

      {analysis && !loading && (
        <div className="flex-1 flex flex-col animate-fade-in z-10 relative">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex flex-col">
              <span className="text-gray-400 text-[10px] sm:text-xs font-mono uppercase">Signal</span>
              <span
                className={`text-2xl sm:text-3xl md:text-4xl font-bold tracking-tighter ${
                  analysis.signal === SignalType.BUY
                    ? "text-profit-green drop-shadow-[0_0_10px_rgba(0,255,157,0.5)]"
                    : analysis.signal === SignalType.SELL
                      ? "text-loss-red drop-shadow-[0_0_10px_rgba(255,0,85,0.5)]"
                      : "text-yellow-400"
                }`}
              >
                {analysis.signal}
              </span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-gray-400 text-[10px] sm:text-xs font-mono uppercase">Win Rate</span>
              <div className="flex items-end justify-end">
                <span className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{analysis.confidence}%</span>
              </div>
            </div>
          </div>

          {/* Trade Plan Grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            <div className="bg-gray-900/50 p-1.5 sm:p-2 rounded border border-gray-700/50">
              <div className="text-[10px] sm:text-xs text-gray-500 font-mono">ENTRY ZONE</div>
              <div className="text-xs sm:text-sm font-bold text-white truncate">{analysis.entryArea}</div>
            </div>
            <div className="bg-gray-900/50 p-1.5 sm:p-2 rounded border border-gray-700/50">
              <div className="text-[10px] sm:text-xs text-gray-500 font-mono">TIMING</div>
              <div className="text-xs sm:text-sm font-bold text-blue-300 truncate">{analysis.predictionTime}</div>
            </div>
            <div className="bg-gray-900/50 p-1.5 sm:p-2 rounded border border-gray-700/50">
              <div className="text-[10px] sm:text-xs text-gray-500 font-mono">STOP LOSS</div>
              <div className="text-xs sm:text-sm font-bold text-loss-red truncate">{analysis.stopLoss}</div>
            </div>
            <div className="bg-gray-900/50 p-1.5 sm:p-2 rounded border border-gray-700/50">
              <div className="text-[10px] sm:text-xs text-gray-500 font-mono">
                {analysis.signal === "SELL" && analysis.takeProfit1 !== "N/A"
                  ? "TARGETS"
                  : "TARGETS"}
              </div>
              <div className="text-xs sm:text-sm font-bold text-profit-green">
                TP1: {analysis.takeProfit1}
                <br />
                TP2: {analysis.takeProfit2}
              </div>
            </div>
          </div>

          <div className="bg-black/30 p-3 sm:p-4 rounded border border-gray-800">
            <div className="text-gray-400 text-[10px] sm:text-xs font-mono uppercase mb-1.5 sm:mb-2">The Verdict</div>
            <p className="text-gray-300 text-xs sm:text-sm leading-relaxed font-mono text-justify">
              "{analysis.reasoning}"
            </p>
          </div>

          {/* Sentiment Section */}
          {analysis.sentiment && analysis.sentiment.type && (
            <div className={`mt-3 sm:mt-4 p-3 sm:p-4 rounded border ${
              analysis.sentiment.type === "BULLISH" 
                ? "bg-profit-green/10 border-profit-green/30" 
                : analysis.sentiment.type === "BEARISH"
                  ? "bg-loss-red/10 border-loss-red/30"
                  : "bg-yellow-500/10 border-yellow-500/30"
            }`}>
              <div className="flex items-start gap-2 sm:gap-3 mb-2">
                <span className={`flex-shrink-0 ${
                  analysis.sentiment.type === "BULLISH" 
                    ? "text-profit-green" 
                    : analysis.sentiment.type === "BEARISH"
                      ? "text-loss-red"
                      : "text-yellow-400"
                }`}>
                  {analysis.sentiment.type === "BULLISH" ? (
                    <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : analysis.sentiment.type === "BEARISH" ? (
                    <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <BarChart2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded ${
                      analysis.sentiment.type === "BULLISH" 
                        ? "bg-profit-green/20 text-profit-green" 
                        : analysis.sentiment.type === "BEARISH"
                          ? "bg-loss-red/20 text-loss-red"
                          : "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {analysis.sentiment.type}
                    </span>
                    {analysis.sentiment.source && (
                      <span className="text-[10px] sm:text-xs text-gray-500 font-mono">
                        • {analysis.sentiment.source}
                      </span>
                    )}
                  </div>
                  <div className={`text-xs sm:text-sm font-bold leading-tight ${
                    analysis.sentiment.type === "BULLISH" 
                      ? "text-profit-green" 
                      : analysis.sentiment.type === "BEARISH"
                        ? "text-loss-red"
                        : "text-yellow-400"
                  }`}>
                    {analysis.sentiment.headline}
                  </div>
                </div>
              </div>
              {analysis.sentiment.description && (
                <p className="text-gray-400 text-[10px] sm:text-xs font-mono leading-relaxed text-justify pl-7 sm:pl-9 border-l-2 border-gray-700/50 ml-2">
                  {analysis.sentiment.description}
                </p>
              )}
            </div>
          )}

          <button
            onClick={onAnalyze}
            className="mt-3 sm:mt-4 w-full border border-gray-700 hover:bg-gray-800 text-gray-400 hover:text-white font-mono text-[10px] sm:text-xs py-1.5 sm:py-2 rounded transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3 h-3" />
            REFRESH ANALYSIS
          </button>
        </div>
      )}

      {!analysis && !loading && (
        <div className="flex-1 flex items-center justify-center text-center opacity-50 z-10 relative">
          <p className="text-xs sm:text-sm text-gray-500 font-mono max-w-[180px] sm:max-w-[200px]">
            Ready to deploy deep learning algorithms on current market data.
          </p>
        </div>
      )}
    </div>
  );
};

export default OraclePanel;
