import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TradingViewChart, { TradingViewChartHandle } from "./TradingViewChart";
import DrawingToolbar, { DrawingTool } from "./DrawingToolbar";
import ChartTypeToggle from "./ChartTypeToggle";
import ChartControls from "./ChartControls";
import ChartLegend from "./ChartLegend";
import ChartHeader from "./ChartHeader";
import { IndicatorData, TimeFrame } from "../../types";
import { useWatchlistStore } from "../../stores";
import { toast } from "sonner";
import { Sparkles, TrendingUp, TrendingDown, BarChart2, AlertTriangle, Clock, Volume2, Zap } from "lucide-react";
import { 
  detectPatterns, 
  detectPatternsWithAI,
  generateDrawInstructions, 
  DetectedPattern, 
  DrawInstruction,
  AIPatternAnalysis 
} from "../../services/patternDetectionService";

interface FinancialChartContainerProps {
  data: IndicatorData[];
  ticker?: string;
  timeframe?: TimeFrame;
}

// Canvas Drawing Layer for annotations
interface DrawingObject {
  id: string;
  type: DrawingTool | "ai-pattern";
  points: { x: number; y: number }[];
  color: string;
  text?: string;
  aiInstructions?: DrawInstruction[];
}

// Timeframe recommendations for pattern detection
const TIMEFRAME_INFO: Record<TimeFrame, { 
  label: string; 
  patternQuality: "excellent" | "good" | "fair" | "poor";
  description: string;
  minDataPoints: number;
}> = {
  "1D": { label: "1 Day", patternQuality: "poor", description: "Too short for reliable patterns", minDataPoints: 30 },
  "5D": { label: "5 Days", patternQuality: "fair", description: "Short-term scalping patterns only", minDataPoints: 30 },
  "1M": { label: "1 Month", patternQuality: "good", description: "Good for swing trading patterns", minDataPoints: 20 },
  "3M": { label: "3 Months", patternQuality: "excellent", description: "Optimal for most chart patterns", minDataPoints: 60 },
  "6M": { label: "6 Months", patternQuality: "excellent", description: "Excellent for major patterns", minDataPoints: 120 },
  "YTD": { label: "Year to Date", patternQuality: "good", description: "Good pattern visibility", minDataPoints: 50 },
  "1Y": { label: "1 Year", patternQuality: "excellent", description: "Perfect for major trend patterns", minDataPoints: 250 },
  "5Y": { label: "5 Years", patternQuality: "good", description: "Long-term position patterns", minDataPoints: 500 },
  "ALL": { label: "All Time", patternQuality: "fair", description: "May include outdated patterns", minDataPoints: 100 },
};

