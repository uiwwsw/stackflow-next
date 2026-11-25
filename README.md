<div align="center">

<h1>@uiwwsw/stackflow-next</h1>

<p>Slide transitions, an edge-swipe Back gesture, per-entry scroll restoration and a custom scrollbar for the Next.js App Router.</p>

<p>
  <a href="https://www.npmjs.com/package/@uiwwsw/stackflow-next"><img alt="npm version" src="https://img.shields.io/npm/v/@uiwwsw/stackflow-next?style=flat-square"></a>
  <a href="https://github.com/uiwwsw/stackflow-next/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/npm/l/@uiwwsw/stackflow-next?style=flat-square"></a>
  <a href="https://github.com/uiwwsw/stackflow-next/actions/workflows/public-docs.yml"><img alt="commit hygiene workflow" src="https://img.shields.io/github/actions/workflow/status/uiwwsw/stackflow-next/public-docs.yml?branch=main&style=flat-square&label=hygiene"></a>
  <img alt="types: TypeScript" src="https://img.shields.io/npm/types/@uiwwsw/stackflow-next?style=flat-square">
  <img alt="next 16.4.6 or later" src="https://img.shields.io/badge/next-%E2%89%A5%2016.4.6-black?style=flat-square">
  <img alt="react 19.3.1 or later" src="https://img.shields.io/badge/react-%E2%89%A5%2019.3.1-087ea4?style=flat-square">
</p>

<p>
  <a href="https://stackflow-next.vercel.app">Demo</a> ·
  <a href="https://github.com/uiwwsw/stackflow-next/blob/main/docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="https://www.npmjs.com/package/@uiwwsw/stackflow-next">npm</a> ·
  <a href="https://github.com/uiwwsw/stackflow-next">GitHub</a>
</p>

</div>

