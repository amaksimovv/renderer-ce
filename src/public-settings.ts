import type { IBookingRendererSettings } from './public-types.js';

export const settingKeys = [
  'baseUrl',
  'publicKey',
  'env',
  'requestTimeoutMs',
  'seatsPrices',
  'debounceDelay',
  'height',
  'width',
  'initialPadding',
  'padding',
  'selectionLimit',
  'zoomAnimationDuration',
  'zoomToSectionMode',
  'zoomToSectionDefaultScale',
  'zoomToSectionFitPadding',
  'zoomToSectionAdaptiveThreshold',
  'disableCartInteractions',
  'hideSeats',
  'orphanPrevention',
  'showRows',
  'highlightAllOutlines',
  'zoomSettings',
  'onSeatMouseEnter',
  'onSeatDebouncedEnter',
  'onSeatMouseLeave',
  'onSeatSelect',
  'onSeatDeselect',
  'onOrphanSeatsBlocked',
  'onSeatsSelect',
  'onCartChange',
  'onSectorMouseEnter',
  'onSectorMouseLeave',
  'onSectorClick',
  'onSectionClick',
  'onZoomStart',
  'onZoomEnd',
  'onRedrawStart',
  'onRedrawEnd',
  'onSchemaDataLoaded',
  'onSeatsSelectionChange',
  'lockedSeatsFilter',
  'theme',
  'onBeforeSeatDraw',
  'hotkeys',
  'forceSvg',
  'loader',
] as const satisfies readonly (keyof IBookingRendererSettings)[];

function keys(value: object | undefined, allowed: readonly string[], path: string): void {
  if (!value) return;
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw new TypeError(`renderer-ce does not support ${path}${key}`);
}

export function validateSettings(settings?: IBookingRendererSettings): void {
  keys(settings, settingKeys, 'settings.');
  if (!settings) return;
  if (settings.forceSvg !== undefined && settings.forceSvg !== true)
    throw new TypeError('renderer-ce requires SVG backgrounds');
  if (settings.hotkeys !== undefined && settings.hotkeys !== false)
    throw new TypeError('renderer-ce does not support custom hotkeys');
  keys(settings.loader, ['enabled', 'errorTexts'], 'loader.');
  keys(settings.theme, ['bgColor', 'priceColors', 'colorCategories', 'seatStyles'], 'theme.');
  keys(
    settings.zoomSettings,
    ['presets', 'maxZoomToFitScale', 'minPinchZoom', 'maxPinchZoom'],
    'zoomSettings.',
  );
  for (const [name, style] of Object.entries(settings.theme?.seatStyles ?? {})) {
    keys(
      style,
      ['size', 'color', 'seatName', 'stroke', 'shadow', 'accessible', 'tint', 'blockInteraction'],
      `theme.seatStyles.${name}.`,
    );
    if (!style || !('color' in style)) continue;
    keys(style.stroke, ['width', 'color'], `theme.seatStyles.${name}.stroke.`);
    keys(
      style.accessible,
      ['size', 'color', 'seatName', 'stroke', 'shadow'],
      `theme.seatStyles.${name}.accessible.`,
    );
    keys(
      style.accessible?.stroke,
      ['width', 'color'],
      `theme.seatStyles.${name}.accessible.stroke.`,
    );
  }
}
