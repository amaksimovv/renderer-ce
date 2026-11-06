export type SeatId = string | number;
export type SeatStatus = 'available' | 'unavailable';

export interface Seat {
  readonly id: SeatId;
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly row?: string;
  readonly section?: string;
  readonly category?: string;
  readonly status?: SeatStatus;
  readonly accessible?: boolean;
}

export interface Category {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly price?: number;
}

export interface MapLabel {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly size?: number;
  readonly color?: string;
}

export interface MapShape {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill?: string;
  readonly label?: string;
}

export type SvgBackground = {
  readonly bounds: Bounds;
  readonly opacity?: number;
} & (
  | { readonly svg: string; readonly url?: never }
  | { readonly url: string; readonly svg?: never }
);

export type BackgroundStatus = 'empty' | 'loading' | 'ready' | 'error';

export interface MapOutline {
  readonly source?: 'svg' | 'shape' | 'auto' | 'fallback';
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly transform?: readonly [number, number, number, number, number, number];
  readonly interactive?: boolean;
  readonly bounds: Bounds;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly fillRule?: 'nonzero' | 'evenodd';
}

export interface SeatmapData {
  readonly seats: readonly Seat[];
  readonly categories?: readonly Category[];
  readonly labels?: readonly MapLabel[];
  readonly shapes?: readonly MapShape[];
  readonly background?: SvgBackground;
  readonly outlines?: readonly MapOutline[];
}

export interface BookingSnapshot {
  readonly seats: readonly Seat[];
  readonly seatIds: readonly SeatId[];
  readonly total: number | null;
  readonly count: number;
}

export type SelectionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unavailable' | 'limit' | 'unknown-seat' };

export interface BookingOptions {
  readonly data: SeatmapData;
  readonly maxSelection?: number;
}

export interface RendererTheme {
  readonly background: string;
  readonly seat: string;
  readonly unavailable: string;
  readonly selected: string;
  readonly text: string;
  readonly selectedText: string;
  readonly shape: string;
  readonly focus: string;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Bounds extends Point {
  readonly width: number;
  readonly height: number;
}
