// src/global.d.ts
import * as React from 'react';
import { HTMLMotionProps, MotionProps } from 'framer-motion';

declare module 'framer-motion' {
  // 1) Ensure MotionProps itself includes children & className
  interface MotionProps {
    children?: React.ReactNode;
    className?: string;
  }

  // 2) Make HTMLMotionProps<T> extend React.HTMLAttributes<T> & MotionProps
  interface HTMLMotionProps<T>
    extends React.HTMLAttributes<T>,
            MotionProps {}
}