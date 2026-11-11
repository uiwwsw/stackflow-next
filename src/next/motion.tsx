'use client';

import { type ComponentPropsWithRef } from 'react';

export type StackMotionPreset = 'ios' | 'modal' | 'none';

export type StackMotionProps = Omit<ComponentPropsWithRef<'div'>, 'hidden'> & {
  open: boolean;
  animation?: StackMotionPreset;
  enter?: StackMotionPreset;
  exit?: StackMotionPreset;
};

/** Apply the route slide to a component controlled by local state. */
export function StackMotion({open, animation = 'ios', enter = animation, exit = animation, inert, ...props}: StackMotionProps) {
  return <div {...props} data-sfn-enter={enter} data-sfn-exit={exit} hidden={!open} inert={!open || inert} />;
}