const FinancialChartContainer: React.FC<FinancialChartContainerProps> = ({
  data,
  ticker = "STOCK",
  timeframe = "3M",
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
  
  // AI Auto-Draw state
  const [isAIDrawing, setIsAIDrawing] = useState(false);
  const [detectedPatterns, setDetectedPatterns] = useState<DetectedPattern[]>([]);
  const [aiDrawInstructions, setAiDrawInstructions] = useState<DrawInstruction[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIPatternAnalysis | null>(null);

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

  // Get current timeframe info
  const currentTimeframeInfo = TIMEFRAME_INFO[timeframe];

  // Calculate price range for AI drawing
  const priceRange = React.useMemo(() => {
    if (data.length === 0) return { min: 0, max: 100 };
    const prices = data.flatMap(d => [d.high, d.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    return { min: min - padding, max: max + padding };
  }, [data]);

  // AI Auto-Draw handler
  const handleAIAutoDraw = useCallback(async () => {
    const tfInfo = TIMEFRAME_INFO[timeframe];
    
    if (data.length < tfInfo.minDataPoints) {
      toast.error(`Need at least ${tfInfo.minDataPoints} data points for ${tfInfo.label} timeframe. Currently have ${data.length}.`);
      return;
    }

    // Warn if timeframe is not optimal
    if (tfInfo.patternQuality === "poor" || tfInfo.patternQuality === "fair") {
      toast.warning(`⚠️ ${tfInfo.label} timeframe: ${tfInfo.description}. Consider using 3M-1Y for better patterns.`, { duration: 4000 });
    }

    setIsAIDrawing(true);
    toast.loading(`🤖 AI scanning ${tfInfo.label} chart for patterns...`, { id: "ai-draw" });

    try {
      // Step 1: Detect patterns algorithmically
      toast.loading("🔍 Detecting technical patterns...", { id: "ai-draw" });
      await new Promise(resolve => setTimeout(resolve, 300));

      // Use AI-enhanced detection with Gemini validation
      toast.loading("🧠 MooCuan AI validating patterns...", { id: "ai-draw" });
      const { patterns, aiAnalysis: analysis } = await detectPatternsWithAI(data, ticker, true);
      
      setDetectedPatterns(patterns);
      setAiAnalysis(analysis);

      if (patterns.length === 0) {
        toast.info("No clear patterns detected in current timeframe", { id: "ai-draw" });
        setIsAIDrawing(false);
        return;
      }

      // Generate drawing instructions for all patterns
      const allInstructions: DrawInstruction[] = [];
      patterns.forEach(pattern => {
        const instructions = generateDrawInstructions(
          pattern,
          data,
          canvasSize.width,
          canvasSize.height,
          priceRange
        );
        allInstructions.push(...instructions);
      });

      setAiDrawInstructions(allInstructions);

      // Create summary message with AI insights
      const mainPattern = patterns[0];
      const confidence = mainPattern.aiConfidence || mainPattern.confidence;
      const direction = mainPattern.direction === "bullish" ? "📈" : mainPattern.direction === "bearish" ? "📉" : "➡️";
      const aiIndicator = mainPattern.aiValidated ? "🤖 AI Verified: " : "";
      
      let message = `${direction} ${aiIndicator}${mainPattern.name} (${confidence}%)`;
      if (analysis?.primarySignal) {
        message += ` | Signal: ${analysis.primarySignal}`;
      }
      message += ` | Target: ${mainPattern.targetPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

      toast.success(message, { id: "ai-draw", duration: 6000 });

      // Show warnings if any
      if (analysis?.warnings && analysis.warnings.length > 0) {
        setTimeout(() => {
          toast.warning(`⚠️ ${analysis.warnings[0]}`, { duration: 4000 });
        }, 1000);
      }

    } catch (error) {
      console.error("AI Auto-Draw error:", error);
      toast.error("Failed to analyze patterns", { id: "ai-draw" });
    } finally {
      setIsAIDrawing(false);
    }
  }, [data, ticker, canvasSize, priceRange, timeframe]);

  // Handle crosshair move
  const handleCrosshairMove = useCallback((price: number | null, time: string | null) => {
    setCrosshairData({ price, time });
  }, []);

  // Drawing on canvas
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Handle both mouse and touch events
    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      // Mouse event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
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

  // Touch event handlers for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (activeTool === "cursor") return;

      e.preventDefault();
      e.stopPropagation();

      const coords = getCanvasCoords(e);
      console.log("Touch start at:", coords, "Tool:", activeTool);

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

      // For single-tap tools, add immediately
      if (activeTool === "arrow-up" || activeTool === "arrow-down" || activeTool === "horizontal") {
        if (activeTool === "horizontal") {
          newDrawing.points = [coords, { x: coords.x + 100, y: coords.y }];
        }
        setDrawings((prev) => [...prev, newDrawing]);
      } else if (activeTool === "text") {
        // Show text input at tapped position
        setTextInput({ visible: true, x: coords.x, y: coords.y, value: "" });
      } else {
        setCurrentDrawing(newDrawing);
        setIsDrawing(true);
      }
    },
    [activeTool, getCanvasCoords]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !currentDrawing) return;

      e.preventDefault();
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

  const handleTouchEnd = useCallback(() => {
    if (currentDrawing && currentDrawing.points.length >= 2) {
      console.log("Touch end - Adding drawing:", currentDrawing);
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

    // Draw AI pattern instructions first (so user drawings appear on top)
    // Draw AI pattern instructions - professional clean style
    aiDrawInstructions.forEach((instruction) => {
      ctx.strokeStyle = instruction.color;
      ctx.fillStyle = instruction.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);

      switch (instruction.type) {
        case "line":
          if (instruction.points.length >= 2) {
            ctx.beginPath();
            ctx.lineWidth = 1.5;
            ctx.moveTo(instruction.points[0].x, instruction.points[0].y);
            for (let i = 1; i < instruction.points.length; i++) {
              ctx.lineTo(instruction.points[i].x, instruction.points[i].y);
            }
            ctx.stroke();
          }
          break;

        case "dashed-line":
          if (instruction.points.length >= 2) {
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 3]);
            ctx.moveTo(instruction.points[0].x, instruction.points[0].y);
            for (let i = 1; i < instruction.points.length; i++) {
              ctx.lineTo(instruction.points[i].x, instruction.points[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw label if exists - clean style
            if (instruction.label) {
              const midPoint = instruction.points[Math.floor(instruction.points.length / 2)];
              ctx.font = "10px monospace";
              ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
              const metrics = ctx.measureText(instruction.label);
              ctx.fillRect(midPoint.x - 2, midPoint.y - 10, metrics.width + 4, 12);
              ctx.fillStyle = instruction.color;
              ctx.fillText(instruction.label, midPoint.x, midPoint.y - 1);
            }
          }
          break;

        case "target-line":
          if (instruction.points.length >= 2) {
            const [start, end] = instruction.points;
            const isUp = end.y < start.y;
            
            // Draw vertical line - clean professional style
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = instruction.color;
            ctx.lineWidth = 1.5;
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw small arrow head
            ctx.beginPath();
            ctx.fillStyle = instruction.color;
            if (isUp) {
              ctx.moveTo(end.x, end.y);
              ctx.lineTo(end.x - 5, end.y + 8);
              ctx.lineTo(end.x + 5, end.y + 8);
            } else {
              ctx.moveTo(end.x, end.y);
              ctx.lineTo(end.x - 5, end.y - 8);
              ctx.lineTo(end.x + 5, end.y - 8);
            }
            ctx.closePath();
            ctx.fill();
            
            // Draw target label - clean professional style without glow
            if (instruction.label) {
              ctx.font = "11px monospace";
              const metrics = ctx.measureText(instruction.label);
              const labelX = end.x - metrics.width / 2;
              const labelY = isUp ? end.y - 14 : end.y + 22;
              
              // Simple background
              ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
              ctx.fillRect(labelX - 4, labelY - 10, metrics.width + 8, 14);
              ctx.strokeStyle = instruction.color;
              ctx.lineWidth = 1;
              ctx.strokeRect(labelX - 4, labelY - 10, metrics.width + 8, 14);
              
              // Text without glow
              ctx.fillStyle = instruction.color;
              ctx.fillText(instruction.label, labelX, labelY);
            }
          }
          break;

        case "zone":
          if (instruction.points.length >= 3 && instruction.fill) {
            // Fill zone with subtle transparency
            ctx.beginPath();
            ctx.globalAlpha = 0.08;
            ctx.moveTo(instruction.points[0].x, instruction.points[0].y);
            for (let i = 1; i < instruction.points.length; i++) {
              ctx.lineTo(instruction.points[i].x, instruction.points[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
            
            // Draw clean border
            ctx.beginPath();
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 1;
            ctx.moveTo(instruction.points[0].x, instruction.points[0].y);
            for (let i = 1; i < instruction.points.length; i++) {
              ctx.lineTo(instruction.points[i].x, instruction.points[i].y);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          break;

        case "text":
          if (instruction.points.length >= 1 && instruction.label) {
            const [p] = instruction.points;
            ctx.font = "11px monospace";
            const metrics = ctx.measureText(instruction.label);
            
            // Clean professional background
            ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
            ctx.fillRect(p.x - 3, p.y - 11, metrics.width + 6, 14);
            ctx.strokeStyle = instruction.color;
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x - 3, p.y - 11, metrics.width + 6, 14);
            
            // Text without glow
            ctx.fillStyle = instruction.color;
            ctx.fillText(instruction.label, p.x, p.y);
          }
          break;

        case "arrow":
          if (instruction.points.length >= 1) {
            const [p] = instruction.points;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - 6, p.y + 10);
            ctx.lineTo(p.x + 6, p.y + 10);
            ctx.closePath();
            ctx.fill();
          }
          break;
      }
    });

    // Draw all user drawings
    const allDrawings = currentDrawing ? [...drawings, currentDrawing] : drawings;

    allDrawings.forEach((drawing) => {
      ctx.strokeStyle = drawing.color;
      ctx.fillStyle = drawing.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

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
  }, [drawings, currentDrawing, canvasSize, aiDrawInstructions]); // Re-render when canvas resizes or AI draws

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
    setAiDrawInstructions([]);
    setDetectedPatterns([]);
    setAiAnalysis(null);
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
          onAIAutoDraw={handleAIAutoDraw}
          isAIDrawing={isAIDrawing}
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
              touchAction: activeTool !== "cursor" ? "none" : "auto", // Prevent scroll when drawing
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
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

      {/* AI Detected Patterns Info */}
      {detectedPatterns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pl-0 mt-2"
        >
          <div className="bg-terminal-dark border border-gray-800 rounded-lg p-4 sm:p-6 relative overflow-hidden">
            {/* Background decoration - like OraclePanel */}
            <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-purple-900 opacity-10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header with AI Analysis Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 sm:mb-6 z-10 relative">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold font-mono text-white flex items-center">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 mr-1.5 sm:mr-2" />
                  AI PATTERN ANALYSIS
                </h2>
                <span className="text-xs text-gray-500 font-mono">({detectedPatterns.length} detected)</span>
                {/* Timeframe Badge */}
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                  currentTimeframeInfo.patternQuality === "excellent" 
                    ? "bg-profit-green/20 text-profit-green border border-profit-green/30"
                    : currentTimeframeInfo.patternQuality === "good"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : currentTimeframeInfo.patternQuality === "fair"
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                        : "bg-loss-red/20 text-loss-red border border-loss-red/30"
                }`}>
                  <Clock className="w-3 h-3" />
                  {currentTimeframeInfo.label}
                  {currentTimeframeInfo.patternQuality === "excellent" && " ★"}
                </span>
              </div>
              {aiAnalysis?.primarySignal && (
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xl sm:text-2xl font-bold tracking-tighter ${
                      aiAnalysis.primarySignal === "BUY"
                        ? "text-profit-green drop-shadow-[0_0_10px_rgba(0,255,157,0.5)]"
                        : aiAnalysis.primarySignal === "SELL"
                          ? "text-loss-red drop-shadow-[0_0_10px_rgba(255,0,85,0.5)]"
                          : "text-yellow-400"
                    }`}
                  >
                    {aiAnalysis.primarySignal}
                  </span>
                  <span className="text-sm font-mono text-gray-400">{aiAnalysis.primaryConfidence}%</span>
                </div>
              )}
            </div>

            {/* Timeframe Quality Info */}
            {(currentTimeframeInfo.patternQuality === "poor" || currentTimeframeInfo.patternQuality === "fair") && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 sm:p-3 mb-4 z-10 relative">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs text-yellow-500 font-mono font-bold">TIMEFRAME NOTICE</div>
                    <p className="text-[10px] sm:text-xs text-yellow-400/80 mt-1">
                      {currentTimeframeInfo.description}. For more reliable patterns, use <span className="font-bold">3M, 6M, or 1Y</span> timeframe.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Overall Analysis */}
            {aiAnalysis?.overallAnalysis && (
              <div className="bg-gray-900/50 p-3 sm:p-4 rounded border border-gray-700/50 mb-4 z-10 relative">
                <div className="text-[10px] sm:text-xs text-gray-500 font-mono uppercase mb-1">MOOCUAN AI ANALYSIS</div>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                  {aiAnalysis.overallAnalysis}
                </p>
                {aiAnalysis.bestPattern && (
                  <div className="mt-2 pt-2 border-t border-gray-700/50 flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500 font-mono">BEST PATTERN</span>
                    <span className="text-xs sm:text-sm font-bold text-purple-400">{aiAnalysis.bestPattern}</span>
                  </div>
                )}
              </div>
            )}

            {/* Volume Verdict Panel */}
            {aiAnalysis?.volumeVerdict && (
              <div className="bg-gray-900/50 p-3 sm:p-4 rounded border border-blue-500/30 mb-4 z-10 relative">
                <div className="text-[10px] sm:text-xs text-blue-400 font-mono font-bold mb-2 uppercase flex items-center gap-1">
                  <Volume2 className="w-3 h-3" />
                  VOLUME ANALYSIS
                </div>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                  {aiAnalysis.volumeVerdict}
                </p>
              </div>
            )}

            {/* Pattern Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 z-10 relative">
              {detectedPatterns.map((pattern, idx) => (
                <div
                  key={idx}
                  className="bg-terminal-gray border border-gray-800 p-3 sm:p-4 rounded-lg shadow-lg"
                >
                  {/* Pattern Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {pattern.aiValidated && <Sparkles className="w-3 h-3 text-purple-400" />}
                      {pattern.direction === "bullish" ? (
                        <TrendingUp className="w-4 h-4 text-profit-green" />
                      ) : pattern.direction === "bearish" ? (
                        <TrendingDown className="w-4 h-4 text-loss-red" />
                      ) : (
                        <BarChart2 className="w-4 h-4 text-yellow-400" />
                      )}
                      <span className={`text-xs sm:text-sm font-bold ${
                        pattern.direction === "bullish" ? "text-profit-green" : pattern.direction === "bearish" ? "text-loss-red" : "text-yellow-400"
                      }`}>
                        {pattern.name}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white font-mono">
                      {pattern.aiConfidence || pattern.confidence}%
                    </span>
                  </div>
                  
                  {/* AI Reasoning */}
                  {pattern.aiReasoning && (
                    <div className="text-[10px] sm:text-xs text-gray-400 font-mono mb-2 italic border-l-2 border-purple-500/50 pl-2">
                      {pattern.aiReasoning}
                    </div>
                  )}
                  
                  {/* Trade Recommendation Badge */}
                  {pattern.tradeRecommendation && (
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-lg sm:text-xl font-bold tracking-tighter ${
                          pattern.tradeRecommendation === "BUY"
                            ? "text-profit-green drop-shadow-[0_0_8px_rgba(0,255,157,0.4)]"
                            : pattern.tradeRecommendation === "SELL"
                              ? "text-loss-red drop-shadow-[0_0_8px_rgba(255,0,85,0.4)]"
                              : "text-yellow-400"
                        }`}
                      >
                        {pattern.tradeRecommendation}
                      </span>
                      {pattern.riskRewardRatio && (
                        <span className="text-[10px] sm:text-xs text-gray-500 font-mono">R:R {pattern.riskRewardRatio}</span>
                      )}
                    </div>
                  )}

                  {/* Volume Confirmation Badge */}
                  {pattern.volumeConfirmation && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${
                        pattern.volumeConfirmation === "CONFIRMED" 
                          ? "bg-profit-green/20 text-profit-green border border-profit-green/30" 
                          : pattern.volumeConfirmation === "WEAK"
                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                            : "bg-loss-red/20 text-loss-red border border-loss-red/30"
                      }`}>
                        <Volume2 className="w-3 h-3" />
                        <span>VOL: {pattern.volumeConfirmation}</span>
                      </div>
                      {pattern.breakoutLikelihood && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${
                          pattern.breakoutLikelihood === "HIGH" 
                            ? "bg-profit-green/20 text-profit-green border border-profit-green/30" 
                            : pattern.breakoutLikelihood === "MEDIUM"
                              ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                              : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                        }`}>
                          <Zap className="w-3 h-3" />
                          <span>BRK: {pattern.breakoutLikelihood}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Target & Stop Loss Grid - like OraclePanel trade plan */}
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    <div className="bg-gray-900/50 p-1.5 sm:p-2 rounded border border-gray-700/50">
                      <div className="text-[10px] text-gray-500 font-mono">TARGET</div>
                      <div className={`text-xs sm:text-sm font-bold truncate ${pattern.targetDirection === "up" ? "text-profit-green" : "text-loss-red"}`}>
                        {pattern.targetPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 p-1.5 sm:p-2 rounded border border-gray-700/50">
                      <div className="text-[10px] text-gray-500 font-mono">STOP LOSS</div>
                      <div className="text-xs sm:text-sm font-bold text-loss-red truncate">
                        {pattern.stopLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Warnings */}
            {aiAnalysis?.warnings && aiAnalysis.warnings.length > 0 && (
              <div className="mt-4 bg-gray-900/50 p-3 sm:p-4 rounded border border-yellow-500/30 z-10 relative">
                <div className="text-[10px] sm:text-xs text-yellow-500 font-mono font-bold mb-2 uppercase flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  WARNINGS
                </div>
                <ul className="text-[10px] sm:text-xs text-gray-400 space-y-1">
                  {aiAnalysis.warnings.map((warning, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-yellow-500">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Drawing Tools Help */}
      {activeTool !== "cursor" && (
        <div className="text-[10px] sm:text-xs text-gray-500 font-mono pl-0 sm:pl-12">
          📝 <span className="text-profit-green">{activeTool.toUpperCase()}</span> — <span className="hidden sm:inline">Click and drag</span><span className="sm:hidden">Tap and drag</span>
        </div>
      )}
    </div>
  );
};

export default FinancialChartContainer;
