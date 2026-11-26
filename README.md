<div align="center">

<h1>@uiwwsw/stackflow-next</h1>

<p>Stackflow-style stack navigation for the Next.js App Router, with server rendering left intact.</p>

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

## Why this package

Built on Stackflow's core, it brings app-style stack navigation to the Next.js App Router: slides that know forward from Back, an edge-swipe Back gesture, scroll restored per screen and a scrollbar that respects your fixed bars. Each screen stays an ordinary Next.js route.

- **Server Components, SSR and prefetching stay intact.** Stackflow itself renders every screen inside one client `<Stack />`, and its README marks the Next.js example "Not Recommended". Here every screen remains its own route: `StackflowProvider` renders server-rendered children as passed, the only `useSearchParams` call sits in its own `<Suspense>`, and `StackLink` renders `next/link`, so prefetching and RSC payloads are untouched.
- **Back and Forward animate in the right direction, automatically.** The Next.js guide states that browser Back/Forward, history swipes and `router.back()` do not trigger view transition animations, and its directional slides need `transitionTypes` on each link. This package reads direction from the history position, so browser Back plays the reverse slide with no per-link setup.
- **Swipe Back with the previous screen visible.** An edge swipe drags the page and shows the screen underneath before committing.
- **Scroll position per history entry,** restored on Back and Forward.
- **The scroller is never replaced.** The document keeps scrolling, so `window.scrollTo`, `scrollY` and scroll listeners behave as before. Only the scrollbar changes: an [OverlayScrollbars](https://github.com/KingSora/OverlayScrollbars) bar you can drag or click, kept between fixed headers, footers and tab bars, with a horizontal bar only when the page overflows sideways.
- **Light at runtime.** All exports bundled, minified and gzipped come to about 31.5 KB (OverlayScrollbars 15.3 KB, `@stackflow/core` 6.0 KB, this package about 10 KB); the same measurement of `@ssgoi/react` with its view-transitions entry is 44.0 KB. The scrollbar handle follows a `ScrollTimeline` where the browser supports it, the track is re-measured only when layout-relevant DOM changes (`class`, `style`, `hidden`), and UI state attributes such as `aria-*` cause no layout reads.
- **Your Next.js config wins.** `withStackflow` turns on Cache Components only if you have not set it. With it on, screens keep their state on Back; with it off, transitions, swipe Back and scroll restoration still work.

Not made by or affiliated with the [Stackflow](https://github.com/daangn/stackflow) team at Daangn.

## What works now

- Slide transition between routes; vertical slide for routes in `modalRoutes`.
- Edge-swipe Back (`swipeBack`) with a preview of the previous screen.
- Scroll offset restored per history entry (`preserveScroll`).
- Document scrolling by default (`window.scrollTo`, `window.scrollY` keep working); an independent scroll container also works (`scrollTarget`).
- Only the scrollbar changes, never the scroller: the document still scrolls, so `window.scrollTo`, `window.scrollY`, `scrollTop` and `scroll` events behave as without the package. The browser's own scrollbar is hidden on `<html>` and `<body>`, and the drawn scrollbar replaces it.
- A vertical scrollbar drawn with [OverlayScrollbars](https://github.com/KingSora/OverlayScrollbars): its track stays between fixed headers, footers and tab bars, follows whichever scroller is moving, and can be dragged or clicked. A horizontal bar appears along the bottom of the track only when the page overflows sideways. `scrollbar={{ autoHide, autoHideDelay, autoHideSuspend }}` sets when it hides.
- `edgeBounce`: optional touch bounce at scroll boundaries on non-Apple touch devices.
- `skipSlideQueryKeys`: skip the page slide when only a popup query parameter changes.
- `fixedTargets` keeps chosen elements still during the slide.
- `waitForPage` and `skeletonRoutes` control when the slide starts.
- `StackMotion` applies the same slides to local show/hide state.
- `StackLink`, `useStackRouter`, `useStack`, `useStackScroll`, `useStackState`.
- `persistent`, `header` and `footer` slots outside the transition.
- Loading text in ten languages; `prefers-reduced-motion` is honored.
- `./dom` entry with `createApelike`, a DOM renderer that does not use React.

## Not done / planned

- Not tested on real devices. Tests run in a simulated DOM and the demo.
- Parallel and intercepting routes are untested.
- No state retention of its own. State survives only while Next.js keeps the route, and not across a reload.
- No fallback animation. Browsers without View Transitions use ordinary navigation.
- The swipe preview is a DOM clone; canvas, video and embedded content may differ.
- Next.js below 16.4.6 and React below 19.3.1 are untested.
- No benchmarks against other libraries.
- No physics or spring animation. Motion is CSS and the Web Animations API.
- The drawn scrollbar no longer shrinks during elastic overscroll; `edgeBounce` still compresses it.

## Install

```sh
npm install @uiwwsw/stackflow-next
```

Requires Next.js 16.4.6 or later and React 19.3.1 or later.

```js
// next.config.mjs
import { withStackflow } from '@uiwwsw/stackflow-next/config';
export default withStackflow({});
```

```tsx
// app/layout.tsx
import { StackflowProvider } from '@uiwwsw/stackflow-next';
import '@uiwwsw/stackflow-next/style.css';

export default function Layout({ children }) {
  return <html lang="en"><body>
    <StackflowProvider swipeBack preserveScroll>{children}</StackflowProvider>
  </body></html>;
}
```

Use `StackLink` and `useStackRouter` in Client Components in place of `next/link` and the Next router.

## Docs

- [Full reference](https://github.com/uiwwsw/stackflow-next/blob/main/docs/REFERENCE.md): options, behavior, scroll container, modal pages, back gesture, limits.
- [Architecture and credits](https://github.com/uiwwsw/stackflow-next/blob/main/docs/ARCHITECTURE.md)
- [Demo](https://stackflow-next.vercel.app), with and without the package: [with](https://stackflow-next.vercel.app/with), [without](https://stackflow-next.vercel.app/without).

## License

MIT. See [LICENSE](https://github.com/uiwwsw/stackflow-next/blob/main/LICENSE).
