import React from "react";
import { AIAnalysisResult, SignalType } from "../types";

interface OraclePanelProps {
  analysis: AIAnalysisResult | null;
  loading: boolean;
  onAnalyze: () => void;
}

const OraclePanel: React.FC<OraclePanelProps> = ({ analysis, loading, onAnalyze }) => {
  return (
    <div className="bg-terminal-dark border border-gray-800 rounded-lg p-4 sm:p-6 h-full flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-purple-900 opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex justify-between items-center mb-4 sm:mb-6 z-10 relative">
        <h2 className="text-base sm:text-lg md:text-xl font-bold font-mono text-white flex items-center">
          <span className="text-purple-500 mr-1.5 sm:mr-2">✦</span>
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
        <div className="flex-1 flex flex-col items-center justify-center space-y-3 sm:space-y-4 animate-pulse z-10 relative">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-purple-400 font-mono text-xs sm:text-sm">Processing Neural Vectors...</div>
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

          <div className="bg-black/30 p-3 sm:p-4 rounded border border-gray-800 flex-1 overflow-y-auto max-h-[120px] sm:max-h-[150px]">
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
                <span className={`text-xl sm:text-2xl flex-shrink-0 ${
                  analysis.sentiment.type === "BULLISH" 
                    ? "text-profit-green" 
                    : analysis.sentiment.type === "BEARISH"
                      ? "text-loss-red"
                      : "text-yellow-400"
                }`}>
                  {analysis.sentiment.type === "BULLISH" ? "📈" : analysis.sentiment.type === "BEARISH" ? "📉" : "📊"}
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
            className="mt-3 sm:mt-4 w-full border border-gray-700 hover:bg-gray-800 text-gray-400 hover:text-white font-mono text-[10px] sm:text-xs py-1.5 sm:py-2 rounded transition-colors"
          >
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
