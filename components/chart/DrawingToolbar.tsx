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
  Move,
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
}) => {
  return (
    <div className="flex flex-row sm:flex-col gap-0.5 sm:gap-1 p-1 bg-terminal-darker rounded-lg border border-gray-800 overflow-x-auto sm:overflow-visible">
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
