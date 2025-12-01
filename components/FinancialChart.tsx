import React from "react";
import { FinancialChartContainer } from "./chart";
import { IndicatorData, TimeFrame } from "../types";

interface FinancialChartProps {
  data: IndicatorData[];
  ticker?: string;
  timeframe?: TimeFrame;
}

const FinancialChart: React.FC<FinancialChartProps> = ({ data, ticker, timeframe }) => {
  return <FinancialChartContainer data={data} ticker={ticker} timeframe={timeframe} />;
};

export default FinancialChart;
