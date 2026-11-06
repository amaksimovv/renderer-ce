import type { ISpecialState, IBaseSeat, IBaseSector, ISectionPhoto } from './api-types.js';
import type { IPoint, HotkeysSetting, OutlineSource, Context } from './settings.js';
export type Nullable<T> = T | null | undefined;
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;
export type ById<T> = {
  [id: number]: T;
};
export type ColorById<T> = {
  [id: number | string]: T;
};
export type IPriceId = number | string;
export type TransformArray = [number, number, number, number, number, number];
export interface ISeat extends IBaseSeat {
  priceId?: IPriceId;
  locked?: boolean;
  filtered?: boolean;
  special?: ISpecialState;
  categoryKey?: string;
  state?: SeatInteractionState;
}
export interface ISector extends IBaseSector {
  priceId?: IPriceId;
  special?: ISpecialState;
}
export interface ISection {
  id?: number;
  name: string;
  ga: boolean;
  rect: ISectionRect;
  price?: number;
  priceId?: IPriceId;
  special?: ISpecialState;
  type?: string | null;
  seatCount?: number;
  textColor?: string;
  photos?: ISectionPhoto[];
}
export interface IEntityStates {
  highlighted: boolean;
  selected: boolean;
  unavailable: boolean;
  filtered: boolean;
}
export interface ISectionMetadata {
  id: number;
  name: string;
  guid?: string;
  type?: string;
  elementCount: number;
  seatCount?: number;
  priceId?: number | string;
  isGa?: boolean;
  disabled?: boolean;
  filtered?: boolean;
  bounds?: DOMRect | null;
  center?: {
    x: number;
    y: number;
  } | null;
  centerOutsideViewBox?: boolean;
  outlineSource?: 'svg' | 'shape' | 'auto' | 'fallback';
  states: IEntityStates;
}
export interface ISeatMetadata {
  id: number;
  key: string;
  sectionId: number;
  sectionName?: string;
  row?: string;
  seat?: string;
  x: number;
  y: number;
  priceId?: number | string;
  available: boolean;
  locked?: boolean;
  filtered?: boolean;
  inCart: boolean;
  states: IEntityStates;
}
export interface ISectionWithCoords {
  x: number;
  y: number;
  id?: number | undefined;
  name: string;
  ga: boolean;
  rect: ISectionRect;
  price?: number | undefined;
  special?: ISpecialState | undefined;
  type?: string | undefined | null;
}
export interface ISectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface ICartSeat {
  id?: number;
  key: string;
  price?: number;
  special?: ISpecialState;
}
export interface IExtendedSeat extends ICartSeat {
  x: number;
  y: number;
  ax: number;
  ay: number;
  sectionId: number;
  sectorId: number;
  seatName: string;
  rowNumber: number;
  sectionName: string;
  isAccessible?: boolean;
}
export interface ICartGa {
  sectorId?: number;
  key: string;
  count: number;
  price?: number;
}
export interface IRemovedCartGa {
  sectorId: number;
  price?: number;
}
export interface ICart {
  seats: ICartSeat[];
  ga: ICartGa[];
}
export type SeatFilter = (seat: ISeat) => boolean;
export type ISeatPriceScheme = {
  id?: number;
  seatKey: string;
  price: number;
  priceId: IPriceId;
};
export interface IZoomSettings {
  presets: number[];
  maxZoomToFitScale: number;
  minPinchZoom: number;
  maxPinchZoom: number;
}
interface IRange {
  from?: number;
  to?: number;
}
interface IVisibleSetting {
  visible?: IRange;
  selectable?: IRange;
}
export interface IVisibilitySettings {
  seats?: IVisibleSetting;
  outlines?: IVisibleSetting;
  markers?: IVisibleSetting;
}
export type MinimapPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export interface IMinimapSettings {
  enabled: boolean;
  position?: MinimapPosition;
  width?: number;
  maxHeightPercent?: number;
  opacity?: number;
  backgroundColor?: string;
  borderColor?: string;
  viewportColor?: string;
  borderWidth?: number;
  margin?: number;
  offscreenColor?: string;
  offscreenOpacity?: number;
  showCartPins?: boolean;
  showMarkers?: boolean;
}
export type MarkerTarget =
  | {
      type: 'seat';
      seatId: number;
    }
  | {
      type: 'section';
      sectionId: number;
    }
  | {
      type: 'point';
      x: number;
      y: number;
    };
export type MarkerAppearance =
  | {
      type: 'pin';
      color?: string;
    }
  | {
      type: 'circle';
      radius?: number;
      color?: string;
      label?: string;
    }
  | {
      type: 'custom';
      svg: string;
      width?: number;
      height?: number;
    };
