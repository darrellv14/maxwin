import React from "react";
import {
  TrendingUp,
  Minus,
  MousePointer2,
  Type,
  Circle,
  Square,
  ArrowUp,
  ArrowDown,
  Trash2,
  Sparkles,
  Loader2,
} from "lucide-react";

export type DrawingTool =
  | "cursor"
  | "trendline"
  | "horizontal"
  | "vertical"
  | "rectangle"
  | "circle"
  | "text"
  | "arrow-up"
  | "arrow-down";

interface DrawingToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClearAll: () => void;
  onUndo?: () => void;
  onAIAutoDraw?: () => void;
  isAIDrawing?: boolean;
}

const tools: { id: DrawingTool; icon: React.ElementType; label: string }[] = [
  { id: "cursor", icon: MousePointer2, label: "Select" },
  { id: "trendline", icon: TrendingUp, label: "Trend Line" },
  { id: "horizontal", icon: Minus, label: "Horizontal Line" },
  { id: "rectangle", icon: Square, label: "Rectangle" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "text", icon: Type, label: "Text" },
  { id: "arrow-up", icon: ArrowUp, label: "Buy Marker" },
  { id: "arrow-down", icon: ArrowDown, label: "Sell Marker" },
];

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool,
  onToolChange,
  onClearAll,
  onUndo,
  onAIAutoDraw,
  isAIDrawing = false,
}) => {
  return (
    <div className="flex flex-row sm:flex-col gap-0.5 sm:gap-1 p-1 bg-terminal-darker rounded-lg border border-gray-800 overflow-x-auto sm:overflow-visible">
      {/* AI Auto-Draw Button */}
      {onAIAutoDraw && (
        <>
          <button
            onClick={onAIAutoDraw}
            disabled={isAIDrawing}
            title="AI Auto-Draw Patterns"
            className={`p-1.5 sm:p-2 rounded transition-all shrink-0 relative group ${
              isAIDrawing
                ? "bg-purple-600/50 text-purple-300 cursor-wait"
                : "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]"
            }`}
          >
            {isAIDrawing ? (
              <Loader2 size={14} className="sm:w-[18px] sm:h-[18px] animate-spin" />
            ) : (
              <Sparkles size={14} className="sm:w-[18px] sm:h-[18px]" />
            )}
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none hidden sm:block z-50">
              🤖 AI Auto-Draw
            </div>
          </button>
          <div className="border-l sm:border-t sm:border-l-0 border-gray-700 mx-0.5 sm:mx-0 sm:my-1" />
        </>
      )}

      {tools.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onToolChange(id)}
          title={label}
          className={`p-1.5 sm:p-2 rounded transition-all shrink-0 ${
            activeTool === id
              ? "bg-profit-green text-black"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
        >
          <Icon size={14} className="sm:w-[18px] sm:h-[18px]" />
        </button>
      ))}

      <div className="border-l sm:border-t sm:border-l-0 border-gray-700 mx-0.5 sm:mx-0 sm:my-1" />

      <button
        onClick={onClearAll}
        title="Clear All Drawings"
        className="p-1.5 sm:p-2 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400 transition-all shrink-0"
      >
        <Trash2 size={14} className="sm:w-[18px] sm:h-[18px]" />
      </button>
    </div>
  );
};

export default DrawingToolbar;
