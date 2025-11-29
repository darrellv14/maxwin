import React from "react";
import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => (
  <motion.div
    className={`bg-gray-800 rounded animate-pulse ${className}`}
    initial={{ opacity: 0.5 }}
    animate={{ opacity: [0.5, 0.8, 0.5] }}
    transition={{ duration: 1.5, repeat: Infinity }}
  />
);

export const ChartSkeleton: React.FC = () => (
  <div className="w-full space-y-4 p-4">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="w-20 h-8" />
        <Skeleton className="w-32 h-6" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="w-20 h-8" />
        <Skeleton className="w-20 h-8" />
      </div>
    </div>

    {/* Controls */}
    <div className="flex gap-2">
      <Skeleton className="w-16 h-7" />
      <Skeleton className="w-20 h-7" />
      <Skeleton className="w-20 h-7" />
      <Skeleton className="w-16 h-7" />
    </div>

    {/* Chart Area */}
    <Skeleton className="w-full h-[400px] rounded-lg" />

    {/* Legend */}
    <div className="flex gap-4">
      <Skeleton className="w-20 h-5" />
      <Skeleton className="w-20 h-5" />
      <Skeleton className="w-16 h-5" />
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="w-full space-y-2">
    {/* Header */}
    <div className="grid grid-cols-6 gap-4 p-3 bg-gray-800/50 rounded-lg">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-4" />
      ))}
    </div>

    {/* Rows */}
    {[...Array(rows)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: i * 0.1 }}
        className="grid grid-cols-6 gap-4 p-3 border border-gray-800 rounded-lg"
      >
        {[...Array(6)].map((_, j) => (
          <Skeleton key={j} className="h-4" />
        ))}
      </motion.div>
    ))}
  </div>
);

export const CardSkeleton: React.FC = () => (
  <div className="bg-terminal-darker border border-gray-800 rounded-xl p-4 space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="w-24 h-6" />
      <Skeleton className="w-16 h-6 rounded-full" />
    </div>
    <Skeleton className="w-full h-4" />
    <Skeleton className="w-3/4 h-4" />
    <div className="flex gap-2 pt-2">
      <Skeleton className="w-20 h-8" />
      <Skeleton className="w-20 h-8" />
    </div>
  </div>
);

export const StatCardSkeleton: React.FC = () => (
  <div className="bg-terminal-darker border border-gray-800 rounded-xl p-4">
    <Skeleton className="w-16 h-4 mb-2" />
    <Skeleton className="w-24 h-8 mb-1" />
    <Skeleton className="w-20 h-4" />
  </div>
);

export const WatchlistSkeleton: React.FC = () => (
  <div className="bg-terminal-darker border border-gray-800 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-800">
      <Skeleton className="w-24 h-5" />
    </div>
    <div className="divide-y divide-gray-800">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3">
          <div className="space-y-1">
            <Skeleton className="w-16 h-4" />
            <Skeleton className="w-24 h-3" />
          </div>
          <Skeleton className="w-16 h-5" />
        </div>
      ))}
    </div>
  </div>
);

export const ScreenerCardSkeleton: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-terminal-darker border border-gray-800 rounded-xl p-5 space-y-4"
  >
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="w-20 h-7" />
        <Skeleton className="w-32 h-4" />
      </div>
      <Skeleton className="w-16 h-16 rounded-full" />
    </div>
    <Skeleton className="w-full h-3" />
    <Skeleton className="w-4/5 h-3" />
    <div className="flex gap-2">
      <Skeleton className="w-16 h-6 rounded-full" />
      <Skeleton className="w-20 h-6 rounded-full" />
    </div>
    <div className="grid grid-cols-3 gap-3 pt-2">
      <Skeleton className="h-14 rounded-lg" />
      <Skeleton className="h-14 rounded-lg" />
      <Skeleton className="h-14 rounded-lg" />
    </div>
  </motion.div>
);

export default Skeleton;
