# @uiwwsw/stackflow-next

App-style navigation for Next.js App Router. The package adds directional
page transitions, a scroll viewport and an interactive back gesture. Next.js
Activity preserves screen state for retained routes. This is an independent
Stackflow integration.

## Install and configure

Install from npm.

```sh
npm install @uiwwsw/stackflow-next
```

See [npm](https://www.npmjs.com/package/@uiwwsw/stackflow-next) and the
[live demo](https://stackflow-next.vercel.app).

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
  in opposite directions. If the viewport changes height before the browser
  snapshot is ready, Stackflow can play the slide with the saved outgoing screen.
  By default, replace switches directly.
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
If a pinned element moves or is replaced during capture, navigation skips the
slide. A clipped target or a browser without fixed-target isolation uses the
whole-page slide.
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

Declare the rule once on the shared provider. If `/checkout` renders without
the header, the header slides out on entry and returns with the previous page
on Back. Forward applies the same route exception. The header stays still
between other routes when its DOM node and bounds stay
the same. Exceptions match exact pathnames. The app renders the header appropriate to the current
route. Mix exception rules and plain selectors in an array to control each
element independently.

If you installed `0.2.0-alpha.7` and used `transitionTarget`, upgrade and remove
that prop. Restore the bounded-height provider layout shown above under Install
and configure. Leave `fixedTargets` out to slide the entire page, or use it to
keep specific shared elements still. The old prop is ignored and logs a migration
warning in development.

## Open full-height modal pages

List the modal pathnames on your shared provider. The modal slides up when
opened and down when leaving, including through browser Back and Forward.

```tsx
<StackflowProvider modalRoutes={['/compose', '/filters']}>
  {children}
</StackflowProvider>
```

Open with `StackLink` or `useStackRouter().push()` and close with
`useStackRouter().back()`. Rules match the app pathname. Fragments and trailing
slashes in a destination do not affect the match. Motion applies to the provider's content area.
For a viewport-sized popup, give the provider a viewport height and render the
UI to cover its content area. Shared `header`, `footer`, and `persistent` slots
sit outside that area. Elements inside the content area participate in the
modal transition, including elements configured in `fixedTargets`.

Direct loads render immediately, and navigation between two modal routes uses
the regular horizontal slide. This option controls route motion. The app owns
the popup content and its close control.

## Animate a component

```tsx
'use client';

import { useState } from 'react';
import { StackMotion } from '@uiwwsw/stackflow-next';
import '@uiwwsw/stackflow-next/style.css';

export function Details() {
  const [open, setOpen] = useState(false);
  return <>
    <button aria-expanded={open} onClick={() => setOpen(value => !value)}>
      Toggle details
    </button>
    <StackMotion open={open} enter="modal" exit="ios">
      <p>Details</p>
    </StackMotion>
  </>;
}
```

`StackMotion` works independently of the navigation provider. Use `ios` for
a horizontal slide, `modal` for a vertical slide, or `none` for an immediate
change. Set `animation` to use one preset for both phases. `enter` and `exit`
override each phase separately.

Apply the same presets directly to an existing element with
`data-sfn-enter` and `data-sfn-exit`. Toggle `hidden` to run the transitions.

```tsx
<section hidden={!open} inert={!open} data-sfn-enter="modal" data-sfn-exit="ios">
  <p>Details</p>
</section>
```

Keep the element mounted so it can animate closing and preserve child state.
`StackMotion` makes its closed wrapper inert. The app owns layout, focus
management, and dialog semantics. Page and component slides share
`--stackflow-duration` and `--stackflow-easing`. The component changes
visibility immediately when the browser cannot animate the transition or the
user prefers reduced motion.

### Upgrade from 1.1

Remove rules containing a query from `transitionRoutes`, `modalRoutes`,
`skeletonRoutes`, and `fixedTargets.exceptRoutes`. Version 2 skips those rules.
Use `StackMotion` with local state for panels and popups on the same page.
Route options still accept exact application pathnames without the Next.js
`basePath` prefix. `transitionRoutes` uses the first matching pathname rule.
Search parameters in Next.js URLs and browser history continue to work.

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

By default the outgoing screen stays visible until the destination renders and
its visible `StackLoading` boundaries resolve. Wrap the fallback in
`loading.tsx` or Suspense with `<StackLoading>` to mark it as a readiness
boundary. Unmarked Suspense boundaries can continue streaming.

List a destination in `skeletonRoutes` to slide in its first render, which
can be a skeleton from that route's `loading.tsx`. The skeleton is then
replaced by the completed content in place. Next.js prefetching can make
that fallback available earlier. The same rule applies when arriving via
a link, browser Back, or browser Forward.

```tsx
<StackflowProvider
  skeletonRoutes={['/checkout', { pattern: '^/products/[^/]+$' }]}
>
  {children}
</StackflowProvider>
```

Exact paths can be mixed with regular expressions. Patterns test the app
pathname without the Next.js `basePath`, search parameters, or hash. Use
`{ pattern, flags? }` in a Server Component such as `app/layout.tsx`.
Client Components can also use a `RegExp` literal, such as
`/^\/products\/[^/]+$/`.

```tsx
// app/checkout/loading.tsx
import { StackLoading } from '@uiwwsw/stackflow-next';
import { CheckoutSkeleton } from './checkout-skeleton';

export default function Loading() {
  return <StackLoading><CheckoutSkeleton /></StackLoading>;
}
```

`waitForPage={false}` enables first-render transitions across the provider.
In 1.0, the `loading` prop supplies default content for `StackLoading` and
can be set to `null` for a marker with no visible content. The outgoing
screen stays visible without a provider-wide loading overlay. The
`navigationTimeout` option (default 4000 ms) releases a stalled browser snapshot.
If the destination is still loading, Stackflow keeps the outgoing screen visible
and plays the configured slide when the destination is ready.
When a client-side redirect commits a different route, Stackflow records the
actual destination and releases the snapshot. Competing history or View
Transition libraries require application-specific testing.

For same-document Back and Forward, Stackflow captures the outgoing screen
on the Navigation API’s `navigate` event when available. Older browsers use
the capture-phase `popstate` listener. Browsers without View Transitions use ordinary navigation. Initial page loads,
reloads, and links activated before hydration follow browser navigation. Only same-origin
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

## Localize the loading message

Pass your app's locale to the provider. The built-in loading message supports
English, Korean, Japanese, Chinese, Spanish, French, German, Portuguese, and
Arabic. Region variants use their primary language. Other locales use English.

```tsx
<StackflowProvider locale="ja-JP">{children}</StackflowProvider>
```

Pass `loading={translatedContent}` to use your app's own translations for any
locale. A `StackLoading` instance can also supply its own children.
