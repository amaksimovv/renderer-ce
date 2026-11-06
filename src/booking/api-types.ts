import type { IPriceId, Nullable } from './models.js';
export interface IBaseSeat {
  id: number;
  rowId: number;
  sectorId: number;
  x: number;
  y: number;
  ix?: number;
  iy?: number;
  name: string;
  isAccessible?: boolean;
  isMarked?: boolean;
  customState?: string;
}
export interface ISectionPhoto {
  url: string;
  thumbUrl?: string;
  caption?: string;
}
export interface IBaseSector {
  id: number;
  guid?: string;
  isGa: boolean;
  name: string;
  angle?: number | null;
  type?: string | null;
  disabled?: boolean;
  filtered?: boolean;
  selected?: boolean;
  shapes?: ReadonlyArray<IShapeMetadata>;
  labelOffsetX?: number;
  labelOffsetY?: number;
  labelStyle?: ILabelStyle;
  labelVisible?: boolean;
  photos?: ISectionPhoto[];
}
export interface ILabelStyle {
  fontScale?: number;
  color?: string;
  opacity?: number;
  fontWeight?: 'normal' | 'bold';
  background?: string;
  visible?: boolean;
  showPrice?: boolean;
}
export interface IShapeMetadata {
  id?: string;
  text?: string;
  textColor?: string;
  textPosition?: string;
  fill?: string;
  width?: number;
  height?: number;
  top?: number;
  left?: number;
  angle?: number;
  order?: number;
  fontScale?: number;
}
export type BrandingLevel = 'watermark' | 'interrupted';
export interface ISchemaDTO {
  plainSeats?: IPlainSeatsDTO;
  seats: ISeatDTO[];
  rows: IRowDTO[];
  sectors: ISectorDTO[];
  background: ISVGBackgroundDTO;
  requestTime?: number;
  responseSize?: number;
  configuration?: IConfigurationDTO;
  instanceId?: string;
  componentVersion?: string;
  branding?: BrandingLevel;
}
export interface IVenueDTO {
  guid: string;
  name: string;
  gaCapacity?: number;
  seatsCapacity?: number;
  seatmap: ISchemaDTO;
  schema: ISchemaDTO;
}
export interface IPlainSeatsDTO {
  ids: number[];
  x: number[];
  y: number[];
  rowIds: number[];
  sectorIds: number[];
  names: string[];
}
export interface ISectionGridDTO {
  ids: number[];
  ix: number[];
  iy: number[];
}
export type ISeatDTO = IBaseSeat;
export interface IRowDTO {
  id: number;
  rowNumber: number;
  sectorId: number;
  name: string;
  seatName: string;
}
export type ISectorDTO = Omit<IBaseSector, 'labelStyle'> & {
  labelStyle?: string | ILabelStyle;
};
export interface ISVGBackgroundDTO {
  svg?: Nullable<string>;
  viewBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  svgLink?: string;
  images?: IPngBackgroundDTO;
  outlineSvg?: Nullable<string>;
}
export interface IConfigurationDTO {
  accessible: number[];
  marked: number[];
  eventName?: string;
}
export interface ISpecialPrice {
  name: string;
  priceId: number;
}
export interface ISpecialState {
  s1?: number;
  prices?: ISpecialPrice[];
  category?: number;
}
export interface IPriceListDTO {
  seats: [number, IPriceId, ISpecialState?][];
  groupOfSeats: [number, number, number, ISpecialState?][];
  prices: IPriceDTO[];
  orphanPrevention?: boolean | null;
  requestTime?: number;
  responseSize?: number;
}
export interface IAssignmentListDTO {
  version?: string;
  seatIds: number[];
  seatPriceRuns: [IPriceId, number][];
  seatPropertyIndexes: number[];
  seatProperties: ISpecialState[];
  groupOfSeats: [number, number, ISpecialState?][];
  prices: IPriceDTO[];
  requestTime?: number;
  responseSize?: number;
}
export interface IAvailabilityDTO {
  version?: string;
  unavailableSeats: number[];
  groupOfSeats: [number, number, number][];
  orphanPrevention?: boolean | null;
  requestTime?: number;
  responseSize?: number;
}
export declare const emptyPriceList: () => IPriceListDTO;
export interface IPriceDTO {
  id: IPriceId;
  name: string;
}
type IBlurred = {
  data: string;
  shrink_factor: number;
  size: number;
  status: string;
};
type IPngFromUrl = {
  height: number;
  size: number;
  width: number;
  path: string;
  status: string;
};
export type ITileGrid = {
  size: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  path: string;
  status: string;
};
export interface IPngBackgroundDTO {
  blurred: IBlurred;
  preview: IPngFromUrl;
  full: IPngFromUrl;
  tiles?: ITileGrid;
  lods?: IPngFromUrl[];
}
