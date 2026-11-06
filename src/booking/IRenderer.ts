import type { ISeatDTO, ISectorDTO } from './api-types.js';
import type {
  ICart,
  ICartGa,
  IRemovedCartGa,
  ICartSeat,
  ICartChangeResult,
  ISeatPriceScheme,
  SeatFilter,
  IMarker,
  IResolvedMarker,
} from './models.js';
import type { IPoint } from './settings.js';
import type { IColoredPrice } from './settings.js';
export interface IRenderer {
  initCart: (cart: ICart) => ICartChangeResult;
  getCart: () => ICart;
  clearCart: () => void;
  addGaToCart: (ga: ICartGa) => void;
  removeGaFromCart: (removedGa: IRemovedCartGa) => void;
  addSeatsToCart: (seats: ICartSeat[]) => ICartChangeResult;
  removeSeatsFromCartByIds: (seatIds: number[]) => ICartChangeResult;
  disableSeatsByIds: (seatIds: number[]) => void;
  disableSeatsByKeys: (keys: string[]) => void;
  updateSeatLocks: (filter: SeatFilter) => void;
  seatKeysToIds: (keys: string[]) => number[];
  setGroupSize: (groupSize: number) => void;
  getMarkedSeatsIds: () => number[];
  getPrices: () => IColoredPrice[];
  getSeats: () => ISeatDTO[];
  getZoom: () => number;
  getMaxZoom: () => number;
  getMinZoom: () => number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  setExternalPrices: (seatsPrices?: ISeatPriceScheme[]) => void;
  destroy: () => void;
  getVersion: () => string;
  disableSvgSectionsByIds: (
    sectionIds: number[],
    options?: {
      resetAll?: boolean;
    },
  ) => void;
  enableSvgSectionsByIds: (sectionIds: number[]) => void;
  disableSvgSectionsByNames: (
    sectionNames: string[],
    options?: {
      resetAll?: boolean;
    },
  ) => void;
  enableSvgSectionsByNames: (sectionNames: string[]) => void;
  getSvgSectionBySelection: () => ISectorDTO[];
  setHighlightAllOutlines: (highlight: boolean) => void;
  getHighlightAllOutlines: () => boolean;
  showMinimap?: () => void;
  hideMinimap?: () => void;
  toggleMinimap?: () => void;
  setMinimapPosition?: (
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  ) => void;
  addMarker: (marker: IMarker) => void;
  removeMarker: (markerId: string) => void;
  clearMarkers: () => void;
  getMarkers: () => IMarker[];
  getResolvedMarkers: () => IResolvedMarker[];
  animateSequence: (steps: IRendererSequenceStep[]) => Promise<void>;
  zoomTo: (
    newScale: number,
    options?: {
      destination?: IPoint;
      durationMs?: number;
    },
  ) => void;
}
export interface IRendererSequenceStep {
  zoomTo?: number;
  destination?: IPoint;
  rotateTo?: number;
  tiltTo?: number;
  perspectiveTo?: number;
  durationMs?: number;
}
