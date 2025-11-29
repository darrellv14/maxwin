import React from "react";

interface ChartLegendProps {
  items: {
    color: string;
    label: string;
    value?: number | string;
    dashed?: boolean;
  }[];
}

const ChartLegend: React.FC<ChartLegendProps> = ({ items }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-mono">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1 sm:gap-1.5">
          <div
            className="w-3 sm:w-4 h-0.5"
            style={{
              backgroundColor: item.color,
              borderStyle: item.dashed ? "dashed" : "solid",
              borderWidth: item.dashed ? "1px 0 0 0" : 0,
              borderColor: item.color,
              height: item.dashed ? 0 : 2,
            }}
          />
          <span className="text-gray-400">{item.label}</span>
          {item.value !== undefined && <span className="text-white">{item.value}</span>}
        </div>
      ))}
    </div>
  );
};

export default ChartLegend;