This is an unofficial package. It is not made by or affiliated with the
[Stackflow](https://github.com/daangn/stackflow) team at Daangn. It depends on
`@stackflow/core` only to compute the `Stack` returned by `useStack()`.
Navigation and state retention stay with Next.js; this package adds the visual
layer on top.

## Features

- Slide transition between routes, drawn with the View Transitions API.
- Vertical slide for routes listed in `modalRoutes`.
- Edge-swipe Back gesture (`swipeBack`) with a preview of the previous screen.
- Scroll offset restored per history entry (`preserveScroll`).
- Custom vertical scrollbar in the document or in a scroll container.
- `fixedTargets` keeps selected elements still while the page slides.
- `waitForPage` and `skeletonRoutes` control when the slide starts.
- `StackMotion` and `data-sfn-enter` / `data-sfn-exit` apply the same slides to local show/hide state.
- `StackLink` and `useStackRouter` wrap `next/link` and the Next router.
- `useStack`, `useStackScroll` and `useStackState` hooks.
- `persistent`, `header` and `footer` slots outside the transition.
- Built-in loading text in ten languages.
- `prefers-reduced-motion` is honored.
- `./dom` entry with `createApelike`, a standalone DOM renderer that does not use React.

## Install

```sh
npm install @uiwwsw/stackflow-next
```

Requires Next.js 16.4.6 or later and React 19.3.1 or later (see
[Not included and limits](#not-included-and-limits)).

## Usage

Wrap the Next.js config:

```js
// next.config.mjs
import { withStackflow } from '@uiwwsw/stackflow-next/config';
export default withStackflow({});
```

Add the provider to the root layout:

```tsx
// app/layout.tsx — remains a Server Component
import { StackflowProvider } from '@uiwwsw/stackflow-next';
import '@uiwwsw/stackflow-next/style.css';

export default function Layout({ children }) {
  return <html lang="en"><body style={{ margin: 0 }}>
    <StackflowProvider swipeBack preserveScroll>
      {children}
    </StackflowProvider>
  </body></html>;
}
```

Link and navigate from Client Components:

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

The [demo site](https://stackflow-next.vercel.app) runs the same app twice:
[with Stackflow Next](https://stackflow-next.vercel.app/with) and
[with plain Next.js links](https://stackflow-next.vercel.app/without).

## Not included and limits

- No router. Navigation, URLs, SSR and streaming stay with Next.js.
- No state retention of its own. Normal `useState` and DOM state survive only while Next.js retains the route; Next can evict it, and it does not survive a reload.
- No animation library. Motion is CSS and the Web Animations API.
- Browsers without View Transitions use ordinary navigation.
- Parallel and intercepting routes and real-device mobile gestures are untested.
- Tests run in a simulated DOM and the demo, not on a device matrix.
- The swipe preview is a DOM clone; canvas, video and embedded content may differ.
- Versions below Next.js 16.4.6 and React 19.3.1 are not tested.
- Not benchmarked against other libraries.

## Built on

- [Next.js](https://nextjs.org) App Router and Cache Components keep React and DOM state for retained routes ([guide](https://nextjs.org/docs/app/guides/preserving-ui-state)).
- [`@stackflow/core`](https://github.com/daangn/stackflow) by Daangn computes the stack returned by `useStack()`.
- [View Transitions API](https://developer.mozilla.org/docs/Web/API/View_Transition_API) draws the page slide.
- [Navigation API](https://developer.mozilla.org/docs/Web/API/Navigation_API) reports Back/Forward where available.
- The slide and swipe imitate iOS navigation controllers. No Apple code is used.

The history tracking, snapshot capture, fixed-target handling, scroll viewport
and swipe preview are written in this repository. See
[Architecture and credits](https://github.com/uiwwsw/stackflow-next/blob/main/docs/ARCHITECTURE.md)
for a file-by-file description, the dependency list and the limits.

## Configuration

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
navigations. Retention is done by Next.js; this package adds no router of its own. Existing applications must follow Next's Cache
Components migration requirements, including Suspense around request-time data.
See [Next's state preservation guide](https://nextjs.org/docs/app/guides/preserving-ui-state).

```tsx
// app/layout.tsx — remains a Server Component
import { StackflowProvider } from '@uiwwsw/stackflow-next';
import '@uiwwsw/stackflow-next/style.css';

export default function Layout({ children }) {
  return <html lang="en"><body style={{ margin: 0 }}>
    <StackflowProvider swipeBack preserveScroll>
      {children}
    </StackflowProvider>
  </body></html>;
}
```

Set `--stackflow-background` to an opaque
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
  snapshot is ready, this package can play the slide with the saved outgoing screen.
  By default, replace switches directly. Use `replace(href, 'push')` or
  `replace(href, 'pop')` to slide in that direction while replacing the current
  history entry. With no direction, changes to only the query or hash switch
  directly even when the route has an animation override.
- The provider draws a custom vertical scrollbar inside the active scroll area.
  The browser handles scrolling and touch gestures in that area.
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

Keep shared targets at the same bounds across routes. When different layouts
render their own header or bar, select both with `fixedTargets` and give each
instance the same `data-stackflow-fixed-key`, for example
`<nav data-stackflow-fixed-key="bottom-bar">`. Use a unique key per visible
target. If the destination snapshot has no matching target yet, the outgoing
snapshot stays visible during the slide. A change to a matched target's bounds
can skip the slide. A clipped target or a browser without fixed-target isolation
uses the whole-page slide.
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
between other routes when its identity and bounds stay the same. `exceptRoutes`
accepts exact pathnames and regular expressions such as `/^\/orders(?:\/|$)/`.
Both forms match the pathname on either side of the transition.

For a one-way exception, pass an `exceptTransition(from, to)` callback from a
Client Component. For example, `{ selector: '#bottom-bar', exceptTransition:
(from, to) => from === '/' && to === '/half-and-half' }` lets the bar slide when
opening `/half-and-half` from `/`. The callback receives app-relative URLs with
query and hash when present. Mix exception rules and plain selectors in an
array to control each element independently.

If you installed `0.2.0-alpha.7` and used `transitionTarget`, upgrade and remove
that prop. Restore the bounded-height provider layout shown above under Configuration. Leave `fixedTargets` out to slide the entire page, or use it to
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
For a viewport-sized popup, size its content to cover the visible body area.
Shared `header`, `footer`, and `persistent` slots
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

## Query-driven popups

Use `skipSlideQueryKeys` when a query parameter controls UI on the current
page, such as a popup that has its own animation.

```tsx
<StackflowProvider skipSlideQueryKeys={['popup']}>
  {children}
</StackflowProvider>
```

This skips the page slide when opening, changing, or closing `popup` on the
same pathname, including through `back()`, `forward()`, and the browser's
history controls. The URL and history still update normally. If the pathname,
hash, or another query key also changes, the usual transition rules apply.

## Document scrolling and the custom scrollbar

The document scrolls by default. Existing calls to `window.scrollTo()` and
`window.scrollBy()`, reads of `window.scrollY`, and window `scroll` listeners
work with the provider. It hides the browser's document scrollbar and
draws a vertical thumb inside the visible area specified by `scrollTarget`.
It uses the document's actual scroll range and the target's visible height.
With no single visible match, it uses the provider body for the display area.

```tsx
<StackflowProvider scrollTarget="[data-app-scroll]"
  header={<PageHeader />} footer={<PageActions />}>
  <main data-app-scroll>{children}</main>
</StackflowProvider>
```

Let the provider and content grow with the page. The header sticks to the
top, and `persistent` and `footer` stick together at the bottom. The browser
handles wheel and touch input, momentum, and elastic overscroll where
supported. The thumb compresses at the edge when the browser reports an
elastic offset. Set `--stackflow-scrollbar-color` on the provider to set its
color.

### Use an independent scroll container

Set `scrollMode="container"` to keep scrolling inside a bounded provider.
In this mode, `scrollTarget` selects the element that scrolls. If it is omitted
or has no single visible match, the provider body scrolls. Give the target a
bounded height and keep the selector unique within the visible screen.

```tsx
<StackflowProvider scrollMode="container" scrollTarget="[data-app-scroll]">
  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <header style={{ flex: 'none' }}><PageHeader /></header>
    <main data-app-scroll style={{ flex: 1, minHeight: 0 }}>{children}</main>
    <footer style={{ flex: 'none' }}><PageActions /></footer>
  </div>
</StackflowProvider>
```

A Client Component that works with either mode can call `useStackScroll()`.

```tsx
'use client';

import { useStackScroll } from '@uiwwsw/stackflow-next';

export function BackToTop() {
  const scroll = useStackScroll();
  return <button onClick={() => scroll.scrollTo({ top: 0, behavior: 'smooth' })}>
    Back to top
  </button>;
}
```

`scrollBy(options)` moves relative to the current position. `getPosition()`
returns `{ left, top }` in pixels. `getElement()` returns the document's
scrolling element or the active container. Both getters return `null` until
the provider is ready.

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

`useStack()` returns the Stack computed by `@stackflow/core`; select `isTop` rather than
assuming array order. Core only computes the stack state; it does not render server components.

The provider starts Next.js navigation as soon as it captures the outgoing DOM.
By default the slide starts when the destination first renders, including a
skeleton from `loading.tsx`. Next.js streams the completed content into that
screen. Prefetching can make the skeleton or page available earlier.

Set `waitForPage` to keep the outgoing body visible while the destination has a
visible `<StackLoading>` boundary. Wrap the fallback in `loading.tsx` or
Suspense to mark it as a readiness boundary. Unmarked Suspense boundaries can
continue streaming. While waiting, shared `header`, `footer` and `persistent`
slots remain interactive. Use `skeletonRoutes` with `waitForPage` to let selected
destinations slide on their first render, including through Back and Forward.
Before 2.2.0, `waitForPage` defaulted to `true`. Add the prop when you upgrade
to keep the earlier behavior.

```tsx
<StackflowProvider
  waitForPage
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

The `loading` prop supplies default content for `StackLoading` and can be set
to `null` for a marker with no visible content. `navigationTimeout` (4000 ms by
default) bounds the wait. At that point a committed skeleton can slide into
view, or a route that still has no commit can render when it becomes available.
When a client-side redirect commits a different route, the provider records the
actual destination and releases the snapshot. Competing history or View
Transition libraries require application-specific testing.

For same-document Back and Forward, the provider copies the outgoing DOM on the
Navigation API’s `navigate` event when available. Older browsers use the
capture-phase `popstate` listener. Next receives the original history event.
Browsers without View Transitions use ordinary navigation. Initial page loads,
reloads, and links activated before hydration follow browser navigation. Only same-origin
HTTP(S) destinations are supported by the router helper. Ordinary Next Links
still work but forward snapshot motion requires StackLink or useStackRouter.

The current version targets Next.js 16.4.6+, React 19.3.1+ and `@stackflow/core` 3.1.0.
Parallel and intercepting routes and real-device mobile gestures are untested.

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
English, Korean, Japanese, Simplified and Traditional Chinese, Spanish, French,
German, Portuguese, and Arabic. Region variants use their primary language;
Chinese regions such as `zh-TW` and `zh-HK` use Traditional Chinese. Other
locales use English.

```tsx
<StackflowProvider locale="ja-JP">{children}</StackflowProvider>
```

Pass `loading={translatedContent}` to use your app's own translations for any
locale. A `StackLoading` instance can also supply its own children.

## License

MIT
