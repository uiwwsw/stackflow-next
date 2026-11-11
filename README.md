# @uiwwsw/stackflow-next

App-style navigation for Next.js App Router. The package adds directional
page transitions, a scroll viewport and an interactive back gesture. Next.js
Activity preserves screen state for retained routes. This is an independent
Stackflow integration.

## Install and configure

Install the current prerelease from npm.

```sh
npm install @uiwwsw/stackflow-next@next
```

The `next` tag currently points to `0.2.0-alpha.10`. See the
[npm package](https://www.npmjs.com/package/@uiwwsw/stackflow-next/v/0.2.0-alpha.10)
and [live demo](https://stackflow-next.vercel.app/).

Add the following to `next.config.mjs`. Pass your existing Next.js configuration
to `withStackflow` if you already have one. The integration needs no
environment variable or `experimental.viewTransition` flag.

```js
// next.config.mjs
import { withStackflow } from '@uiwwsw/stackflow-next/config';
export default withStackflow({});
```

The helper enables Next.js `cacheComponents` and `partialPrefetching`. This is
what preserves actual React component state and DOM across supported client
navigations. Retention belongs to Next, not to a second router or a private
router-context workaround. Existing applications must follow Next's Cache
Components migration requirements, including Suspense around request-time data.
See [Next's state preservation guide](https://nextjs.org/docs/app/guides/preserving-ui-state).

```tsx
// app/layout.tsx — remains a Server Component
import { StackflowProvider } from '@uiwwsw/stackflow-next';
import '@uiwwsw/stackflow-next/style.css';

export default function Layout({ children }) {
  return <html lang="en"><body style={{ margin: 0, height: '100dvh' }}>
    <StackflowProvider swipeBack preserveScroll>
      {children}
    </StackflowProvider>
  </body></html>;
}
```

The provider needs a bounded height. Set `--stackflow-background` to an opaque
color on the provider or an ancestor to match your theme. The live viewport,
swipe preview and transition snapshots share this background. The browser's
`Canvas` color backs the surface even if the theme color is transparent.
The optional `header` and `footer` slots remain outside the scroll viewport. Keep global overlays outside the transition
surface. Mount one provider per document.

```tsx
'use client';
import { StackLink, useStackRouter } from '@uiwwsw/stackflow-next';

export function Actions() {
  const router = useStackRouter();
  return <>
    <StackLink href="/detail">Details</StackLink>
    <button onClick={() => router.back()}>Back</button>
  </>;
}
```

## Behavior

- Existing file routes, URLs, direct entry, SSR and streaming stay owned by Next.
- Normal `useState` and DOM state survive while Next retains that route's Activity.
- `preserveScroll` restores the active scroll region's offset per history entry.
- `StackLink` preserves Next prefetching, modified clicks and `onNavigate` cancellation.
- `useStackRouter` exposes push, replace, back, forward, prefetch and refresh.
- Reloads and direct URL opens render immediately. In-app pushes and browser
  Back/Forward play the stack transition. Push and pop slide horizontally
  in opposite directions. If the viewport's vertical bounds change during navigation,
  Stackflow switches directly to the new page. Replace switches directly as well.
- Native scrolling remains active. Its hidden scrollbar is replaced by a visual,
  non-draggable indicator confined below the header and above the footer.
- Control selection, callout and tap-highlight styling is scoped to controls;
  editable fields and `data-selectable` retain selection.

## Keep selected elements still

The full page is the transition surface. To exclude existing shared elements
inside it, pass one CSS selector or an array to `fixedTargets`:

```tsx
<StackflowProvider fixedTargets={['[data-stack-fixed]', '#mini-player']}>
  <div data-stack-fixed><FilterBar /></div>
  {children}
  <div id="mini-player"><MiniPlayer /></div>
</StackflowProvider>
```

Place shared targets in the layout so the same elements remain mounted and keep
the same bounds across routes. The option does not change their CSS positioning.
If a selected element moves, is replaced, is clipped by the viewport, or the
browser cannot isolate it from the page capture, navigation skips the slide.
With `fixedTargets` configured, an edge swipe triggers Back on release without
dragging the live page. Existing `header`, `footer`, and `persistent` slots remain
outside the slide automatically.

To let a header slide when a route changes its content, render the header inside
the provider body and give its selector an `exceptRoutes` list:

```tsx
<StackflowProvider fixedTargets={{ selector: '#app-header', exceptRoutes: ['/checkout'] }}>
  <header id="app-header"><HeaderForCurrentRoute /></header>
  {children}
</StackflowProvider>
```

The header slides when entering or leaving `/checkout`, including Back and
Forward. It stays still between other routes when its DOM node and bounds stay
the same. Exceptions match exact pathnames, ignoring query strings, fragments,
and trailing slashes. The app renders the header appropriate to the current
route. Mix exception rules and plain selectors in an array to control each
element independently.

If you installed `0.2.0-alpha.7` and used `transitionTarget`, upgrade and remove
that prop. Restore the bounded-height provider layout shown above under Install
and configure. Leave `fixedTargets` out to slide the entire page, or use it to
keep specific shared elements still. The old prop is ignored and logs a migration
warning in development.

## Choose which area scrolls

By default, the provider body scrolls. Use `scrollTarget` to delegate scrolling,
the indicator, and scroll restoration to one visible HTML element inside it.
Give that element a bounded height so its contents can overflow.

```tsx
<StackflowProvider header={<AppHeader />} scrollTarget="[data-app-scroll]">
  <main data-app-scroll style={{ height: '100%' }}>{children}</main>
</StackflowProvider>
```

The provider body stops scrolling while the target is active. The target uses
native scrolling with a visual indicator inside its bounds. Keep the selector
unique within the visible screen; hidden routes retained by Next do not count.
An invalid selector or a selector with zero or multiple visible matches falls
back to the provider body and logs a warning in development.

## Keep shared UI mounted

Pass shared controls such as an audio player to `persistent` in a shared
`app/layout.tsx`:

```tsx
<StackflowProvider persistent={<MiniPlayer />} swipeBack>
  {children}
</StackflowProvider>
```

The slot is below the scrolling viewport and above the footer. It stays mounted
with the layout, so its DOM and local React state survive navigation between
pages that share that layout. The slot sits outside the page transition and swipe
preview. Reloading or leaving the shared layout still unmounts it. Keep the
component type and key stable across routes.

## Interactive back gesture

Enable `swipeBack`, then drag right starting inside the content viewport's left
24 pixels. The current screen tracks the pointer and a previous-screen preview
is revealed underneath. Release past the distance/velocity threshold to go back;
short drags, vertical movement and cancellation return to the current screen.
Inputs and `data-stackflow-no-swipe` regions are excluded.

The preview is an inert DOM clone, not another mounted React tree. At most two
visual previews are held. Canvas, video frames and external embedded content may
not reproduce exactly in that preview. Actual screen state is still owned by
Next Activity. A native browser's reserved edge gesture may take priority on
mobile devices. Reduced-motion settings skip settle animations.

## State and limits

Next can evict retained routes. State preservation is not unlimited, does not
survive refresh, and may reset on fresh navigation according to Next's semantics.
For state that must outlive route eviction, keep it in an application store or use
`useStackState(key, initial)` for an explicitly saved per-entry value. This hook's
cache is memory-only and bounded by `maxEntries` (default 32).

`useStack()` exposes Stackflow core's computed Stack; select `isTop` rather than
assuming array order. Core computes navigation state; it does not render RSCs.

Transitions finish at the new route's commit, which may be a Suspense fallback.
Later streamed content remains free to render. No claim is made that every
streamed chunk participates in one continuous transition. A navigation timeout
(default 4000ms) releases a stalled snapshot. Redirects and competing history or
View Transition libraries require application-specific testing.

Browsers without View Transitions use ordinary navigation. Only same-origin
HTTP(S) destinations are supported by the router helper. Ordinary Next Links
still work but forward snapshot motion requires StackLink or useStackRouter.

The current version targets Next.js 16.4.6+, React 19.3.1+ and Stackflow core 3.1.0.
Parallel/intercepting routes and real-device mobile gestures are not yet certified.

## Other options

`animation`: `"ios"` (default) or `"none"`; `preserveScroll`: true by default;
`swipeBack`: false by default; `maxEntries`: 32; `navigationTimeout`: 4000ms.
The `maxEntries` option controls this package's metadata/saved-state cache,
not Next's Activity cache size.

The independent live DOM renderer remains available from
`@uiwwsw/stackflow-next/dom` and `@uiwwsw/stackflow-next/dom/style.css`.
Use its `createApelike` only where the application owns the DOM lifecycle,
never over Next-managed route content.

## Development

Run `npm ci`, `npm test`, `npm run check` and `npm run build`.
The Next demo includes a plain useState counter, per-entry memo, scrollable
list, detail route and a streamed Server Component. Package installation and
CSS/type exports can be checked with `scripts/verify-release.mjs` through the
workspace development wrapper.
