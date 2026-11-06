import type * as Models from './booking/models.js';
import type { IBookingRendererSettings as Settings } from './booking/settings.js';
import type { SeatmapBookingRenderer as Implementation } from './booking/SeatmapBookingRenderer.js';
import type { DataManager as Data } from './booking/Managers.js';
import type { rendererMethods, dataMethods } from './public-methods.js';

export type ISeatStyle = Omit<Models.ISeatStyle, 'imageId' | 'accessible' | 'stroke'> & {
  stroke?: { width: number; color: string };
  accessible?: Omit<Models.IBasicSeatStyle, 'imageId' | 'stroke'> & {
    stroke?: { width: number; color: string };
  };
};
export type ICustomSeatStyle = Pick<Models.ICustomSeatStyle, 'tint' | 'blockInteraction'>;
export type SeatStylesMap = Partial<Record<Models.BuiltinSeatStateKey, ISeatStyle>> & {
  [key: string]: ISeatStyle | ICustomSeatStyle | undefined;
};
export type IRendererTheme = Pick<
  Models.IRendererTheme,
  'bgColor' | 'priceColors' | 'colorCategories'
> & {
  seatStyles?: SeatStylesMap;
};
export type IBeforeSeatDrawEvent = Omit<Models.IBeforeSeatDrawEvent, 'style' | 'context'> & {
  style: ISeatStyle;
  context: Pick<
    Models.IBeforeSeatDrawEvent['context'],
    'seats' | 'seatsById' | 'rowsById' | 'sectionsById' | 'scale' | 'translate' | 'getCart'
  >;
};
export interface IRendererSettings extends Pick<
  Models.IRendererSettings,
  | 'seatsPrices'
  | 'debounceDelay'
  | 'height'
  | 'width'
  | 'initialPadding'
  | 'padding'
  | 'selectionLimit'
  | 'zoomAnimationDuration'
  | 'zoomToSectionMode'
  | 'zoomToSectionDefaultScale'
  | 'zoomToSectionFitPadding'
  | 'zoomToSectionAdaptiveThreshold'
  | 'disableCartInteractions'
  | 'hideSeats'
  | 'orphanPrevention'
  | 'showRows'
  | 'highlightAllOutlines'
  | 'zoomSettings'
  | 'onSeatMouseEnter'
  | 'onSeatDebouncedEnter'
  | 'onSeatMouseLeave'
  | 'onSeatSelect'
  | 'onSeatDeselect'
  | 'onOrphanSeatsBlocked'
  | 'onSeatsSelect'
  | 'onCartChange'
  | 'onSectorMouseEnter'
  | 'onSectorMouseLeave'
  | 'onSectorClick'
  | 'onSectionClick'
  | 'onZoomStart'
  | 'onZoomEnd'
  | 'onRedrawStart'
  | 'onRedrawEnd'
  | 'onSchemaDataLoaded'
  | 'onSeatsSelectionChange'
  | 'lockedSeatsFilter'
> {
  theme?: IRendererTheme;
  onBeforeSeatDraw?: (event: IBeforeSeatDrawEvent) => ISeatStyle;
  hotkeys?: false;
  forceSvg?: true;
  loader?: Pick<Models.ILoaderSettings, 'enabled' | 'errorTexts'>;
}
export interface IBookingRendererSettings
  extends IRendererSettings, Pick<Settings, 'baseUrl' | 'publicKey' | 'env' | 'requestTimeoutMs'> {}
export type DataManager = Pick<Data, (typeof dataMethods)[number]>;
export type IRenderer = Omit<
  Pick<Implementation, (typeof rendererMethods)[number]>,
  'getDataManager'
> & {
  getDataManager(): DataManager;
};
