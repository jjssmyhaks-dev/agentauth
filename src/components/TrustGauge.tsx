import { motion } from "framer-motion";

export interface TrustGaugeProps {
  score: number; // 0-100
  level: "trusted" | "normal" | "questionable" | "untrusted";
  size?: number;
}

const levelColors = {
  trusted: { stroke: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  normal: { stroke: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  questionable: { stroke: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  untrusted: { stroke: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

export default function TrustGauge({ score, level, size = 120 }: TrustGaugeProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colors = levelColors[level];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.bg}
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-2xl font-serif font-medium"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{level}</span>
      </div>
    </div>
  );
}
