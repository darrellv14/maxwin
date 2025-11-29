import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TradingViewChart, { TradingViewChartHandle } from "./TradingViewChart";
import DrawingToolbar, { DrawingTool } from "./DrawingToolbar";
import ChartTypeToggle from "./ChartTypeToggle";
import ChartControls from "./ChartControls";
import ChartLegend from "./ChartLegend";
import ChartHeader from "./ChartHeader";
import { IndicatorData } from "../../types";
import { useWatchlistStore } from "../../stores";
import { toast } from "sonner";

interface FinancialChartContainerProps {
  data: IndicatorData[];
  ticker?: string;
}

// Canvas Drawing Layer for annotations
interface DrawingObject {
  id: string;
  type: DrawingTool;
  points: { x: number; y: number }[];
  color: string;
  text?: string;
}

const FinancialChartContainer: React.FC<FinancialChartContainerProps> = ({
  data,
  ticker = "STOCK",
}) => {
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
  const [showVolume, setShowVolume] = useState(true);
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [crosshairData, setCrosshairData] = useState<{ price: number | null; time: string | null }>(
    {
      price: null,
      time: null,
    }
  );

  const [drawings, setDrawings] = useState<DrawingObject[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<DrawingObject | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [textInput, setTextInput] = useState<{ visible: boolean; x: number; y: number; value: string }>({
    visible: false,
    x: 0,
    y: 0,
    value: "",
  });

  const chartRef = useRef<TradingViewChartHandle>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  // Watchlist integration
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlistStore();
  const isWatched = isInWatchlist(ticker);

  const toggleWatchlist = () => {
    if (isWatched) {
      removeFromWatchlist(ticker);
      toast.success(`${ticker} removed from watchlist`);
    } else {
      addToWatchlist(ticker);
      toast.success(`${ticker} added to watchlist`);
    }
  };

  // Fullscreen handlers
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      if (fullscreenRef.current?.requestFullscreen) {
        fullscreenRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // ESC to exit fullscreen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  // Calculate current price info
  const lastData = data[data.length - 1];
  const prevData = data[data.length - 2];
  const currentPrice = lastData?.close ?? 0;
  const priceChange = prevData ? currentPrice - prevData.close : 0;
  const priceChangePercent = prevData ? (priceChange / prevData.close) * 100 : 0;

  // Handle crosshair move
  const handleCrosshairMove = useCallback((price: number | null, time: string | null) => {
    setCrosshairData({ price, time });
  }, []);

  // Drawing on canvas
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (activeTool === "cursor") return;

      e.preventDefault();
      e.stopPropagation();

      const coords = getCanvasCoords(e);
      console.log("Mouse down at:", coords, "Tool:", activeTool);

      const newDrawing: DrawingObject = {
        id: Date.now().toString(),
        type: activeTool,
        points: [coords],
        color:
          activeTool === "arrow-up"
            ? "#00ff9d"
            : activeTool === "arrow-down"
              ? "#ff0055"
              : "#fbbf24",
      };

      // For single-click tools, add immediately
      if (activeTool === "arrow-up" || activeTool === "arrow-down" || activeTool === "horizontal") {
        if (activeTool === "horizontal") {
          newDrawing.points = [coords, { x: coords.x + 100, y: coords.y }];
        }
        setDrawings((prev) => [...prev, newDrawing]);
      } else if (activeTool === "text") {
        // Show text input at clicked position
        setTextInput({ visible: true, x: coords.x, y: coords.y, value: "" });
      } else {
        setCurrentDrawing(newDrawing);
        setIsDrawing(true);
      }
    },
    [activeTool, getCanvasCoords]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !currentDrawing) return;

      const coords = getCanvasCoords(e);

      setCurrentDrawing((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          points: [prev.points[0], coords],
        };
      });
    },
    [isDrawing, currentDrawing, getCanvasCoords]
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (currentDrawing && currentDrawing.points.length >= 2) {
      console.log("Adding drawing:", currentDrawing);
      setDrawings((prev) => [...prev, currentDrawing]);
    }
    setIsDrawing(false);
    setCurrentDrawing(null);
  }, [currentDrawing]);

  // Render drawings on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all saved drawings
    const allDrawings = currentDrawing ? [...drawings, currentDrawing] : drawings;

    allDrawings.forEach((drawing) => {
      ctx.strokeStyle = drawing.color;
      ctx.fillStyle = drawing.color;
      ctx.lineWidth = 2;

      switch (drawing.type) {
        case "trendline":
          if (drawing.points.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
            ctx.lineTo(drawing.points[1].x, drawing.points[1].y);
            ctx.stroke();
          }
          break;

        case "horizontal":
          if (drawing.points.length >= 1) {
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(0, drawing.points[0].y);
            ctx.lineTo(canvas.width, drawing.points[0].y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          break;

        case "rectangle":
          if (drawing.points.length >= 2) {
            const [p1, p2] = drawing.points;
            ctx.globalAlpha = 0.2;
            ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
            ctx.globalAlpha = 1;
            ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
          }
          break;

        case "circle":
          if (drawing.points.length >= 2) {
            const [center, edge] = drawing.points;
            const radius = Math.sqrt(
              Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
            );
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
            ctx.globalAlpha = 0.2;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.stroke();
          }
          break;

        case "arrow-up":
        case "arrow-down":
          if (drawing.points.length >= 1) {
            const [p] = drawing.points;
            ctx.beginPath();
            if (drawing.type === "arrow-up") {
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x - 8, p.y + 12);
              ctx.lineTo(p.x + 8, p.y + 12);
            } else {
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x - 8, p.y - 12);
              ctx.lineTo(p.x + 8, p.y - 12);
            }
            ctx.closePath();
            ctx.fill();
          }
          break;

        case "text":
          if (drawing.points.length >= 1 && drawing.text) {
            const [p] = drawing.points;
            ctx.font = "14px monospace";
            ctx.fillStyle = drawing.color;
            // Draw background
            const metrics = ctx.measureText(drawing.text);
            const textHeight = 16;
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(p.x - 2, p.y - textHeight, metrics.width + 4, textHeight + 4);
            // Draw text
            ctx.fillStyle = drawing.color;
            ctx.fillText(drawing.text, p.x, p.y);
          }
          break;
      }
    });
  }, [drawings, currentDrawing, canvasSize]); // Re-render when canvas resizes

  // Resize canvas - must set actual pixel dimensions
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        // Get actual container size
        const rect = container.getBoundingClientRect();
        // Set canvas internal resolution
        canvas.width = rect.width;
        canvas.height = rect.height;
        console.log("Canvas resized to:", rect.width, rect.height);
        // Update state to trigger re-render of drawings
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    // Initial resize with delay to ensure chart is rendered
    setTimeout(resizeCanvas, 100);
    // Second resize to be sure
    setTimeout(resizeCanvas, 500);

    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [data]); // Re-run when data changes to ensure chart is ready

  const handleClearDrawings = () => {
    setDrawings([]);
    chartRef.current?.clearMarkers();
  };

  const legendItems = [
    ...(showSMA20 ? [{ color: "#fbbf24", label: "SMA 20" }] : []),
    ...(showSMA50 ? [{ color: "#3b82f6", label: "SMA 50" }] : []),
    ...(showBB ? [{ color: "#666", label: "BB", dashed: true }] : []),
  ];

  return (
    <div
      ref={fullscreenRef}
      className={`w-full space-y-1.5 sm:space-y-2 ${isFullscreen ? "fixed inset-0 z-50 bg-terminal-dark p-2 sm:p-4" : ""}`}
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <ChartHeader
          ticker={ticker}
          price={currentPrice}
          change={priceChange}
          changePercent={priceChangePercent}
          time={crosshairData.time || undefined}
        />
        <ChartTypeToggle chartType={chartType} onChartTypeChange={setChartType} />
      </div>

      {/* Controls Row */}
      <ChartControls
        showVolume={showVolume}
        showSMA20={showSMA20}
        showSMA50={showSMA50}
        showBB={showBB}
        onToggleVolume={() => setShowVolume(!showVolume)}
        onToggleSMA20={() => setShowSMA20(!showSMA20)}
        onToggleSMA50={() => setShowSMA50(!showSMA50)}
        onToggleBB={() => setShowBB(!showBB)}
        onZoomIn={() => chartRef.current?.zoomIn()}
        onZoomOut={() => chartRef.current?.zoomOut()}
        onFitContent={() => chartRef.current?.fitContent()}
        onFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        onToggleWatchlist={toggleWatchlist}
        isWatched={isWatched}
      />

      {/* Chart Area with Drawing Tools */}
      <div
        className={`flex flex-col sm:flex-row gap-1.5 sm:gap-2 ${isFullscreen ? "flex-1" : ""}`}
        style={isFullscreen ? { height: "calc(100vh - 140px)" } : {}}
      >
        {/* Drawing Toolbar */}
        <DrawingToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onClearAll={handleClearDrawings}
        />

        {/* Chart Container */}
        <div
          ref={containerRef}
          className="flex-1 relative bg-terminal-dark rounded-lg border border-gray-800 overflow-hidden min-h-[300px] sm:min-h-[400px]"
          style={{ height: isFullscreen ? "100%" : undefined }}
        >
          {/* TradingView Chart */}
          <TradingViewChart
            ref={chartRef}
            data={data}
            chartType={chartType}
            showVolume={showVolume}
            showSMA20={showSMA20}
            showSMA50={showSMA50}
            showBollingerBands={showBB}
            height={isFullscreen ? undefined : undefined}
            onCrosshairMove={handleCrosshairMove}
          />

          {/* Drawing Canvas Overlay */}
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: activeTool !== "cursor" ? "auto" : "none",
              cursor: activeTool !== "cursor" ? "crosshair" : "default",
              zIndex: activeTool !== "cursor" ? 10 : 0,
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />

          {/* Active Tool Indicator */}
          {activeTool !== "cursor" && (
            <div className="absolute top-2 right-2 bg-profit-green/90 text-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-mono font-bold z-20">
              ✏️ {activeTool.toUpperCase()}
            </div>
          )}

          {/* Crosshair Price Display */}
          {crosshairData.price && activeTool === "cursor" && (
            <div className="absolute top-2 left-2 bg-black/80 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-mono text-white">
              {crosshairData.price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          )}

          {/* Drawing Count */}
          {drawings.length > 0 && (
            <div className="absolute bottom-2 left-2 bg-black/80 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-mono text-gray-400">
              📐 {drawings.length}
            </div>
          )}

          {/* Text Input Overlay */}
          {textInput.visible && (
            <div
              className="absolute z-30"
              style={{ left: textInput.x, top: textInput.y - 30 }}
            >
              <input
                type="text"
                autoFocus
                value={textInput.value}
                onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && textInput.value.trim()) {
                    const newTextDrawing: DrawingObject = {
                      id: Date.now().toString(),
                      type: "text",
                      points: [{ x: textInput.x, y: textInput.y }],
                      color: "#fbbf24",
                      text: textInput.value.trim(),
                    };
                    setDrawings((prev) => [...prev, newTextDrawing]);
                    setTextInput({ visible: false, x: 0, y: 0, value: "" });
                  } else if (e.key === "Escape") {
                    setTextInput({ visible: false, x: 0, y: 0, value: "" });
                  }
                }}
                onBlur={() => {
                  if (textInput.value.trim()) {
                    const newTextDrawing: DrawingObject = {
                      id: Date.now().toString(),
                      type: "text",
                      points: [{ x: textInput.x, y: textInput.y }],
                      color: "#fbbf24",
                      text: textInput.value.trim(),
                    };
                    setDrawings((prev) => [...prev, newTextDrawing]);
                  }
                  setTextInput({ visible: false, x: 0, y: 0, value: "" });
                }}
                placeholder="Enter text..."
                className="bg-terminal-darker border border-profit-green text-white px-2 py-1 text-sm font-mono rounded outline-none min-w-[150px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      {legendItems.length > 0 && (
        <div className="pl-0 sm:pl-12">
          <ChartLegend items={legendItems} />
        </div>
      )}

      {/* Drawing Tools Help */}
      {activeTool !== "cursor" && (
        <div className="text-[10px] sm:text-xs text-gray-500 font-mono pl-0 sm:pl-12">
          📝 <span className="text-profit-green">{activeTool.toUpperCase()}</span> — Click and drag
        </div>
      )}
    </div>
  );
};

export default FinancialChartContainer;
