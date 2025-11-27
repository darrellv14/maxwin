import React, { useEffect, useState } from 'react';
import { getAnalysisHistory, AnalysisRecord } from '../services/analysisService';
import { Link } from 'react-router-dom';

const History: React.FC = () => {
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getAnalysisHistory();
        setHistory(data);
      } catch (error) {
        console.error("Failed to load history", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const getStatusColor = (status: string) => {
    if (status.includes("TP")) return "text-profit-green";
    if (status.includes("SL")) return "text-loss-red";
    return "text-yellow-500";
  };

  return (
    <div className="min-h-screen bg-terminal-black text-gray-200 font-sans p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold font-mono text-white">
            ANALYSIS <span className="text-profit-green">HISTORY</span>
          </h1>
          <Link to="/" className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded border border-gray-700 font-mono text-sm">
            ← BACK TO TERMINAL
          </Link>
        </div>

        <div className="bg-terminal-gray border border-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center font-mono text-gray-500 animate-pulse">
              LOADING HISTORY DATA...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono">
                <thead className="bg-gray-900 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="p-4">DATE</th>
                    <th className="p-4">TICKER</th>
                    <th className="p-4">SIGNAL</th>
                    <th className="p-4">ENTRY</th>
                    <th className="p-4">TP1 / TP2</th>
                    <th className="p-4">STOP LOSS</th>
                    <th className="p-4">HIGH / LOW (SINCE)</th>
                    <th className="p-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {history.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="p-4 text-gray-500">
                        {new Date(record.date_created).toLocaleDateString()} <br/>
                        <span className="text-xs">{new Date(record.date_created).toLocaleTimeString()}</span>
                      </td>
                      <td className="p-4 font-bold text-white">{record.ticker}</td>
                      <td className={`p-4 font-bold ${record.signal === 'BUY' ? 'text-profit-green' : 'text-loss-red'}`}>
                        {record.signal}
                      </td>
                      <td className="p-4">{record.entry_price.toLocaleString()}</td>
                      <td className="p-4">
                        <div className="text-profit-green">{record.tp1.toLocaleString()}</div>
                        <div className="text-green-300 text-xs">{record.tp2.toLocaleString()}</div>
                      </td>
                      <td className="p-4 text-loss-red">{record.stop_loss.toLocaleString()}</td>
                      <td className="p-4">
                        <div className="text-green-400">H: {record.highest_price.toLocaleString()}</div>
                        <div className="text-red-400">L: {record.lowest_price.toLocaleString()}</div>
                      </td>
                      <td className={`p-4 font-bold ${getStatusColor(record.status)}`}>
                        {record.status}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
                        NO ANALYSIS HISTORY FOUND
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

export default History;
