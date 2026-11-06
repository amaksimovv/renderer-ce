import { SeatmapBookingRenderer as Implementation } from './booking/SeatmapBookingRenderer.js';
import type { IBookingRendererSettings, IRenderer, DataManager } from './public-types.js';
import { rendererMethods, dataMethods } from './public-methods.js';
import { validateSettings } from './public-settings.js';

export class SeatmapBookingRenderer implements IRenderer {
  declare getSeats: IRenderer['getSeats'];
  declare getRows: IRenderer['getRows'];
  declare getRowById: IRenderer['getRowById'];
  declare getSections: IRenderer['getSections'];
  declare getSectionsKeys: IRenderer['getSectionsKeys'];
  declare getMarkedSeatsIds: IRenderer['getMarkedSeatsIds'];
  declare getSeatIds: IRenderer['getSeatIds'];
  declare seatKeysToIds: IRenderer['seatKeysToIds'];
  declare getVisibleSeats: IRenderer['getVisibleSeats'];
  declare getPrices: IRenderer['getPrices'];
  declare getCategoryColor: IRenderer['getCategoryColor'];
  declare setExternalPrices: IRenderer['setExternalPrices'];
  declare seatToExtendedSeat: IRenderer['seatToExtendedSeat'];
  declare getSectionsWithCoords: IRenderer['getSectionsWithCoords'];
  declare getCart: IRenderer['getCart'];
  declare initCart: IRenderer['initCart'];
  declare clearCart: IRenderer['clearCart'];
  declare addSeatsToCart: IRenderer['addSeatsToCart'];
  declare removeSeatsFromCartByIds: IRenderer['removeSeatsFromCartByIds'];
  declare removeSeatsFromCartByKeys: IRenderer['removeSeatsFromCartByKeys'];
  declare addGaToCart: IRenderer['addGaToCart'];
  declare removeGaFromCart: IRenderer['removeGaFromCart'];
  declare disableSeatsByIds: IRenderer['disableSeatsByIds'];
  declare enableSeatsByIds: IRenderer['enableSeatsByIds'];
  declare disableSeatsByKeys: IRenderer['disableSeatsByKeys'];
  declare filterSeatsByIds: IRenderer['filterSeatsByIds'];
  declare filterSeatsByKeys: IRenderer['filterSeatsByKeys'];
  declare removeFilter: IRenderer['removeFilter'];
  declare updateSeatLocks: IRenderer['updateSeatLocks'];
  declare setSeatsCategory: IRenderer['setSeatsCategory'];
  declare setGaCategory: IRenderer['setGaCategory'];
  declare clearSeatsCategory: IRenderer['clearSeatsCategory'];
  declare clearGaCategory: IRenderer['clearGaCategory'];
  declare resetSeatsCategories: IRenderer['resetSeatsCategories'];
  declare resetGaCategories: IRenderer['resetGaCategories'];
  declare resetCategories: IRenderer['resetCategories'];
  declare setSeatsState: IRenderer['setSeatsState'];
  declare clearSeatsState: IRenderer['clearSeatsState'];
  declare getSeatSelection: IRenderer['getSeatSelection'];
  declare setSeatSelection: IRenderer['setSeatSelection'];
  declare setSectionSelection: IRenderer['setSectionSelection'];
  declare getSvgSectionBySelection: IRenderer['getSvgSectionBySelection'];
  declare setSelectedGa: IRenderer['setSelectedGa'];
  declare getSelectedGa: IRenderer['getSelectedGa'];
  declare disableSvgSectionsByIds: IRenderer['disableSvgSectionsByIds'];
  declare enableSvgSectionsByIds: IRenderer['enableSvgSectionsByIds'];
  declare disableSvgSectionsByNames: IRenderer['disableSvgSectionsByNames'];
  declare enableSvgSectionsByNames: IRenderer['enableSvgSectionsByNames'];
  declare disableSectionsByIds: IRenderer['disableSectionsByIds'];
  declare enableSectionsByIds: IRenderer['enableSectionsByIds'];
  declare filterSvgSectionsByIds: IRenderer['filterSvgSectionsByIds'];
  declare removeFilterSvgSectionsByIds: IRenderer['removeFilterSvgSectionsByIds'];
  declare disableSections: IRenderer['disableSections'];
  declare enableSections: IRenderer['enableSections'];
  declare filterSections: IRenderer['filterSections'];
  declare removeFilterSections: IRenderer['removeFilterSections'];
  declare disableSectionsByNames: IRenderer['disableSectionsByNames'];
  declare enableSectionsByNames: IRenderer['enableSectionsByNames'];
  declare highlightSector: IRenderer['highlightSector'];
  declare clearSectorHighlight: IRenderer['clearSectorHighlight'];
  declare setHighlightAllOutlines: IRenderer['setHighlightAllOutlines'];
  declare getHighlightAllOutlines: IRenderer['getHighlightAllOutlines'];
  declare getWidth: IRenderer['getWidth'];
  declare getHeight: IRenderer['getHeight'];
  declare setHeight: IRenderer['setHeight'];
  declare getZoom: IRenderer['getZoom'];
  declare getMinZoom: IRenderer['getMinZoom'];
  declare getMaxZoom: IRenderer['getMaxZoom'];
  declare zoomIn: IRenderer['zoomIn'];
  declare zoomOut: IRenderer['zoomOut'];
  declare zoomToFit: IRenderer['zoomToFit'];
  declare zoomTo: IRenderer['zoomTo'];
  declare zoomToDestination: IRenderer['zoomToDestination'];
  declare zoomToSection: IRenderer['zoomToSection'];
  declare viewSection: IRenderer['viewSection'];
  declare getVersion: IRenderer['getVersion'];
  declare getDataManager: IRenderer['getDataManager'];
  declare loadEvent: IRenderer['loadEvent'];
  declare loadData: IRenderer['loadData'];
  declare destroy: IRenderer['destroy'];

  static readonly VERSION = Implementation.VERSION;
  static readonly getErrorMessage = Implementation.getErrorMessage;

  constructor(
    element: HTMLElement,
    settings?: IBookingRendererSettings,
    tags?: Record<string, string | number | boolean>,
  ) {
    validateSettings(settings);
    const implementation = new Implementation(element, settings, tags);
    const data = implementation.getDataManager();
    const manager = Object.fromEntries(
      dataMethods.map((method) => [
        method,
        (...args: unknown[]) => Reflect.apply(data[method], data, args),
      ]),
    ) as DataManager;
    for (const method of rendererMethods)
      Object.defineProperty(this, method, {
        value:
          method === 'getDataManager'
            ? () => manager
            : (...args: unknown[]) => Reflect.apply(implementation[method], implementation, args),
        enumerable: true,
      });
  }
}
