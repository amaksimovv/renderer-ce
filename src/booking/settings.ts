import type { IRendererSettings, ISeat, ISector, ICart } from './models.js';
import type { IPriceDTO, IRowDTO } from './api-types.js';

export interface IPoint {
  x: number;
  y: number;
}
export type HotkeysSetting = false | Partial<Record<string, string | null>>;
export type OutlineSource = 'svg' | 'shape' | 'auto' | 'fallback';
export interface IColoredPrice extends IPriceDTO {
  color: string;
}
export interface IBookingRendererSettings extends IRendererSettings {
  baseUrl?: string;
  publicKey?: string;
  env?: 'local' | 'stage' | 'production';
  requestTimeoutMs?: number;
}
export interface Context {
  seats: ISeat[];
  seatsById: Record<number, ISeat>;
  rowsById: Record<number, IRowDTO>;
  sectionsById: Record<number, ISector>;
  settings: Omit<IRendererSettings, 'onBeforeSeatDraw'>;
  scale: number;
  translate: IPoint;
  getCart: () => ICart;
}

export class UnsupportedFeatureError extends Error {
  constructor(feature: string) {
    super(`${feature} requires the Seatmap.pro renderer`);
    this.name = 'UnsupportedFeatureError';
  }
}
