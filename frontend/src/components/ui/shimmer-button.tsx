'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export function ShimmerButton({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  return (
    <Link href={href}>
      <motion.button
        className={`relative group overflow-hidden rounded-xl px-6 py-3 font-medium text-sm transition-all ${
          variant === 'primary'
            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
            : 'bg-white text-gray-900 border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700'
        } ${className}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="relative z-10 flex items-center gap-2">{children}</span>
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
      </motion.button>
    </Link>
  );
}
