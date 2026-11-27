'use client';

import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { inertProp } from './react-compat.js';

export type StackMotionPreset = 'ios' | 'modal' | 'none';

export type StackMotionProps = Omit<ComponentPropsWithoutRef<'div'>, 'hidden' | 'inert'> & {
  open: boolean;
  animation?: StackMotionPreset;
  enter?: StackMotionPreset;
  exit?: StackMotionPreset;
  inert?: boolean;
};

/** Apply the route slide to a component controlled by local state. */
export const StackMotion = forwardRef<HTMLDivElement, StackMotionProps>(function StackMotion(
  {open, animation = 'ios', enter = animation, exit = animation, inert, ...props},
  ref,
) {
  return <div {...props} {...inertProp(!open || !!inert)} ref={ref} data-sfn-enter={enter} data-sfn-exit={exit} hidden={!open} />;
});
