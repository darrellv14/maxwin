import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  createChart,
  IChartApi,
  ColorType,
  LineSeries,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  createSeriesMarkers,
} from "lightweight-charts";
import { IndicatorData } from "../../types";

export interface ChartMarker {
  time: string;
  position: "aboveBar" | "belowBar" | "inBar";
  color: string;
  shape: "circle" | "square" | "arrowUp" | "arrowDown";
  text: string;
}

export interface TradingViewChartHandle {
  chart: IChartApi | null;
  addMarker: (marker: ChartMarker) => void;
  clearMarkers: () => void;
  fitContent: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface TradingViewChartProps {
  data: IndicatorData[];
  chartType: "candlestick" | "line";
  showVolume?: boolean;
  showSMA20?: boolean;
  showSMA50?: boolean;
  showBollingerBands?: boolean;
  height?: number;
  onCrosshairMove?: (price: number | null, time: string | null) => void;
}

const TradingViewChart = forwardRef<TradingViewChartHandle, TradingViewChartProps>(
  (
    {
      data,
      chartType,
      showVolume = true,
      showSMA20 = true,
      showSMA50 = true,
      showBollingerBands = true,
      height = 500,
      onCrosshairMove,
    },
    ref
  ) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<{
      candle: any;
      line: any;
      volume: any;
      sma20: any;
      sma50: any;
      bbUpper: any;
      bbLower: any;
    }>({
      candle: null,
      line: null,
      volume: null,
      sma20: null,
      sma50: null,
      bbUpper: null,
      bbLower: null,
    });
    const markersRef = useRef<ChartMarker[]>([]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      chart: chartRef.current,
      addMarker: (marker: ChartMarker) => {
        markersRef.current.push(marker);
        updateMarkers();
      },
      clearMarkers: () => {
        markersRef.current = [];
        updateMarkers();
      },
      fitContent: () => {
        chartRef.current?.timeScale().fitContent();
      },
      zoomIn: () => {
        const timeScale = chartRef.current?.timeScale();
        if (timeScale) {
          const visibleRange = timeScale.getVisibleLogicalRange();
          if (visibleRange) {
            const rangeSize = visibleRange.to - visibleRange.from;
            const center = (visibleRange.from + visibleRange.to) / 2;
            const newRangeSize = rangeSize * 0.7; // Zoom in by 30%
            timeScale.setVisibleLogicalRange({
              from: center - newRangeSize / 2,
              to: center + newRangeSize / 2,
            });
          }
        }
      },
      zoomOut: () => {
        const timeScale = chartRef.current?.timeScale();
        if (timeScale) {
          const visibleRange = timeScale.getVisibleLogicalRange();
          if (visibleRange) {
            const rangeSize = visibleRange.to - visibleRange.from;
            const center = (visibleRange.from + visibleRange.to) / 2;
            const newRangeSize = rangeSize * 1.4; // Zoom out by 40%
            timeScale.setVisibleLogicalRange({
              from: center - newRangeSize / 2,
              to: center + newRangeSize / 2,
            });
          }
        }
      },
    }));

    const updateMarkers = useCallback(() => {
      const series =
        chartType === "candlestick" ? seriesRef.current.candle : seriesRef.current.line;
      if (series && markersRef.current.length > 0) {
        createSeriesMarkers(series, markersRef.current as any);
      }
    }, [chartType]);

    // Transform data
    const transformData = useCallback(() => {
      const candleData: any[] = [];
      const lineData: any[] = [];
      const volumeData: any[] = [];
      const sma20Data: any[] = [];
      const sma50Data: any[] = [];
      const bbUpperData: any[] = [];
      const bbLowerData: any[] = [];

      data.forEach((d) => {
        const time = d.date;
        const isUp = d.close >= d.open;

        candleData.push({
          time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        });

        lineData.push({ time, value: d.close });

        volumeData.push({
          time,
          value: d.volume,
          color: isUp ? "rgba(0, 255, 157, 0.4)" : "rgba(255, 0, 85, 0.4)",
        });

        if (d.sma20 != null) sma20Data.push({ time, value: d.sma20 });
        if (d.sma50 != null) sma50Data.push({ time, value: d.sma50 });
        if (d.bbUpper != null) bbUpperData.push({ time, value: d.bbUpper });
        if (d.bbLower != null) bbLowerData.push({ time, value: d.bbLower });
      });

      return { candleData, lineData, volumeData, sma20Data, sma50Data, bbUpperData, bbLowerData };
    }, [data]);

    // Initialize chart
    useEffect(() => {
      if (!chartContainerRef.current || data.length === 0) return;

      // Clear previous chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#666",
        },
        grid: {
          vertLines: { color: "rgba(42, 46, 57, 0.5)" },
          horzLines: { color: "rgba(42, 46, 57, 0.5)" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: "#758696",
            width: 1,
            style: 2,
            labelBackgroundColor: "#2B2B43",
          },
          horzLine: {
            color: "#758696",
            width: 1,
            style: 2,
            labelBackgroundColor: "#2B2B43",
          },
        },
        rightPriceScale: {
          borderColor: "#2B2B43",
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
        timeScale: {
          borderColor: "#2B2B43",
          timeVisible: true,
          secondsVisible: false,
        },
        handleScale: { axisPressedMouseMove: true },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
      });

      chartRef.current = chart;

      const { candleData, lineData, volumeData, sma20Data, sma50Data, bbUpperData, bbLowerData } =
        transformData();

      // Volume (behind everything)
      if (showVolume) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "",
        });
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        });
        volumeSeries.setData(volumeData);
        seriesRef.current.volume = volumeSeries;
      }

      // Bollinger Bands
      if (showBollingerBands) {
        const bbUpperSeries = chart.addSeries(LineSeries, {
          color: "rgba(100, 100, 100, 0.5)",
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        bbUpperSeries.setData(bbUpperData);
        seriesRef.current.bbUpper = bbUpperSeries;

        const bbLowerSeries = chart.addSeries(LineSeries, {
          color: "rgba(100, 100, 100, 0.5)",
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        bbLowerSeries.setData(bbLowerData);
        seriesRef.current.bbLower = bbLowerSeries;
      }

      // SMA 20
      if (showSMA20) {
        const sma20Series = chart.addSeries(LineSeries, {
          color: "#fbbf24",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        sma20Series.setData(sma20Data);
        seriesRef.current.sma20 = sma20Series;
      }

      // SMA 50
      if (showSMA50) {
        const sma50Series = chart.addSeries(LineSeries, {
          color: "#3b82f6",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        sma50Series.setData(sma50Data);
        seriesRef.current.sma50 = sma50Series;
      }

      // Candlestick Series
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#00ff9d",
        downColor: "#ff0055",
        borderUpColor: "#00ff9d",
        borderDownColor: "#ff0055",
        wickUpColor: "#00ff9d",
        wickDownColor: "#ff0055",
      });
      candleSeries.setData(candleData);
      seriesRef.current.candle = candleSeries;

      // Line Series
      const lineSeries = chart.addSeries(LineSeries, {
        color: "#00ff9d",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
      });
      lineSeries.setData(lineData);
      seriesRef.current.line = lineSeries;

      // Set visibility based on chartType
      candleSeries.applyOptions({ visible: chartType === "candlestick" });
      lineSeries.applyOptions({ visible: chartType === "line" });

      // Crosshair move handler
      if (onCrosshairMove) {
        chart.subscribeCrosshairMove((param) => {
          if (!param.time || !param.point) {
            onCrosshairMove(null, null);
            return;
          }
          const series = chartType === "candlestick" ? candleSeries : lineSeries;
          const data = param.seriesData.get(series) as any;
          if (data) {
            const price = data.close ?? data.value;
            onCrosshairMove(price, String(param.time));
          }
        });
      }

      chart.timeScale().fitContent();

      // Resize handler
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    }, [
      data,
      showVolume,
      showSMA20,
      showSMA50,
      showBollingerBands,
      height,
      transformData,
      onCrosshairMove,
    ]);

    // Toggle chart type
    useEffect(() => {
      if (seriesRef.current.candle && seriesRef.current.line) {
        seriesRef.current.candle.applyOptions({ visible: chartType === "candlestick" });
        seriesRef.current.line.applyOptions({ visible: chartType === "line" });
      }
    }, [chartType]);

    return (
      <div
        ref={chartContainerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ height }}
      />
    );
  }
);

TradingViewChart.displayName = "TradingViewChart";

export default TradingViewChart;