export interface IMarker {
  id: string;
  target: MarkerTarget;
  appearance?: MarkerAppearance;
  showOnCanvas?: boolean;
  showOnMinimap?: boolean;
  interactive?: boolean;
  data?: Record<string, unknown>;
}
export type InteractionZoomStrategyType = 'default' | 'section' | 'next-scale';
export type InteractionZoomStrategy = InteractionZoomStrategyType | InteractionZoomStrategyType[];
export interface IMarkerSettings {
  defaultAppearance?: MarkerAppearance;
  defaultShowOnCanvas?: boolean;
  defaultShowOnMinimap?: boolean;
  defaultInteractive?: boolean;
}
export interface IResolvedMarker {
  marker: IMarker;
  x: number;
  y: number;
}
export type LoadingPhase =
  | 'schema'
  | 'prices'
  | 'rows'
  | 'background-blurred'
  | 'background-preview'
  | 'background-full'
  | 'processing';
export interface ILoadProgressEvent {
  phase: LoadingPhase;
  progress: number;
  isIndeterminate: boolean;
  message: string;
}
export interface IBackgroundImageLoadedEvent {
  type: 'blurred' | 'preview' | 'full' | 'detail-crop';
  loadTimeMs: number;
  sizeBytes?: number;
  width?: number;
  height?: number;
  gpuBytes?: number;
}
export type LoaderStyle = 'overlay' | 'top-bar';
export interface ILoaderTheme {
  overlayColor?: string;
  overlayOpacity?: number;
  progressBarColor?: string;
  progressBarBackgroundColor?: string;
  progressBarHeight?: number;
  textColor?: string;
  fontSize?: number;
}
export interface IErrorMessage {
  title: string;
  subtitle?: string;
}
export interface ILoaderSettings {
  enabled: boolean;
  style?: LoaderStyle;
  theme?: ILoaderTheme;
  showText?: boolean;
  texts?: {
    schema?: string;
    prices?: string;
    rows?: string;
    backgroundBlurred?: string;
    backgroundPreview?: string;
    backgroundFull?: string;
    processing?: string;
  };
  errorTexts?: {
    eventArchived?: IErrorMessage;
    eventNotPublished?: IErrorMessage;
    eventNotFound?: IErrorMessage;
    genericError?: IErrorMessage;
  };
}
export interface IWatermarkSettings {
  position?: 'bottom-left' | 'bottom-right';
  interruptionTitle?: string;
  interruptionSubtitle?: string;
}
export interface IRendererSettings {
  debug?: boolean;
  env?: string;
  backgroundImageBaseUrl?: string;
  seatsPrices?: ISeatPriceScheme[];
  theme?: IRendererTheme;
  markers?: IMarkerSettings;
  debounceDelay?: number;
  groupSize?: number;
  height?: number;
  width?: number;
  initialPadding?: number;
  padding?: number;
  eagleViewMaxZoom?: number;
  seatSelectionMinZoom?: number;
  hotkeys?: HotkeysSetting;
  selectionLimit?: number;
  transformAnimationDuration?: number;
  zoomAnimationDuration?: number;
  zoomToSectionMode?: 'fit' | 'scale';
  zoomToSectionDefaultScale?: number;
  zoomToSectionFitPadding?: number;
  zoomToSectionAdaptiveThreshold?: {
    small: number;
    large: number;
  };
  disableZoomToEmptySpace?: boolean;
  disableCartInteractions?: boolean;
  disableOutlinesInHelicopterView?: boolean;
  hideSeats?: boolean;
  orphanPrevention?: boolean;
  showOutlineLayerOnAnimation?: boolean;
  showRows?: boolean;
  showUnavailableOutlines?: boolean;
  switchToWebGL?: boolean;
  gpuTier?: 'high' | 'constrained';
  forceSvg?: boolean;
  showDebugLayer?: boolean;
  enable3DView?: boolean;
  highlightAllOutlines?: boolean;
  minimap?: IMinimapSettings;
  watermark?: IWatermarkSettings;
  loader?: ILoaderSettings;
  zoomSettings?: IZoomSettings;
  visibilitySettings?: IVisibilitySettings;
  interactionZoomStrategy?: InteractionZoomStrategy;
  onSeatMouseEnter?: (seat: IExtendedSeat) => void;
  onSeatDebouncedEnter?: (seat: IExtendedSeat) => void;
  onSeatMouseLeave?: () => void;
  onSeatSelect?: (seat: IExtendedSeat) => void | boolean | Promise<void | boolean>;
  onSeatDeselect?: (seat: IExtendedSeat) => void | boolean | Promise<void | boolean>;
  onOrphanSeatsBlocked?: (event: IOrphanSeatsBlockedEvent) => boolean | Promise<boolean>;
  onSeatsSelect?: (seats: ISeat[]) => void;
  onSeatsDeselect?: (seats: ISeat[]) => void;
  onCartChange?: (cart: ICart, prevCart?: ICart) => void;
  onMarkerClick?: (marker: IMarker, event: MouseEvent) => void;
  onMarkerMouseEnter?: (marker: IMarker) => void;
  onMarkerMouseLeave?: (marker: IMarker) => void;
  onSectorMouseEnter?: (section: ISection) => void;
  onSectorMouseLeave?: () => void;
  onSectorClick?: (section: ISection) => void;
  onSectionClick?: (section: ISection) => void;
  onSectionsSelectionChange?: (sections: ISection[]) => void;
  onZoomStart?: (newZoom: number, oldZoom: number) => void;
  onZoomEnd?: (newZoom: number, oldZoom?: number) => void;
  onRedrawStart?: () => void;
  onRedrawEnd?: () => void;
  onSchemaDataLoaded?: () => void;
  onLoadProgress?: (event: ILoadProgressEvent) => void;
  onBackgroundImageLoaded?: (event: IBackgroundImageLoadedEvent) => void;
  onWebGLContextLost?: () => void;
  onWebGLContextRestored?: () => void;
  onPan?: (delta: IPoint, isFinish?: boolean) => void;
  onSeatSelectionChange?: () => void;
  onSeatsSelectionChange?: (seats: ISeat[]) => void;
  onBeforeSeatDraw?: (event: IBeforeSeatDrawEvent) => ISeatStyle;
  lockedSeatsFilter?: (seat: ISeat) => boolean;
  suppressDeprecationWarnings?: boolean;
  outlineVisibility?: {
    auto?: 'always' | 'eagle-only' | 'hidden';
    fallback?: 'always' | 'eagle-only' | 'hidden';
    svg?: 'always' | 'eagle-only' | 'hidden';
    shape?: 'always' | 'eagle-only' | 'hidden';
  };
}
export type SeatInteractionState =
  | 'default'
  | 'hovered'
  | 'selected'
  | 'unavailable'
  | 'loading'
  | 'error';
