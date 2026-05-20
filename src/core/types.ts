export interface WidgetConfig {
  /** Mount target: CSS selector or element. */
  target: string | HTMLElement;
  /** Use shadow DOM isolation. No hard default — caller decides. */
  shadow?: boolean;
  /** Override base URL for lazy chunks (default: derived from script src). */
  assetBase?: string;
  /** Arbitrary props passed to the Svelte component. */
  [key: string]: unknown;
}

export interface WidgetInstance {
  readonly id: number;
  update(props: Record<string, unknown>): void;
  destroy(): void;
}
