import React from "react";
import { Settings, ZoomIn, ZoomOut, Maximize2, Minimize2, Star } from "lucide-react";

interface ChartControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitContent?: () => void;
  onSettings?: () => void;
  onFullscreen?: () => void;
  onToggleWatchlist?: () => void;
  isFullscreen?: boolean;
  isWatched?: boolean;
  showVolume: boolean;
  showSMA20: boolean;
  showSMA50: boolean;
  showBB: boolean;
  onToggleVolume: () => void;
  onToggleSMA20: () => void;
  onToggleSMA50: () => void;
  onToggleBB: () => void;
}

const ChartControls: React.FC<ChartControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitContent,
  onSettings,
  onFullscreen,
  onToggleWatchlist,
  isFullscreen = false,
  isWatched = false,
  showVolume,
  showSMA20,
  showSMA50,
  showBB,
  onToggleVolume,
  onToggleSMA20,
  onToggleSMA50,
  onToggleBB,
}) => {
  const IndicatorButton = ({
    active,
    label,
    color,
    onClick,
  }: {
    active: boolean;
    label: string;
    color: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-mono rounded border transition-all ${
        active
          ? "border-gray-600 text-white"
          : "border-gray-800 text-gray-600 hover:border-gray-700"
      }`}
    >
      <span
        className="inline-block w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full mr-1 sm:mr-1.5"
        style={{ backgroundColor: active ? color : "#444" }}
      />
      <span className="hidden xs:inline">{label}</span>
      <span className="xs:hidden">{label.substring(0, 3)}</span>
    </button>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
      {/* Indicator Toggles */}
      <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
        <IndicatorButton active={showVolume} label="VOL" color="#3b82f6" onClick={onToggleVolume} />
        <IndicatorButton active={showSMA20} label="SMA20" color="#fbbf24" onClick={onToggleSMA20} />
        <IndicatorButton active={showSMA50} label="SMA50" color="#3b82f6" onClick={onToggleSMA50} />
        <IndicatorButton active={showBB} label="BB" color="#666" onClick={onToggleBB} />
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {onToggleWatchlist && (
          <button
            onClick={onToggleWatchlist}
            className={`p-1 sm:p-1.5 rounded transition-colors ${
              isWatched
                ? "text-yellow-500 hover:text-yellow-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
            title={isWatched ? "Remove from Watchlist" : "Add to Watchlist"}
          >
            <Star size={14} className="sm:w-4 sm:h-4" fill={isWatched ? "currentColor" : "none"} />
          </button>
        )}
        <button
          onClick={onZoomOut}
          className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={14} className="sm:w-4 sm:h-4" />
        </button>
        <button
          onClick={onZoomIn}
          className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={14} className="sm:w-4 sm:h-4" />
        </button>
        <button
          onClick={onFitContent}
          className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors hidden sm:block"
          title="Fit Content"
        >
          <Maximize2 size={14} className="sm:w-4 sm:h-4" />
        </button>
        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} className="sm:w-4 sm:h-4" /> : <Maximize2 size={14} className="sm:w-4 sm:h-4" />}
          </button>
        )}
        {onSettings && (
          <button
            onClick={onSettings}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors hidden sm:block"
            title="Settings"
          >
            <Settings size={14} className="sm:w-4 sm:h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChartControls;
