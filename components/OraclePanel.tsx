import React from "react";
import { AIAnalysisResult, SignalType } from "../types";

interface OraclePanelProps {
  analysis: AIAnalysisResult | null;
  loading: boolean;
  onAnalyze: () => void;
}

const OraclePanel: React.FC<OraclePanelProps> = ({ analysis, loading, onAnalyze }) => {
  return (
    <div className="bg-terminal-dark border border-gray-800 rounded-lg p-6 h-full flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-900 opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex justify-between items-center mb-6 z-10 relative">
        <h2 className="text-xl font-bold font-mono text-white flex items-center">
          <span className="text-purple-500 mr-2">✦</span>
          THE ORACLE AI
        </h2>
        {!analysis && !loading && (
          <button
            onClick={onAnalyze}
            className="bg-purple-600 hover:bg-purple-700 text-white font-mono text-sm py-2 px-4 rounded transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)]"
          >
            ANALYZE MARKET
          </button>
        )}
      </div>

      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-pulse z-10 relative">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-purple-400 font-mono text-sm">Processing Neural Vectors...</div>
        </div>
      )}

      {analysis && !loading && (
        <div className="flex-1 flex flex-col animate-fade-in z-10 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs font-mono uppercase">Signal</span>
              <span
                className={`text-4xl font-bold tracking-tighter ${
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
              <span className="text-gray-400 text-xs font-mono uppercase">Win Rate Prob.</span>
              <div className="flex items-end justify-end">
                <span className="text-3xl font-bold text-white">{analysis.confidence}%</span>
              </div>
            </div>
          </div>

          {/* Trade Plan Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-gray-900/50 p-2 rounded border border-gray-700/50">
              <div className="text-xs text-gray-500 font-mono">ENTRY ZONE</div>
              <div className="text-sm font-bold text-white">{analysis.entryArea}</div>
            </div>
            <div className="bg-gray-900/50 p-2 rounded border border-gray-700/50">
              <div className="text-xs text-gray-500 font-mono">TIMING</div>
              <div className="text-sm font-bold text-blue-300">{analysis.predictionTime}</div>
            </div>
            <div className="bg-gray-900/50 p-2 rounded border border-gray-700/50">
              <div className="text-xs text-gray-500 font-mono">STOP LOSS</div>
              <div className="text-sm font-bold text-loss-red">{analysis.stopLoss}</div>
            </div>
            <div className="bg-gray-900/50 p-2 rounded border border-gray-700/50">
              <div className="text-xs text-gray-500 font-mono">
                {analysis.signal === "SELL" && analysis.takeProfit1 !== "N/A"
                  ? "TARGETS (DOWN)"
                  : "TARGETS"}
              </div>
              <div className="text-sm font-bold text-profit-green">
                TP1: {analysis.takeProfit1}
                <br />
                TP2: {analysis.takeProfit2}
              </div>
            </div>
          </div>

          <div className="bg-black/30 p-4 rounded border border-gray-800 flex-1 overflow-y-auto max-h-[150px]">
            <div className="text-gray-400 text-xs font-mono uppercase mb-2">The Verdict</div>
            <p className="text-gray-300 text-sm leading-relaxed font-mono">
              "{analysis.reasoning}"
            </p>
          </div>

          <button
            onClick={onAnalyze}
            className="mt-4 w-full border border-gray-700 hover:bg-gray-800 text-gray-400 hover:text-white font-mono text-xs py-2 rounded transition-colors"
          >
            REFRESH ANALYSIS
          </button>
        </div>
      )}

      {!analysis && !loading && (
        <div className="flex-1 flex items-center justify-center text-center opacity-50 z-10 relative">
          <p className="text-sm text-gray-500 font-mono max-w-[200px]">
            Ready to deploy deep learning algorithms on current market data.
          </p>
        </div>
      )}
    </div>
  );
};

export default OraclePanel;
