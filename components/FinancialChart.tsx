import React from "react";
import { FinancialChartContainer } from "./chart";
import { IndicatorData } from "../types";

interface FinancialChartProps {
  data: IndicatorData[];
  ticker?: string;
}

const FinancialChart: React.FC<FinancialChartProps> = ({ data, ticker }) => {
  return <FinancialChartContainer data={data} ticker={ticker} />;
};

export default FinancialChart;
