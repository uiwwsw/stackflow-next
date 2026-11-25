# Architecture and credits

This page describes what `@uiwwsw/stackflow-next` contains, what each source
file does, what it depends on, and which parts come from other projects. It
reflects the code in this repository, not a design wish list.

## What this package is

A small client-side layer on top of the Next.js App Router. It adds an
app-style slide transition between routes, an optional edge swipe for Back, a
scrollbar and scroll restoration per history entry, and a `StackMotion`
component that applies the same slide to a local show/hide state.

It does not replace the Next.js router. Navigation, URLs, SSR, streaming and
the preservation of component state all stay with Next.js and React.

## Relation to Stackflow and other projects

- **Stackflow** by Daangn ([stackflow.so](https://stackflow.so),
  [github.com/daangn/stackflow](https://github.com/daangn/stackflow)) is a
  stack-navigation framework for React. This package is not made by or
  affiliated with the Stackflow team. The only Stackflow code it imports is
  `@stackflow/core`, and only `aggregate` and `makeEvent`, which turn the
  history entries seen by the browser into a computed `Stack` that
  `useStack()` returns. The transitions, history tracking, scroll handling and
  swipe gesture are not taken from Stackflow. The name refers to the
  navigation model (a stack of screens) and the dependency. Stackflow's own
  React packages and plugins are not used.
- **Next.js** ([nextjs.org](https://nextjs.org)) provides the router,
  `next/link`, and the retention of previous routes. Keeping `useState` and DOM
  state alive between navigations is done by Next.js Cache Components, which
  use React's `<Activity>`
  ([guide](https://nextjs.org/docs/app/guides/preserving-ui-state)).
  `withStackflow` only sets `cacheComponents` and `partialPrefetching` in the
  Next config. This package does not implement state retention.
- **View Transitions API**
  ([MDN](https://developer.mozilla.org/docs/Web/API/View_Transition_API)) draws
  the page slide. The package calls `document.startViewTransition` and styles
  the generated pseudo-elements in CSS. Without browser support it falls back
  to its own snapshot slide (`slide-fallback.ts`) or to an ordinary
  navigation.
- **Navigation API**
  ([MDN](https://developer.mozilla.org/docs/Web/API/Navigation_API)) is used,
  where present, to learn about Back/Forward traversals before they happen.
  Otherwise a capture-phase `popstate` listener is used.
- **iOS navigation look.** The slide (the new screen enters from the right, the
  old one moves left by 25%) and the left-edge swipe imitate the push/pop
  behavior of iOS navigation controllers. No Apple code is used.
- **Animation libraries.** None. Motion is CSS (view-transition keyframes and
  `transition` with `@starting-style`) plus the Web Animations API
  (`element.animate`) for the swipe settle and the DOM renderer.

What is original here: the history wrapper that tags entries, the capture and
snapshot logic, the fixed-target pinning, the scroll viewport and scrollbar,
the swipe preview, and the option set. These were written for this package.
Similar techniques exist in other libraries; this repository does not claim
to be the first to use them, and it has not been benchmarked against any other
library.

## Dependencies

| Package | Kind | Used for |
| --- | --- | --- |
| `@stackflow/core` | dependency | `aggregate` and `makeEvent` in `src/next/engine.ts`, to build the `Stack` returned by `useStack()`. |
| `next` | peer | `next/link`, `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) and the `NextConfig` type. |
| `react`, `react-dom` | peer | Components and hooks (`useSyncExternalStore`, `useLayoutEffect`, `Suspense`). |

Development only: `typescript` (build and `npm run check`), `tsx` and
`happy-dom` (tests run with `node --test` against a simulated DOM), `@types/*`.
The `./dom` entry has no dependencies.

## Entry points

| Import | File | Contents |
| --- | --- | --- |
| `@uiwwsw/stackflow-next` | `src/next/index.tsx` | Provider, hooks, `StackLink`, `StackLoading`, `StackMotion`. |
| `@uiwwsw/stackflow-next/config` | `src/next/config.ts` | `withStackflow`. |
| `@uiwwsw/stackflow-next/style.css` | `src/next/style.css` | Styles for the Next integration. |
| `@uiwwsw/stackflow-next/dom` | `src/index.js` | `createApelike`, a standalone DOM renderer. |
| `@uiwwsw/stackflow-next/dom/style.css` | `src/style.css` | Styles for the DOM renderer. |

## Source files

### `src/next/` (Next.js integration)

- **`index.tsx`** React surface. `StackflowProvider` renders the header,
  viewport, scrollbar, persistent and footer slots, creates a
  `NavigationEngine`, and wires scroll and swipe handlers. Also exports
  `useStackRouter` (push, replace, back, forward through Next's router while
  the engine records the direction), `StackLink` (wraps `next/link` and routes
  through the engine), `useStackScroll`, `useStack`, `useStackState`,
  `StackLoading`, and a route observer that reports the committed URL.
- **`engine.ts`** `NavigationEngine`, the largest module. It wraps
  `history.pushState` and `replaceState` to give every entry an id and
  position, tracks entries, captures the outgoing DOM, decides the direction
  and kind of motion (page slide, modal, none, query-only skip), starts the
  View Transition, waits for the destination (`waitForPage`,
  `skeletonRoutes`, `navigationTimeout`), recovers entries after Back/Forward,
  keeps swipe previews, stores per-entry values for `useStackState`, and builds
  the `@stackflow/core` stack.
- **`fixed-targets.ts`** Matching of route rules (exact paths and regular
  expressions) and the `fixedTargets` feature. Selected elements get a
  `view-transition-name` so they stay in place while the rest slides.
- **`slide-fallback.ts`** `captureSlide`. Clones the current content and plays
  the slide with CSS animations on the clone when a View Transition cannot be
  used, for example when the viewport height changes before the snapshot is
  ready.
- **`scroll.ts`** Scroll handling for the two modes. Window mode keeps document
  scrolling and measures the visible area; container mode scrolls an element.
  Both draw the custom vertical scrollbar thumb and help the engine save and
  restore offsets.
- **`swipe.ts`** `attachSwipeBack`. Pointer-event gesture starting in the left
  24 px. Moves the live content, reveals a cloned preview of the previous
  screen, and on release either calls `router.back()` or settles back.
- **`motion.tsx`** `StackMotion`. A `div` with `hidden`, `inert` and
  `data-sfn-enter` / `data-sfn-exit` attributes; the CSS does the animation.
- **`skeleton-routes.ts`** Builds the matcher for `skeletonRoutes` (strings,
  `RegExp`, or `{pattern, flags}`).
- **`loading-message.ts`** Built-in "loading" text for ten languages, chosen
  with `Intl.Locale`.
- **`config.ts`** `withStackflow`, described above.
- **`style.css`** Layout of the provider, scroll modes, scrollbar, View
  Transition keyframes (push, pop, modal), fixed-target rules, snapshot
  fallback, and the `data-sfn-*` transitions. Honors
  `prefers-reduced-motion`. Customizable through `--stackflow-duration`,
  `--stackflow-easing`, `--stackflow-background`, `--stackflow-scrollbar-color`.

### `src/` (standalone DOM renderer)

- **`index.js`** `createApelike({root, render, ...})`: keeps a bounded number of
  live DOM screens in a host element, slides between them with
  `element.animate`, restores scroll and focus, and shows a scroll indicator.
  It does not use React, Next.js or Stackflow, and it is not used by the Next
  integration.
- **`index.d.ts`**, **`style.d.ts`**, **`style.css`** Types and styles for it.

### Other directories

- **`test/`** Unit tests for the engine, fixed targets, scroll, swipe,
  loading messages and the DOM renderer. They run in a simulated DOM, not in
  real browsers.
- **`examples/next-app/`** The demo app deployed to the project site. It
  shows the same stay-booking app with and without this package.
- **`scripts/`** `verify-release.mjs` installs the packed tarball in a fresh
  Next.js project to check exports and types. `prepare-demo.mjs` and
  `run-next-fixture.mjs` support the demo and tests.
- **`.github/`** Publish and public-docs check workflows.

## Limits

- Needs Next.js 16.4.6 or later and React 19.3.1 or later; versions below
  that are not tested.
- State retention depends on Next.js Cache Components and can be evicted by
  Next; it does not survive a reload.
- The page slide needs View Transitions for the best result. Browsers without
  them navigate normally.
- Parallel and intercepting routes and real-device mobile gestures are not
  tested. Tests run in a simulated DOM and the demo, not on a device matrix.
- The swipe preview is a DOM clone; canvas, video and embedded content may
  differ from the live screen.
