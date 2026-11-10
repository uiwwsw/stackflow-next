export interface RenderContext { restored: boolean; state: unknown }
export interface Options {
 root: string | HTMLElement;
 render(route: string, context: RenderContext): HTMLElement | {element: HTMLElement; dispose?: () => void} | Promise<HTMLElement | {element: HTMLElement; dispose?: () => void}>;
 maxRetained?: number; duration?: number; interaction?: boolean; onError?: (error: unknown) => void;
}
export declare function createApelike(options: Options): {
 push(route: string, state?: unknown): Promise<void>;
 replace(route: string, state?: unknown): Promise<void>;
 back(): Promise<boolean>; forward(): Promise<boolean>;
 readonly state: {index: number; routes: string[]; retained: number};
 destroy(): Promise<void>;
};
