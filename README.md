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

## What it is

An unofficial add-on for the Next.js App Router. It draws slide transitions between routes with the View Transitions API, adds an edge-swipe Back gesture, restores scroll position per history entry, and offers a custom scrollbar. Navigation, URLs and state retention stay with Next.js. It is not made by or affiliated with the [Stackflow](https://github.com/daangn/stackflow) team at Daangn; it uses `@stackflow/core` only to compute the stack returned by `useStack()`.

## What works now

- Slide transition between routes; vertical slide for routes in `modalRoutes`.
- Edge-swipe Back (`swipeBack`) with a preview of the previous screen.
- Scroll offset restored per history entry (`preserveScroll`).
- Document scrolling by default (`window.scrollTo`, `window.scrollY` keep working); an independent scroll container also works (`scrollTarget`).
- Only the scrollbar changes, never the scroller: the document still scrolls, so `window.scrollTo`, `window.scrollY`, `scrollTop` and `scroll` events behave as without the package. The browser's own scrollbar is hidden on `<html>` and `<body>`, and the drawn scrollbar replaces it.
- A vertical scrollbar drawn with [OverlayScrollbars](https://github.com/KingSora/OverlayScrollbars): its track stays between fixed headers, footers and tab bars, follows whichever scroller is moving, and can be dragged or clicked.
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
- No horizontal custom scrollbar. Horizontal overflow keeps native scrolling without a drawn bar.
- The drawn scrollbar no longer shrinks during elastic overscroll; `edgeBounce` still compresses it.

## Where it stands

One maintainer, no known production users, not tested on real devices. Compared with the libraries people use for the same job on the Next.js App Router (checked against each project's docs or source, November 2026):

| | stackflow-next | [SSGOI](https://github.com/meursyphus/ssgoi) | [next-view-transitions](https://github.com/shuding/next-view-transitions) | [Stackflow](https://github.com/daangn/stackflow) |
| --- | --- | --- | --- | --- |
| Keeps App Router routes and server components | yes | yes | yes | no; its README marks the Next.js example "Not Recommended" |
| Back/Forward plays the reverse direction | yes, from history position | yes, per saved entry | same animation both ways | yes, with its own router |
| Swipe Back with a preview of the previous screen | yes | browser's own gesture only | no | yes (cupertino theme) |
| Scroll position per history entry | yes | yes | no | not applicable |
| Draggable scrollbar kept clear of fixed bars | yes | no | no | no |
| Animation engine | View Transitions API | Web Animations API | View Transitions API | CSS transitions |
| Framework range | Next.js 16.4.6+ | React, Vue, Svelte, Solid, Angular, Qwik; Next.js 13.4–16 | Next.js App Router | React, single page |

- If you need effects beyond slides, older Next.js versions or browsers without View Transitions, SSGOI covers more and is more widely used.
- If a crossfade on link clicks is enough, Next.js's own `<ViewTransition>` or next-view-transitions is smaller.
- This package fits an app-like Next.js site that wants swipe Back, per-entry scroll and a scrollbar that respects its fixed header and tab bar together.
- iOS Safari uses the same left edge for its own Back gesture; how the two interact has not been checked on a device.

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