export interface IOrphanSeatsBlockedEvent {
  attempted: number[];
  orphaned: number[];
  remedy: {
    select: number[];
    deselect: number[];
  } | null;
}
export interface ICartChangeResult {
  applied: boolean;
  orphaned: number[];
  remedy: {
    select: number[];
    deselect: number[];
  } | null;
}
export interface IBeforeSeatDrawEvent {
  seat: ISeat;
  state: SeatInteractionState;
  style: ISeatStyle;
  context: Context;
}
export type BuiltinSeatStateKey =
  | 'default'
  | 'unavailable'
  | 'filtered'
  | 'hovered'
  | 'selected'
  | 'loading'
  | 'error';
export interface ISeatStateRenderArgs {
  seat: ISeat;
  stateKey: string;
  style: ICustomSeatStyle;
  sizePx: number;
}
export interface ICustomSeatStyle {
  tint?: string;
  svg?: string;
  imageId?: string;
  className?: string;
  priority?: number;
  blockInteraction?: boolean;
  keepSeatName?: boolean;
  render?: (args: ISeatStateRenderArgs) => HTMLElement | string;
}
export interface IOrphanGroupStyle {
  color?: string;
  width?: number;
  dash?: number[];
  opacity?: number;
  padding?: number;
}
export type SeatStylesMap = Partial<Record<BuiltinSeatStateKey, ISeatStyle>> & {
  [customKey: string]: ICustomSeatStyle | ISeatStyle | undefined;
};
export interface IBasicSeatStyle {
  size: number;
  color: string;
  seatName?: {
    font: string;
    color: string;
  };
  stroke?: {
    width: number;
    color: string;
    align?: 'center' | 'inside' | 'outside';
  };
  imageId?: string;
  shadow?: {
    blur: number;
    color: string;
    x?: number;
    y?: number;
  };
}
export interface ISeatStyle extends IBasicSeatStyle {
  accessible?: IBasicSeatStyle;
}
export interface ISvgSectionStateStyles {
  default?: Pick<ISvgSectionStyle, 'sectionName' | 'stroke' | 'cursor' | 'bgColor'>;
  unavailable?: ISvgSectionStyle;
  filtered?: ISvgSectionStyle;
  hovered?: ISvgSectionStyle;
  selected?: ISvgSectionStyle;
}
export interface IRendererSvgSectionStylesSetting extends ISvgSectionStateStyles {
  bySource?: Partial<Record<OutlineSource, ISvgSectionStateStyles>>;
}
export interface ISvgSectionStyle {
  sectionName?: {
    color?: string;
  };
  bgColor?: string;
  stroke?: {
    color?: string;
    opacity?: number;
    width?: string;
  };
  cursor?: string;
  opacity?: number;
}
export interface IRendererTheme {
  gridStep?: number;
  bgColor?: string;
  priceColors?: string[][];
  colorCategories?: string[];
  images?: {
    [id: string]: string;
  };
  seatStyles?: SeatStylesMap;
  orphanGroup?: IOrphanGroupStyle;
  svgSectionStyles?: IRendererSvgSectionStylesSetting;
}
