# renderer-ce

**The open-source Canvas 2D booking renderer by [Seatmap.pro](https://seatmap.pro).**

MIT licensed, TypeScript, Canvas 2D and KDBush 4.0.2. The primary entry point is `SeatmapBookingRenderer`, with the Booking renderer's constructor, settings, cart types and method names. The public CE API is a subset of `@seatmap.pro/renderer`; applications migrate by changing their package imports.

[Open the Barclays Center demo (19,608 seats)](https://seatmap-pro.github.io/renderer-ce/?venue=barclays)

## Installation

```sh
npm install @seatmap.pro/renderer-ce
```

## Start the demo

Use Node.js 22.12+ and Corepack:

```sh
corepack yarn install --immutable
corepack yarn start
```

Open the URL printed by Vite. Choose **Barclays Center** for the real 19,608-seat, 235-section basketball map, or append `?venue=barclays` to the URL. The demo also includes a 240-seat theatre and a 768-seat arena. All maps, SVG backgrounds and fonts are local assets. Demo prices and availability are illustrative; selecting seats does not reserve inventory.

```sh
corepack yarn build:demo
corepack yarn preview
```

`dist-demo/` is a static site and supports hosting under a subdirectory. The list view shows up to 1,000 seats at a time; the section selector lets visitors reach every section. Canvas rendering has no artificial seat limit.

## Load local JSON

Give the container an explicit height. Load the schema and prices from your own static files or backend:

```ts
import { SeatmapBookingRenderer } from '@seatmap.pro/renderer-ce';
import type {
  ICart,
  IBookingRendererSettings,
  ISchemaDTO,
  IPriceListDTO,
} from '@seatmap.pro/renderer-ce';

const schema: ISchemaDTO = await fetch('/schema.json').then((response) => response.json());
const prices: IPriceListDTO = await fetch('/prices.json').then((response) => response.json());

const settings: IBookingRendererSettings = {
  selectionLimit: 6,
  onSeatSelect: async (seat) => reserveSeat(seat),
  onSeatDeselect: async (seat) => releaseSeat(seat),
  onCartChange: (cart: ICart) => updateCart(cart),
};

const renderer = new SeatmapBookingRenderer(element, settings);
await renderer.loadData(schema, prices);
renderer.initCart(savedCart);
```

`loadData(schema, prices)` accepts JSON objects in the shared `ISchemaDTO` and `IPriceListDTO` formats. Both renderer packages expose this method; no public key, event ID or Booking API is needed. The supplied objects are copied. It replaces the venue and clears the previous cart. `onSchemaDataLoaded` runs before prices, and DataManager's data-loaded notification runs after prices are applied. Restore a cart in the callback or after awaiting the method.

`schema` contains `seats` (or compressed `plainSeats`), `rows`, `sectors`, and `background.viewBox`; inline SVG goes in `background.svg`. `prices` contains the price definitions (`{ id, name }`), available-seat assignments (`[seatId, priceId, special?]`), and GA availability (`[sectionId, priceId, count, special?]`). A seat absent from the assignments is unavailable for interactive selection. Price names represent decimal amounts, such as `"42.50"`. Set `orphanPrevention` in the price data or override it in constructor settings. Linked background assets still load from their URLs; use inline SVG for a self-contained map.

## Load a managed event

```ts
const renderer = new SeatmapBookingRenderer(element, { publicKey });
await renderer.loadEvent(eventId);
```

`publicKey` is the same browser-facing public key used by the Booking renderer. `baseUrl` overrides the endpoint, and `env` accepts `production`, `stage` or `local`. Organization and tenant credentials belong on your server. The renderer calls the public Booking API; it does not call the Editor API.

`loadEvent` understands compressed schema coordinates, SVG backgrounds, row overlays, v2 price assignments and availability. It falls back to v1 prices when split pricing endpoints are unavailable. HTTP failures reject the promise. Loading another event or destroying the renderer cancels outstanding requests. `requestTimeoutMs` defaults to 30,000.

Selection callbacks receive `IExtendedSeat`. Returning or resolving `false` vetoes the change; rejecting also leaves the cart unchanged. Programmatic cart methods do not invoke the interactive selection callbacks. Seat add/remove and clear methods do not emit `onCartChange`; read `getCart()` after those calls. `initCart` emits the restored cart without a previous snapshot. Interactive selection and GA mutations emit the new and previous carts. Cart prices retain the commercial API's numeric units, including decimals. Seat keys use `sectionName;;rowNumber;;seatName`.

```ts
renderer.getCart();
renderer.addSeatsToCart([{ id: seatId, key: seatKey }]);
renderer.removeSeatsFromCartByIds([seatId]);
renderer.clearCart();
renderer.disableSeatsByIds(unavailableIds);
renderer.filterSeatsByIds(visibleIds);
renderer.removeFilter();
renderer.zoomToSection(sectionId);
renderer.zoomToFit();
renderer.destroy();
```

The server remains authoritative for inventory and prices. Implement holds, releases and checkout in your application. There is no telemetry or license server in CE.

## Compatibility scope

Migration is checked against the main renderer source including the shared `loadData` method. Use a main renderer release containing this method when migrating a JSON integration. CE exposes 80 renderer methods, 14 DataManager methods and 63 shared exports. Our cross-edition test suite checks names, constructor/settings compatibility, instance and static signatures, and compiles one consumer against both packages. Every public method must appear in the shared browser scenarios. Those scenarios run both implementations on desktop and mobile, with orphan prevention enabled and disabled, and compare results, cart callbacks, metadata, filters, categories, section state and zoom. Cross-package checks run in the monorepo; the standalone export retains CE declarations and tests.

| Public surface                     | CE behavior                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `loadData`                         | Local schema and prices, compressed seats, SVG, no Booking API or credentials                        |
| Constructor and `loadEvent`        | Public Booking API, compressed seats, SVG and row overlays                                           |
| Cart and selection callbacks       | Shared payloads, decimal prices, asynchronous veto, previous cart snapshots                          |
| Programmatic seat and GA cart      | Same restoration and mutation rules; interactive selection limits do not reject programmatic changes |
| Orphan prevention                  | The main renderer's row geometry, aisle detection and select/deselect remedy algorithm               |
| Seats and sections                 | Selection, availability locks, categories, custom states and filtering                               |
| Zoom and pan                       | Presets, fit/section navigation, animation duration and zoom callbacks                               |
| DataManager                        | Cached seat/section metadata, invalidation, refresh and event subscriptions                          |
| Seat styles and `onBeforeSeatDraw` | Color, size, stroke, label font, shadow, tint and interaction blocking                               |

CE excludes 3D, rotation, animation sequences, marker APIs, minimap, StateManager, group selection, custom hotkeys, image seat styles, custom HTML rendering and commercial visibility strategies. These are absent from the public declarations and runtime facade. Unsupported constructor settings throw instead of being silently ignored. Canvas outlines expose metadata rather than a `getSectionOutlineElements()` DOM API.

`onSchemaDataLoaded` runs before prices are installed. `initCart` restores held seats, including seats absent from availability or selections beyond the interactive limit; orphan warnings do not block restoration. The rendering engines, generated outline geometry and visual defaults may differ. Compatibility covers public application calls and data contracts, not internal objects, DOM selectors, deep imports or identical pixels. `VERSION` and `getVersion()` identify the installed package.

For migration from CE to the commercial renderer, change:

```ts
import { SeatmapBookingRenderer } from '@seatmap.pro/renderer-ce';
```

to:

```ts
import { SeatmapBookingRenderer } from '@seatmap.pro/renderer';
```

Keep the constructor settings, JSON data, callbacks and cart code. Both `loadData(schema, prices)` and `loadEvent(eventId)` remain unchanged. The public entry point contains no CE-only renderer or booking-client helpers.

## SVG and outlines

`background.svg`, `background.svgLink`, `background.viewBox` and `background.outlineSvg` use the existing Booking schema format. SVG backgrounds are decoded as images and drawn before outlines and seats. External backgrounds need CORS permission. CSP must permit their origin in `connect-src` and `blob:` in `img-src`.

Use self-contained SVGs. Image mode follows the browser's [SVG image restrictions](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image). Active SVG markup is never inserted into the page. Geometry extraction creates only allowlisted native geometry elements to measure bounds, then removes them.

Section paths bind through `data-gos-id`, `data-section-id` or `data-gos-guid`. Paths, rectangles, ellipses and polygons preserve nested transforms; compound paths support even-odd holes. When an outline is absent, CE generates a convex hull around the section's seats. This makes the Barclays map navigable without changing its source data. A seat click takes priority over an outline click.

## Demo data and navigation

The offline demo passes local JSON directly to `SeatmapBookingRenderer.loadData(schema, prices)`. Barclays uses `public/maps/barclays.json`, `barclays-prices.json` and `barclays.svg`. There is no Booking API mock or global fetch interception. The demo uses the same public API as the main renderer.

Zoom buttons, wheel and section navigation animate smoothly. `zoomAnimationDuration` controls programmatic zoom; reduced-motion preferences disable animation. Starting a pan cancels the current animation. Hover hit testing and callbacks are throttled to 50 ms with the latest pointer position; leaving the map, dragging and destruction cancel pending hover work.

Default seat styling follows the Booking renderer: regular seats have diameter 16, unavailable seats 6, hovered seats 38 with a white seat number, and selected seats 42 with a white checkmark and a scaled shadow. Accessible seats have diameter 26. These dimensions use map coordinates and scale with zoom. Hover and selection preserve price/category colors. `theme.seatStyles` and `onBeforeSeatDraw` override the defaults.

A padded projection window caches the visible scene. Animations reuse a raster covering the start and destination viewports; intermediate frames scale and translate that canvas, including during zoom-out. The cache retains the overview and up to two recent rasters, so returning from a section to the full venue does not repaint its seats. A final detailed redraw is needed only when the cached resolution differs from the destination. Pan reuses a raster until the viewport crosses its boundary; map data, background changes, resize and pixel-density changes invalidate retained rasters. Selected seats use a separate transparent canvas below the hover and keyboard-focus layer. Selecting, deselecting and clearing seats preserve the map cache and update accessibility attributes only for changed seats. Custom transparent or smaller selection and hover styles repaint only their affected regions, with overlapping masks composed across the layers. KDBush `range()` selects visible seats and `within()` finds pointer candidates. Geometry changes rebuild the index; availability changes reuse it.

## Build, package and verify

```sh
corepack yarn type-check
corepack yarn lint
corepack yarn format:check
corepack yarn test
corepack yarn build
corepack yarn playwright install chromium
corepack yarn test:e2e
corepack yarn test:perf
corepack yarn pack --out renderer-ce.tgz
```

The package exports ESM, CommonJS/UMD and declarations. The browser global is `SeatmapCE`. Imports do not access the DOM; instantiate after browser mounting. Build output is un-obfuscated. Venue snapshots are demo assets and are excluded from the library archive.

Browser tests cover Chromium desktop and mobile layouts, keyboard and pointer selection, SVG alignment, outline holes, and the real Barclays map. `PLAYWRIGHT_CHANNEL=chrome` uses an installed Chrome. Test artifacts are written under `.ai-runtime/renderer-ce` by default. Override the results directory with `RENDERER_CE_ARTIFACTS`.

The performance suite runs one browser at a time on the Barclays map. It reports frame intervals for a 14% pan and two returns from 132% through 100% to overview. It also checks that hovering and selecting seats leave the base map untouched. Mobile results use Chromium device emulation.

## License and map source

[MIT](LICENSE), copyright Seatmap.pro. This license applies to renderer-ce, not other monorepo products. Red Hat fonts use the [SIL Open Font License](demo/fonts/OFL.txt).

The Barclays demonstration snapshot comes from Seatmap.pro's BCB v.3.0 basketball demo schema 318 (19,608 seats, 235 sections), exported on 2026-11-05. It contains seating geometry and artwork with simulated prices and availability. Venue names and marks identify their respective owners.
