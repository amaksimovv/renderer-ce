import type { Context } from './settings.js';
import type { ISeat, ISeatStyle, IRendererSettings, SeatInteractionState } from './models.js';

const stateStyles: Record<SeatInteractionState, Partial<ISeatStyle>> = {
  default: {},
  unavailable: { size: 6, color: '#bbb' },
  hovered: { size: 38, seatName: { font: '18px Arial, sans-serif', color: '#fff' } },
  selected: { size: 42, shadow: { blur: 20, color: 'rgba(0, 0, 0, 0.3)' } },
  loading: { size: 42, color: '#2196F3' },
  error: { size: 42, color: '#F44336' },
};

export function seatStyle(
  settings: IRendererSettings,
  seat: ISeat,
  state: SeatInteractionState,
  base: ISeatStyle,
  context: Context,
): ISeatStyle {
  const styles = settings.theme?.seatStyles;
  const normal = styles?.default,
    interaction = styles?.[state];
  let style: ISeatStyle = {
    ...base,
    ...stateStyles[state],
    ...(seat.isAccessible && state === 'default' ? { size: 26 } : {}),
    ...normal,
    ...interaction,
  };
  if (seat.isAccessible) style = { ...style, ...style.accessible };
  const custom = seat.customState ? styles?.[seat.customState] : undefined;
  if (custom) {
    if ('color' in custom) style = { ...style, ...custom };
    else if (custom.tint) style = { ...style, color: custom.tint };
  }
  return settings.onBeforeSeatDraw?.({ seat, state, style, context }) ?? style;
}
