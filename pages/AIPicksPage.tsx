import React, { useEffect, useState } from 'react';
import { getAIPicks, AnalysisRecord } from '../services/analysisService';
import { Link } from 'react-router-dom';
import { Loader2, Bot, TrendingUp } from 'lucide-react';

const AIPicksPage: React.FC = () => {
  const [picks, setPicks] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPicks = async () => {
      try {
        const data = await getAIPicks();
        setPicks(data);
      } catch (error) {
        console.error("Failed to load AI picks", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPicks();
  }, []);

  return (
    <div className="min-h-screen bg-terminal-black text-gray-300 p-8 font-sans selection:bg-profit-green selection:text-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <Bot className="w-8 h-8 text-profit-green" />
              AI STOCK SCREENER <span className="text-gray-500 text-lg font-normal">(IDX MARKET)</span>
            </h1>
            <p className="text-gray-400 mt-2 font-mono text-sm">
              Automated market scan & AI selection based on technical indicators.
            </p>
          </div>
          <Link to="/" className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded border border-gray-700 font-mono text-sm transition-colors">
            ← BACK TO TERMINAL
          </Link>
        </div>

        <div className="bg-terminal-gray border border-gray-800 rounded-lg overflow-hidden mb-8 shadow-xl">
          {loading ? (
            <div className="p-12 flex justify-center items-center text-gray-500 font-mono">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              SCANNING MARKET DATA...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono">
                <thead className="bg-gray-900 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="p-4">DATE</th>
                    <th className="p-4">TICKER</th>
                    <th className="p-4">SIGNAL</th>
                    <th className="p-4">ENTRY AREA</th>
                    <th className="p-4">TARGETS (TP)</th>
                    <th className="p-4">STOP LOSS</th>
                    <th className="p-4 w-1/3">AI REASONING</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {picks.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-800/50 transition-colors group">
                      <td className="p-4 text-gray-500 whitespace-nowrap">
                        {new Date(record.date_created).toLocaleDateString()} <br/>
                        <span className="text-xs opacity-70">{new Date(record.date_created).toLocaleTimeString()}</span>
                      </td>
                      <td className="p-4 font-bold text-white text-lg">{record.ticker}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                          record.signal === 'BUY' ? 'bg-green-900/30 text-profit-green border border-green-900' : 'bg-red-900/30 text-loss-red border border-red-900'
                        }`}>
                          {record.signal === 'BUY' && <TrendingUp className="w-3 h-3" />}
                          {record.signal}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-gray-300">{record.entry_price.toLocaleString()}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-profit-green font-medium">TP1: {record.tp1.toLocaleString()}</span>
                          <span className="text-green-400/70 text-xs">TP2: {record.tp2.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="p-4 text-loss-red font-medium">{record.stop_loss.toLocaleString()}</td>
                      <td className="p-4 text-gray-400 text-xs leading-relaxed">
                        <div className="line-clamp-3 group-hover:line-clamp-none transition-all duration-300">
                          {record.reasoning.replace('[AI-SCREENER] ', '')}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {picks.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-3">
                          <Bot className="w-12 h-12 opacity-20" />
                          <p>NO AI PICKS GENERATED YET</p>
                          <p className="text-xs opacity-50">The screener runs automatically. Check back later.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIPicksPage;
