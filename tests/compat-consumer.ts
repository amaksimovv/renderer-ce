import { SeatmapBookingRenderer } from '@seatmap.pro/renderer-ce';
import type {
  ICart,
  IBookingRendererSettings,
  ISchemaDTO,
  IPriceListDTO,
} from '@seatmap.pro/renderer-ce';
import { surface } from './compat-surface';

export async function run(
  host: HTMLElement,
  baseUrl: string,
  orphanPrevention = false,
  data?: { schema: ISchemaDTO; prices: IPriceListDTO },
) {
  const changes: { cart: ICart; previous?: ICart }[] = [];
  let initialPrices = -1;
  const settings: IBookingRendererSettings = {
    baseUrl,
    publicKey: data ? undefined : 'compatibility-test',
    forceSvg: true,
    orphanPrevention,
    selectionLimit: 1,
    hotkeys: false,
    theme: { seatStyles: { reserved: { blockInteraction: true, tint: '#999999' } } },
    zoomAnimationDuration: 0,
    loader: { enabled: false },
    onSchemaDataLoaded: () => {
      initialPrices = renderer.getPrices().length;
      renderer.initCart({ seats: [{ id: 10, key: '', price: 42.5 }], ga: [] });
    },
    onCartChange: (cart, previous) => changes.push({ cart, previous }),
  };
  const renderer = new SeatmapBookingRenderer(host, settings);
  try {
    if (data) await renderer.loadData(data.schema, data.prices);
    else await renderer.loadEvent('compatibility-event');
    const restored = renderer.getCart();
    const added = renderer.addSeatsToCart([{ key: 'Stalls;;1;;2' }]);
    const afterAdd = renderer.getCart();
    const removed = renderer.removeSeatsFromCartByKeys(['Stalls;;1;;1']);
    const afterRemove = renderer.getCart();
    renderer.zoomTo(0.5, { durationMs: 0 });
    const zoom = renderer.getZoom();
    renderer.clearCart();
    const publicSurface = await surface(renderer);
    return {
      initialPrices,
      restored,
      added,
      afterAdd,
      removed,
      afterRemove,
      cleared: renderer.getCart(),
      keys: renderer.seatKeysToIds(['Stalls;;1;;1', 'Stalls;;1;;3']),
      zoom,
      changes,
      publicSurface,
    };
  } finally {
    renderer.destroy();
  }
}
