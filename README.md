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
- Document scrolling by default (`window.scrollTo`, `window.scrollY` keep working), with a custom vertical scrollbar; an independent scroll container also works (`scrollTarget`).
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

## Where it stands

| | `@uiwwsw/stackflow-next` | `@stackflow/react` |
| --- | --- | --- |
| npm downloads, week of 2026-11-18 | 271 | 38,535 |
| Maintainers | one | Daangn team |
| Status | unofficial | official |

- Usage is close to zero. No known production users.
- It is a visual layer over Next.js. Stackflow is a full navigation stack with its own router and activity model; this package does not replace it.
- Versions 3.0.0 to 3.1.0 were published to npm from a branch before they reached `main`; `main` now matches 3.1.0. Eight releases in one day (3.0.0 to 3.1.0 on 2026-11-17) mean the API is still moving.
- Next.js documents its own View Transitions support ([guide](https://nextjs.org/docs/app/guides/view-transitions)). If a plain page transition is enough, use that and skip this package.
- For animation work, Motion is the common choice (about 40 million weekly downloads).
- For a native-style navigation stack with an official maintainer, use Stackflow.
- Use this package only if you need the swipe-back gesture and per-entry scroll restoration on the Next.js App Router, and accept an unproven, single-maintainer dependency.

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
