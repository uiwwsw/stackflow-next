import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {NavigationEngine,HISTORY_KEY,safeHref} from '../../src/next/engine.ts';
import {createSkeletonRouteMatcher} from '../../src/next/skeleton-routes.ts';
function mountViewport(win: Window) {
  const frame = win.document.createElement('div');
  const content = win.document.createElement('main');
  content.className = 'stackflow-next-content';
  frame.append(content);
  win.document.body.append(frame);
  return content as unknown as HTMLElement;
}
function setup(maxEntries=3){const window=new Window({url:'http://localhost/'});const el=mountViewport(window);const engine=new NavigationEngine(window as unknown as globalThis.Window,()=>el,{animation:'none',preserveScroll:true,timeout:30,maxEntries});engine.connect();return {engine,window,el};}
test('rejects executable and ambiguous cross-origin destinations',()=>{
  for(const href of ['javascript:alert(1)','https://example.invalid','//example.invalid','http://localhost//example.invalid']) {
    assert.throws(()=>safeHref(href,'http://localhost/'));
  }
  assert.equal(safeHref('http://localhost/a?q=1#part','http://localhost/'),'/a?q=1#part');
});
test('history state preserves Next metadata; Stackflow reflects committed routes',()=>{const {engine,window}=setup();window.history.replaceState({...window.history.state,__NA:true},'');engine.navigate('push','/b',()=>window.history.pushState({__NA:true},'','/b'));engine.commit('/b');assert.equal(window.history.state.__NA,true);assert.ok(window.history.state[HISTORY_KEY]);assert.equal(engine.stack?.activities.find(activity=>activity.isTop)?.params.url,'/b');engine.dispose();});
test('per-entry state and scroll restore after pop with distinct repeated URLs',()=>{const {engine,window,el}=setup();const first=window.history.state;engine.write('draft','hello');el.scrollTop=120;engine.navigate('push','/b',()=>window.history.pushState({},'','/b'));engine.commit('/b');el.scrollTop=0;window.history.replaceState({...window.history.state},'');
// Simulate a browser traversal: native replace bypasses our wrapper, then popstate.
const original=Object.getPrototypeOf(window.history).replaceState;original.call(window.history,first,'','/');window.dispatchEvent(new window.PopStateEvent('popstate',{state:first}));engine.commit('/');assert.equal(engine.read('draft',''), 'hello');assert.equal(el.scrollTop,120);engine.dispose();});
test('metadata and saved state cache remain bounded; disconnect restores methods',()=>{const {engine,window}=setup(2);const wrapped=window.history.pushState;for(let i=1;i<6;i++){window.history.pushState({},'',`/${i}`);engine.commit(`/${i}`);}assert.equal(engine.entries.size,2);engine.dispose();assert.notEqual(window.history.pushState,wrapped);});
test('a navigation with no commit releases its pending state at the deadline', async () => {
  const { engine } = setup();
  engine.navigate('push', '/uncommitted', () => {});
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(engine.isPending(), false);
  engine.dispose();
});
test('stale wrappers left beneath framework patches delegate without tagging twice',()=>{const {engine,window}=setup();const stale=window.history.pushState;window.history.pushState=function(...args){return stale.apply(window.history,args);};engine.dispose();const replacement=new NavigationEngine(window as unknown as globalThis.Window,()=>null,{animation:'none',preserveScroll:true,timeout:30,maxEntries:8});replacement.connect();window.history.pushState({__NA:true},'','/b');replacement.commit('/b');assert.equal(window.history.state[HISTORY_KEY].position,1);assert.equal(replacement.entries.size,2);replacement.dispose();});
test('browser forward branch is discarded by a new push; null state is retained',()=>{const {engine,window}=setup(8);engine.write('nullable',null);assert.equal(engine.read('nullable','fallback'),null);window.history.pushState({},'','/b');engine.commit('/b');window.history.pushState({},'','/c');engine.commit('/c');const entry=[...engine.entries.values()].find(e=>e.url==='/b')!;Object.getPrototypeOf(window.history).replaceState.call(window.history,{[HISTORY_KEY]:{id:entry.id,position:entry.position}},'','/b');window.dispatchEvent(new window.PopStateEvent('popstate'));engine.commit('/b');window.history.pushState({},'','/d');engine.commit('/d');assert.equal([...engine.entries.values()].some(e=>e.url==='/c'),false);engine.dispose();});
test('navigation dispatches immediately and a superseded snapshot cannot reveal the next screen', () => {
  const { engine, window, el } = setup();
  const captures: Array<() => void> = [];
  const dispatched: string[] = [];
  (window.document as any).startViewTransition = (update: () => void) => {
    captures.push(update);
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  engine.options.animation = 'ios';
  function visit(href: string) {
    engine.navigate('push', href, () => {
      dispatched.push(href);
      window.history.pushState({}, '', href);
    });
  }
  try {
    visit('/a');
    assert.deepEqual(dispatched, ['/a']);
    assert.equal(captures.length, 0);
    engine.commit('/a');
    visit('/b');
    assert.deepEqual(dispatched, ['/a', '/b']);
    engine.commit('/b');
    captures[0]();
    assert.equal(el.hasAttribute('data-stackflow-slide-staged'), true);
    captures[1]();
    assert.equal(el.hasAttribute('data-stackflow-slide-staged'), false);
  } finally {
    engine.dispose();
  }
});

test('replace directions animate without adding entries and plain query or hash replacements stay still', async () => {
  const win = new Window({ url: 'http://localhost/app/detail' });
  const viewport = mountViewport(win);
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => viewport, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 8,
  }, () => null, () => [], () => [], () => false, () => [{ href: '/detail', animation: 'ios' }]);
  const directions: (string | undefined)[] = [];
  let capture: (() => Promise<void>) | undefined;
  (win.document as any).startViewTransition = (update: () => Promise<void>) => {
    directions.push(win.document.documentElement.dataset.stackflowDirection);
    capture = update;
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  engine.connect();
  try {
    engine.commit('/detail');
    const entry = win.history.state[HISTORY_KEY];
    const replace = (href: string, direction?: 'push' | 'pop') => engine.navigate('replace', href, () => {
      win.history.replaceState({}, '', '/app' + href);
    }, direction);
    replace('/detail?step=2');
    engine.commit('/detail?step=2');
    replace('/detail?step=2#top');
    assert.deepEqual(directions, []);

    replace('/detail?step=2#bottom', 'pop');
    await capture!(); // Hash-only replacements have no RouteObserver commit.
    assert.equal(engine.isPending(), false);
    replace('/detail?step=3', 'push');
    engine.commit('/detail?step=3');
    await capture!();
    assert.deepEqual(directions, ['pop', 'push']);
    assert.deepEqual(win.history.state[HISTORY_KEY], entry);
    assert.equal(engine.entries.size, 1);
    assert.equal(engine.current?.url, '/app/detail?step=3');
  } finally {
    engine.dispose();
  }
});

test('popup query opt-in preserves Back and Forward entries and skips only popup slides', () => {
  const win = new Window({ url: 'http://localhost/app/main?sort=name&tag=a&tag=b' });
  const viewport = mountViewport(win);
  let queryKeys: readonly string[] = ['popup'];
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => viewport, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 8,
  }, undefined, undefined, undefined, undefined, undefined, () => queryKeys);
  const navigation = Object.assign(new win.EventTarget(), { currentEntry: { index: 0 } });
  Object.defineProperty(win, 'navigation', { value: navigation });
  const slides: (string | undefined)[] = [];
  (win.document as any).startViewTransition = (update: () => void) => {
    slides.push(win.document.documentElement.dataset.stackflowDirection);
    const finished = Promise.resolve().then(update);
    return { ready: finished, finished, skipTransition() {} };
  };
  const delivered: string[] = [];
  win.addEventListener('popstate', () => delivered.push(win.location.search));
  win.history.replaceState({ __NA: true }, '');
  engine.connect();
  try {
    const main = '/main?sort=name&tag=a&tag=b';
    const popup = '/main?tag=a&tag=b&popup=pickup-store&sort=name';
    engine.commit(main);
    const mainEntry = win.history.state;
    const push = (href: string) => {
      engine.navigate('push', href, () => win.history.pushState({ __NA: true }, '', '/app' + href));
      engine.commit(href);
    };
    navigation.currentEntry.index = 1;
    push(popup);
    const popupEntry = win.history.state;
    assert.equal(popupEntry[HISTORY_KEY].position, mainEntry[HISTORY_KEY].position + 1);
    assert.equal(engine.usesNonInteractiveBack(), true);

    const traverse = (href: string, state: unknown, index: number, commitEarly = false) => {
      const url = 'http://localhost/app' + href;
      navigation.dispatchEvent(Object.assign(new win.Event('navigate'), {
        navigationType: 'traverse', destination: { sameDocument: true, url, index },
      }));
      navigation.currentEntry.index = index;
      Object.getPrototypeOf(win.history).replaceState.call(win.history, state, '', url);
      if (commitEarly) engine.commit(href);
      win.dispatchEvent(new win.PopStateEvent('popstate', { state }));
      engine.commit(href);
    };
    engine.navigate('pop', null, () => traverse(main, mainEntry, 0, true));
    assert.equal(engine.current?.id, mainEntry[HISTORY_KEY].id);
    traverse(popup, popupEntry, 1);
    assert.equal(engine.current?.id, popupEntry[HISTORY_KEY].id);
    assert.deepEqual(delivered, ['?sort=name&tag=a&tag=b', '?tag=a&tag=b&popup=pickup-store&sort=name']);
    assert.equal(engine.current?.url, '/app' + popup);
    assert.deepEqual(slides, []);

    push('/main?sort=name&tag=b&tag=a'); // Order matters for repeated non-popup values.
    push('/main?sort=name&tag=b&tag=a&popup=pickup-store#orders');
    push('/other?sort=name&tag=b&tag=a#orders');
    assert.deepEqual(slides, ['push', 'push', 'push']);

    queryKeys = [];
    push('/other?sort=name&tag=b&tag=a&popup=pickup-store#orders');
    assert.deepEqual(slides, ['push', 'push', 'push', 'push']);
  } finally {
    engine.dispose();
  }
});

test('a route commit accepts equivalent URL and search parameter encodings', () => {
  const { engine, window } = setup();
  try {
    const destination = '/search?q=New%20York&empty';
    engine.navigate('push', destination, () => window.history.pushState({}, '', destination));
    assert.equal(window.document.documentElement.dataset.stackflowPending, 'true');

    // Next's useSearchParams().toString() serializes spaces as + and empty values with =.
    engine.commit('/search?q=New+York&empty=');

    assert.equal(window.document.documentElement.dataset.stackflowPending, undefined);
    assert.equal(engine.stack?.activities.find(activity => activity.isTop)?.params.url, destination);
  } finally {
    engine.dispose();
  }
});

test('rapid Back then Forward animates the rendered route without waiting for another commit', async () => {
  const { engine, window, el } = setup();
  const callbacks: Array<() => Promise<void>> = [];
  const delivered: string[] = [];
  window.addEventListener('popstate', () => delivered.push(window.location.pathname));
  (window.document as any).startViewTransition = (callback: () => Promise<void>) => {
    callbacks.push(callback);
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  try {
    window.history.replaceState({ __NA: true }, '');
    const home = window.history.state;
    el.scrollTop = 120;
    window.history.pushState({ __NA: true }, '', '/detail');
    engine.commit('/detail');
    const detail = window.history.state;
    el.scrollTop = 30;
    engine.options.animation = 'ios';
    const replace = Object.getPrototypeOf(window.history).replaceState;
    replace.call(window.history, home, '', '/');
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: home }));
    assert.equal(engine.isPending(), true);
    assert.deepEqual(delivered, ['/']);
    assert.equal(callbacks.length, 0);

    replace.call(window.history, detail, '', '/detail');
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: detail }));
    assert.equal(engine.direction, 'push');
    assert.equal(callbacks.length, 1);
    await callbacks[0]();
    assert.equal(engine.isPending(), false);
    assert.deepEqual(delivered, ['/', '/detail']);
    assert.equal(el.scrollTop, 30);
    assert.equal(engine.entries.get(home[HISTORY_KEY].id)?.scroll, 120);
  } finally {
    engine.dispose();
  }
});

test('Back between entries for the same rendered route plays the reverse slide', async () => {
  const { engine, window, el } = setup();
  const callbacks: Array<() => Promise<void>> = [];
  (window.document as any).startViewTransition = (callback: () => Promise<void>) => {
    callbacks.push(callback);
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  try {
    window.history.replaceState({ __NA: true }, '');
    const first = window.history.state;
    el.scrollTop = 120;
    window.history.pushState({ __NA: true }, '', '/');
    engine.commit('/');
    el.scrollTop = 30;
    engine.options.animation = 'ios';

    Object.getPrototypeOf(window.history).replaceState.call(window.history, first, '', '/');
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: first }));
    assert.equal(engine.direction, 'pop');
    assert.equal(callbacks.length, 1);
    await callbacks[0]();
    assert.equal(engine.isPending(), false);
    assert.equal(el.scrollTop, 120);
  } finally {
    engine.dispose();
  }
});

test('the Navigation API captures the outgoing screen before a browser traversal commits', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const content = win.document.createElement('main');
  win.document.body.append(content);
  const navigation = Object.assign(new win.EventTarget(), { currentEntry: { index: 0 } });
  Object.defineProperty(win, 'navigation', { value: navigation });
  win.history.replaceState({ __NA: true }, '');
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => content as unknown as HTMLElement, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 3,
  });
  let nativeCalls = 0;
  (win.document as any).startViewTransition = () => { nativeCalls++; throw Error('Snapshot unavailable'); };
  engine.connect();
  try {
    const home = win.history.state;
    navigation.currentEntry.index = 1;
    win.history.pushState({ __NA: true }, '', '/detail');
    engine.commit('/detail');
    content.textContent = 'Outgoing detail';

    const event = Object.assign(new win.Event('navigate'), {
      navigationType: 'traverse', destination: { sameDocument: true, url: 'http://localhost/', index: 0 },
      signal: new win.AbortController().signal,
    });
    navigation.dispatchEvent(event);
    navigation.currentEntry.index = 0;
    Object.getPrototypeOf(win.history).replaceState.call(win.history, home, '', '/');
    content.textContent = 'Incoming home';
    engine.commit('/');
    win.dispatchEvent(new win.PopStateEvent('popstate', { state: home }));
    await Promise.resolve();
    const snapshot = win.document.querySelector('[data-stackflow-slide-snapshot=pop]');
    assert.equal(nativeCalls, 0);
    assert.equal(snapshot?.textContent, 'Outgoing detail');
    assert.equal(engine.direction, 'pop');
    assert.equal(engine.isPending(), false);
  } finally {
    engine.dispose();
  }
});

test('two quick Back events capture the rendered route when the intermediate entry has no animation', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const viewport = mountViewport(win);
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => viewport, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 3,
  }, () => null, () => [], () => [], () => false, () => [{ href: '/instant', animation: 'none' }]);
  const callbacks: Array<() => Promise<void>> = [];
  const delivered: string[] = [];
  win.addEventListener('popstate', () => delivered.push(win.location.pathname));
  (win.document as any).startViewTransition = (callback: () => Promise<void>) => {
    callbacks.push(callback);
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  win.history.replaceState({ __NA: true }, '');
  engine.connect();
  try {
    const home = win.history.state;
    win.history.pushState({ __NA: true }, '', '/instant');
    engine.commit('/instant');
    const instant = win.history.state;
    win.history.pushState({ __NA: true }, '', '/detail');
    engine.commit('/detail');

    const replace = Object.getPrototypeOf(win.history).replaceState;
    replace.call(win.history, instant, '', '/instant');
    win.dispatchEvent(new win.PopStateEvent('popstate', { state: instant }));
    assert.deepEqual(delivered, ['/instant']);
    assert.equal(callbacks.length, 0);

    // The router has received the first event but still shows /detail.
    replace.call(win.history, home, '', '/');
    win.dispatchEvent(new win.PopStateEvent('popstate', { state: home }));
    assert.deepEqual(delivered, ['/instant', '/']);
    assert.equal(callbacks.length, 0);
    assert.equal(engine.direction, 'pop');

    engine.commit('/');
    assert.equal(callbacks.length, 1);
    await callbacks[0]();
    assert.equal(engine.isPending(), false);
  } finally {
    engine.dispose();
  }
});

test('a canonical trailing slash does not interrupt the destination transition', async () => {
  const { engine, window } = setup();
  let update: (() => Promise<void>) | undefined;
  let skipped = false;
  (window.document as any).startViewTransition = (callback: () => Promise<void>) => {
    update = callback;
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() { skipped = true; } };
  };
  engine.options.animation = 'ios';
  try {
    engine.navigate('push', '/detail?q=1', () => window.history.pushState({}, '', '/detail/?q=1'));
    engine.commit('/detail/?q=1');
    assert.equal(engine.isPending(), false);
    assert.equal(skipped, false);
    await update!();
  } finally {
    engine.dispose();
  }
});

test('a redirected navigation settles and reflects the committed destination', async () => {
  const { engine, window } = setup();
  let update: (() => Promise<void>) | undefined;
  let skipped = false;
  (window.document as any).startViewTransition = (callback: () => Promise<void>) => {
    update = callback;
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() { skipped = true; } };
  };
  engine.options.animation = 'ios';
  try {
    engine.navigate('push', '/account', () => window.history.pushState({}, '', '/login?returnTo=%2Faccount'));
    engine.commit('/login?returnTo=%2Faccount');
    assert.equal(engine.isPending(), false);
    assert.equal(skipped, false);
    assert.equal(update, undefined);
    assert.equal(engine.stack?.activities.find(activity => activity.isTop)?.params.url, '/login?returnTo=%2Faccount');
  } finally {
    engine.dispose();
  }
});

test('an outgoing route re-render cannot release the incoming navigation', () => {
  const { engine, window } = setup();
  try {
    engine.navigate('push', '/latest', () => {});
    engine.commit('/');
    assert.equal(engine.isPending(), true);
    window.history.pushState({}, '', '/latest');
    engine.commit('/latest');
    assert.equal(engine.isPending(), false);
  } finally {
    engine.dispose();
  }
});

test('query changes under a base path use ordinary history and ignore legacy query rules', async () => {
  const win = new Window({ url: 'http://localhost/app/detail?city=seoul' });
  const viewport = mountViewport(win);
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => viewport, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 8,
  }, () => null, () => [], () => [], () => false, () => [
    { href: '/detail?panel=map', animation: 'modal' },
    { href: '/detail?panel=quiet', animation: 'none' },
    { href: '/editor', animation: 'ios' },
  ]);
  const motion: (string | undefined)[] = [];
  let update: (() => Promise<void>) | undefined;
  (win.document as any).startViewTransition = (callback: () => Promise<void>) => {
    const {stackflowDirection, stackflowModal} = win.document.documentElement.dataset;
    motion.push(stackflowModal ?? stackflowDirection);
    update = callback;
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  win.history.replaceState({ __NA: true }, '');
  engine.connect();
  try {
    engine.commit('/detail?city=seoul');
    assert.throws(() => engine.resolveHref('http://localhost/app//example.invalid'), TypeError);
    const detail = win.history.state;
    const map = '/detail?city=seoul&panel=map';
    engine.navigate('push', map, () => win.history.pushState({ __NA: true }, '', '/app' + map));
    engine.commit(map);
    await update!();
    assert.equal(engine.current?.url, '/app' + map);
    const mapState = win.history.state;

    const replace = Object.getPrototypeOf(win.history).replaceState;
    for (const [path, state] of [['/detail?city=seoul', detail], [map, mapState]] as const) {
      replace.call(win.history, state, '', '/app' + path);
      win.dispatchEvent(new win.PopStateEvent('popstate', { state }));
      engine.commit(path);
      await update!();
      assert.equal(engine.current?.url, '/app' + path);
    }

    const quiet = '/detail?panel=quiet';
    engine.navigate('push', quiet, () => win.history.pushState({ __NA: true }, '', '/app' + quiet));
    engine.commit(quiet);
    await update!();

    const editor = '/editor?draft=1';
    engine.navigate('replace', editor, () => win.history.replaceState({ __NA: true }, '', '/app' + editor));
    engine.commit(editor);
    await update!();
    assert.equal(engine.isPending(), false);
    assert.deepEqual(motion, ['push', 'pop', 'push', 'push', 'push']);
  } finally {
    engine.dispose();
  }
});

test('opening or reloading a page does not animate; in-app push, Back and Forward do', async () => {
  const win = new Window({ url: 'http://localhost/detail' });
  const directions: (string | undefined)[] = [];
  (win.document as any).startViewTransition = (update: () => Promise<void>) => {
    directions.push(win.document.documentElement.dataset.stackflowDirection);
    return { ready: Promise.resolve(), finished: Promise.resolve().then(update), skipTransition() {} };
  };
  const viewport = mountViewport(win);
  const makeEngine = () => new NavigationEngine(win as unknown as globalThis.Window, () => viewport, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 3,
  });
  win.history.replaceState({ __NA: true }, '');
  const first = makeEngine();
  first.connect();
  first.commit('/detail');
  assert.deepEqual(directions, []);
  const detail = win.history.state;
  first.navigate('push', '/next', () => win.history.pushState({ __NA: true }, '', '/next'));
  await Promise.resolve();
  first.commit('/next');
  const next = win.history.state;
  first.dispose();
  assert.deepEqual(directions, ['push']);

  const reloaded = makeEngine();
  try {
    reloaded.connect();
    reloaded.commit('/next');
    assert.deepEqual(directions, ['push']);
    const replace = Object.getPrototypeOf(win.history).replaceState;
    for (const [path, state] of [['/detail', detail], ['/next', next]] as const) {
      replace.call(win.history, state, '', path);
      win.dispatchEvent(new win.PopStateEvent('popstate', { state }));
      await Promise.resolve();
      reloaded.commit(path);
    }
    assert.deepEqual(directions, ['push', 'pop', 'push']);
  } finally {
    reloaded.dispose();
  }
});

test('an aborted browser snapshot still delivers Back once without waiting for the timeout', async () => {
  const { engine, window } = setup();
  let callback: (() => Promise<void>) | undefined;
  let delivered = 0;
  window.addEventListener('popstate', () => { delivered++; });
  try {
    window.history.replaceState({ __NA: true }, '');
    const home = window.history.state;
    window.history.pushState({ __NA: true }, '', '/detail');
    engine.commit('/detail');
    engine.options.animation = 'ios';
    (window.document as any).startViewTransition = (update: () => Promise<void>) => {
      callback = update;
      return {
        ready: Promise.reject(new Error('Capture aborted')),
        finished: new Promise(() => {}),
        skipTransition() {},
      };
    };
    Object.getPrototypeOf(window.history).replaceState.call(window.history, home, '', '/');
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: home }));
    assert.equal(delivered, 1);
    assert.equal(callback, undefined);
    engine.commit('/');
    await callback!();
    assert.equal(delivered, 1);
    assert.equal(engine.isPending(), false);
  } finally {
    engine.dispose();
  }
});

test('Next receives Back and Forward immediately after cloning the outgoing view', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const viewport = mountViewport(win);
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => viewport, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 3,
  });
  const delivered: unknown[] = [];
  win.addEventListener('popstate', event => { delivered.push(event.state); });
  let capture: (() => Promise<void>) | undefined;
  (win.document as any).startViewTransition = (callback: () => Promise<void>) => {
    capture = callback;
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  win.history.replaceState({ __NA: true }, '');
  engine.connect();
  try {
    const first = win.history.state;
    win.history.pushState({ __NA: true }, '', '/detail');
    engine.commit('/detail');
    const second = win.history.state;
    const replace = Object.getPrototypeOf(win.history).replaceState;
    for (const [path, state, direction] of [['/', first, 'pop'], ['/detail', second, 'push']] as const) {
      const previousCount = delivered.length;
      replace.call(win.history, state, '', path);
      win.dispatchEvent(new win.PopStateEvent('popstate', { state }));
      assert.equal(delivered.length, previousCount + 1);
      assert.deepEqual(delivered.at(-1), state);
      assert.equal(engine.isPending(), true);
      assert.equal(win.document.documentElement.dataset.stackflowDirection, direction);
      engine.commit(path);
      await capture!();
    }
  } finally {
    engine.dispose();
  }
});

test('first Back delivers Next state even when the entry lacks Stackflow metadata', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const navigation = { currentEntry: { index: 0 } };
  Object.defineProperty(win, 'navigation', { value: navigation });
  const viewport = mountViewport(win);
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => viewport, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 3,
  });
  const initial = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: ['initial'] } };
  const delivered: unknown[] = [];
  win.addEventListener('popstate', event => delivered.push(event.state));
  engine.connect();
  try {
    engine.write('draft', 'saved before the first push');
    navigation.currentEntry.index = 1;
    win.history.pushState({ __NA: true }, '', '/detail');
    engine.commit('/detail');
    const detail = win.history.state;
    let update: (() => Promise<void>) | undefined;
    (win.document as any).startViewTransition = (callback: () => Promise<void>) => {
      update = callback;
      return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
    };
    const replace = Object.getPrototypeOf(win.history).replaceState;
    navigation.currentEntry.index = 0;
    replace.call(win.history, initial, '', '/');
    win.dispatchEvent(new win.PopStateEvent('popstate', { state: initial }));
    assert.equal(engine.direction, 'pop');
    assert.equal(delivered.length, 1);
    engine.commit('/');
    await update!();
    assert.deepEqual(delivered, [initial]);
    assert.equal(engine.read('draft', ''), 'saved before the first push');

    navigation.currentEntry.index = 1;
    replace.call(win.history, detail, '', '/detail');
    win.dispatchEvent(new win.PopStateEvent('popstate', { state: detail }));
    assert.equal(engine.direction, 'push');
    engine.commit('/detail');
    await update!();
    assert.deepEqual(delivered, [initial, detail]);
  } finally {
    engine.dispose();
  }
});

test('the default slides on the first commit even when StackLoading is visible', () => {
  const { engine, window, el } = setup();
  engine.options.animation = 'ios';
  const loading = window.document.createElement('div');
  loading.setAttribute('data-stackflow-loading', '');
  Object.defineProperty(loading, 'getClientRects', { value: () => ({ length: 1 }) });
  let update: (() => void) | undefined;
  (window.document as any).startViewTransition = (callback: () => void) => {
    update = callback;
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  try {
    engine.navigate('push', '/slow', () => window.history.pushState({}, '', '/slow'));
    assert.equal(window.location.pathname, '/slow');
    assert.equal(update, undefined);
    assert.equal(el.hasAttribute('data-stackflow-slide-staged'), false);
    el.append(loading as unknown as HTMLElement);
    engine.commit('/slow');
    assert.equal(engine.isPending(), false);
    assert.ok(update);
    update();
    assert.equal(el.hasAttribute('data-stackflow-slide-staged'), false);
    assert.equal(el.contains(loading as unknown as HTMLElement), true);
  } finally {
    engine.dispose();
  }
});

test('waitForPage stages the old body after commit without opening a browser snapshot', async () => {
  const { engine, window, el } = setup();
  engine.options.animation = 'ios';
  engine.options.waitForPage = true;
  el.textContent = 'Outgoing page';
  const loading = window.document.createElement('div');
  loading.setAttribute('data-stackflow-loading', '');
  Object.defineProperty(loading, 'getClientRects', { value: () => ({ length: 1 }) });
  let resolveCapture!: (update: () => void) => void;
  const capture = new Promise<() => void>(resolve => { resolveCapture = resolve; });
  let nativeCalls = 0;
  (window.document as any).startViewTransition = (update: () => void) => {
    nativeCalls++;
    resolveCapture(update);
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  try {
    engine.navigate('push', '/slow', () => window.history.pushState({}, '', '/slow'));
    assert.equal(nativeCalls, 0);
    el.replaceChildren(loading as unknown as HTMLElement);
    engine.commit('/slow');
    const snapshot = window.document.querySelector('[data-stackflow-slide-snapshot]');
    assert.equal(snapshot?.textContent, 'Outgoing page');
    assert.equal(engine.isPending(), true);
    assert.equal(nativeCalls, 0);
    loading.replaceWith('Destination page');
    const update = await capture;
    assert.equal(engine.isPending(), false);
    update();
    assert.equal(snapshot?.isConnected, false);
    assert.equal(el.hasAttribute('data-stackflow-slide-staged'), false);
  } finally {
    engine.dispose();
  }
});

test('the wait deadline reveals a committed loading screen', async () => {
  const { engine, window, el } = setup();
  engine.options.animation = 'ios';
  engine.options.waitForPage = true;
  const loading = window.document.createElement('div');
  loading.setAttribute('data-stackflow-loading', '');
  Object.defineProperty(loading, 'getClientRects', { value: () => ({ length: 1 }) });
  const capture = new Promise<() => void>(resolve => {
    (window.document as any).startViewTransition = (update: () => void) => {
      resolve(update);
      return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
    };
  });
  try {
    engine.navigate('push', '/slow', () => window.history.pushState({}, '', '/slow'));
    el.append(loading as unknown as HTMLElement);
    engine.commit('/slow');
    assert.equal(engine.isPending(), true);
    const update = await capture;
    update();
    assert.equal(engine.isPending(), false);
    assert.equal(el.hasAttribute('data-stackflow-slide-staged'), false);
  } finally {
    engine.dispose();
  }
});

test('literal and regex skeleton rules match the app pathname before releasing a loading boundary', async () => {
  const win = new Window({ url: 'http://localhost/shop' });
  const viewport = win.document.createElement('main');
  win.document.body.append(viewport);
  const loading = win.document.createElement('div');
  loading.setAttribute('data-stackflow-loading', '');
  Object.defineProperty(loading, 'getClientRects', { value: () => ({ length: 1 }) });
  const getViewport = () => viewport as unknown as HTMLElement;
  const products = /^\/products\/\d+$/gy;
  products.lastIndex = 5;
  const engine = new NavigationEngine(win as unknown as globalThis.Window, getViewport, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 3, waitForPage: true,
  }, getViewport, () => [], () => [], createSkeletonRouteMatcher([
    '/skeleton', '/legacy-skeleton?q=one', products, { pattern: '^/ORDERS/\\d+$', flags: 'i' },
  ]));
  let update: (() => Promise<void>) | undefined;
  (win.document as any).startViewTransition = (callback: () => Promise<void>) => {
    update = callback;
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  engine.connect();
  try {
    engine.commit('/');
    const destinations = [
      ['/skeleton?city=seoul&q=one', true],
      ['/products/123/?sort=name#reviews', true],
      ['/products/456?sort=price', true],
      ['/orders/5', true],
      ['/products/new?redirect=/products/2', false],
      ['/legacy-skeleton?q=one', false],
    ] as const;
    for (const [destination, showsSkeleton] of destinations) {
      engine.navigate('push', destination, () => {
        win.history.pushState({}, '', `/shop${destination}`);
        viewport.append(loading);
      });
      update = undefined;
      engine.commit(destination);
      assert.equal(engine.isPending(), !showsSkeleton, destination);
      assert.equal(viewport.contains(loading), true);
      loading.remove();
      if (!showsSkeleton) await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(update, destination);
      await update();
      assert.equal(engine.isPending(), false);
    }
    assert.equal(products.lastIndex, 5);
  } finally {
    engine.dispose();
  }
});

test('modal routes rise on push and Forward and descend on Back', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const viewport = mountViewport(win);
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => viewport, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 3,
  }, () => null, () => [], () => ['/compose']);
  const motions: (string | undefined)[] = [];
  let update: (() => Promise<void>) | undefined;
  (win.document as any).startViewTransition = (callback: () => Promise<void>) => {
    motions.push(win.document.documentElement.dataset.stackflowModal);
    update = callback;
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  win.history.replaceState({ __NA: true }, '');
  engine.connect();
  try {
    const home = win.history.state;
    engine.navigate('push', '/compose?draft=1', () => win.history.pushState({ __NA: true }, '', '/compose?draft=1'));
    engine.commit('/compose?draft=1');
    await update!();
    assert.equal(engine.usesNonInteractiveBack(), true);
    const modal = win.history.state;
    const replace = Object.getPrototypeOf(win.history).replaceState;
    for (const [path, state] of [['/', home], ['/compose?draft=1', modal]] as const) {
      replace.call(win.history, state, '', path);
      win.dispatchEvent(new win.PopStateEvent('popstate', { state }));
      engine.commit(path);
      await update!();
    }
    assert.deepEqual(motions, ['enter', 'exit', 'enter']);
  } finally {
    engine.dispose();
  }
});

test('a keyed fixed bar joins both snapshots after the destination finishes loading', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const content = win.document.createElement('main');
  const makeBar = () => {
    const nav = win.document.createElement('nav');
    nav.setAttribute('data-stackflow-fixed-key', 'bottom-bar');
    nav.getBoundingClientRect = () => new win.DOMRect(0, 560, 400, 40);
    Object.defineProperty(nav, 'getClientRects', { value: () => ({ length: 1 }) });
    return nav;
  };
  const source = makeBar();
  const destination = makeBar();
  const loading = win.document.createElement('div');
  loading.setAttribute('data-stackflow-loading', '');
  Object.defineProperty(loading, 'getClientRects', { value: () => ({ length: 1 }) });
  source.style.setProperty('view-transition-name', 'source-name', 'important');
  destination.style.setProperty('view-transition-name', 'destination-name');
  content.getBoundingClientRect = () => new win.DOMRect(0, 0, 400, 600);
  content.append(source);
  win.document.body.append(content);
  Object.defineProperty(win, 'CSS', { value: { supports: () => true } });
  const viewport = () => content as unknown as HTMLElement;
  const engine = new NavigationEngine(win as unknown as globalThis.Window, viewport, {
    animation: 'ios', preserveScroll: true, timeout: 500, maxEntries: 3, waitForPage: true,
  }, viewport, () => ['nav']);
  const name = (element: typeof source) => element.style.getPropertyValue('view-transition-name');
  let capture: (() => Promise<void>) | undefined;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  let skipped = false;
  (win.document as any).startViewTransition = (update: () => Promise<void>) => {
    capture = update;
    return { ready: Promise.resolve(), finished, skipTransition() { skipped = true; } };
  };
  engine.connect();
  try {
    engine.navigate('push', '/orders', () => {
      win.history.pushState({}, '', '/orders');
      content.replaceChildren(loading);
      engine.commit('/orders');
    });
    assert.equal(capture, undefined);
    assert.equal(engine.isPending(), true);
    assert.equal(skipped, false);
    loading.replaceWith(destination);
    await new Promise(resolve => setTimeout(resolve, 10));
    const clone = win.document.querySelector<HTMLElement>('[data-stackflow-slide-snapshot] nav')!;
    const outgoingName = name(clone as unknown as typeof source);
    assert.match(outgoingName, /^stackflow-next-fixed-/);
    await capture!();
    assert.equal(skipped, false);
    assert.equal(name(destination), outgoingName);
    assert.equal(name(source), 'source-name');
    assert.equal(source.style.getPropertyPriority('view-transition-name'), 'important');
    finish();
    await finished;
    await Promise.resolve();
    assert.equal(name(destination), 'destination-name');
    for (const bar of [source, destination]) assert.equal(bar.hasAttribute('data-stackflow-fixed-target'), false);
  } finally {
    engine.dispose();
  }
});

test('Back keeps sliding when the previous page brings back a fixed navigation bar', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const content = win.document.createElement('main');
  win.document.body.append(content);
  const nav = win.document.createElement('nav');
  content.getBoundingClientRect = () => new win.DOMRect(0, 0, 400, 600);
  nav.getBoundingClientRect = () => new win.DOMRect(0, 0, 400, 40);
  Object.defineProperty(nav, 'getClientRects', { value: () => ({ length: 1 }) });
  const viewport = () => content as unknown as HTMLElement;
  const engine = new NavigationEngine(win as unknown as globalThis.Window, viewport, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 3,
  }, viewport, () => ['nav']);
  win.history.replaceState({ __NA: true }, '');
  engine.connect();
  try {
    const home = win.history.state;
    win.history.pushState({ __NA: true }, '', '/checkout');
    engine.commit('/checkout');

    let capture: (() => Promise<void>) | undefined;
    let skipped = false;
    (win.document as any).startViewTransition = (callback: () => Promise<void>) => {
      capture = callback;
      return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() { skipped = true; } };
    };
    win.addEventListener('popstate', () => {
      content.append(nav);
      engine.commit('/');
    });

    Object.getPrototypeOf(win.history).replaceState.call(win.history, home, '', '/');
    win.dispatchEvent(new win.PopStateEvent('popstate', { state: home }));
    await capture!();
    assert.equal(engine.direction, 'pop');
    assert.equal(nav.parentElement, content);
    assert.equal(nav.hasAttribute('data-stackflow-fixed-target'), false);
    assert.equal(skipped, false);
  } finally {
    engine.dispose();
  }
});

test('Back captures the whole page when an outgoing fixed target is clipped', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const content = win.document.createElement('main');
  win.document.body.append(content);
  const nav = win.document.createElement('nav');
  content.getBoundingClientRect = () => new win.DOMRect(0, 0, 400, 600);
  nav.getBoundingClientRect = () => new win.DOMRect(0, -20, 400, 40);
  Object.defineProperty(nav, 'getClientRects', { value: () => ({ length: 1 }) });
  const viewport = () => content as unknown as HTMLElement;
  const engine = new NavigationEngine(win as unknown as globalThis.Window, viewport, {
    animation: 'ios', preserveScroll: true, timeout: 100, maxEntries: 3,
  }, viewport, () => ['nav']);
  win.history.replaceState({ __NA: true }, '');
  engine.connect();
  try {
    const home = win.history.state;
    win.history.pushState({ __NA: true }, '', '/checkout');
    engine.commit('/checkout');

    content.append(nav);
    Object.defineProperty(win, 'CSS', { value: { supports: () => true } });
    let capture: (() => Promise<void>) | undefined;
    let skipped = false;
    (win.document as any).startViewTransition = (callback: () => Promise<void>) => {
      capture = callback;
      return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() { skipped = true; } };
    };
    win.addEventListener('popstate', () => {
      engine.commit('/');
    });

    Object.getPrototypeOf(win.history).replaceState.call(win.history, home, '', '/');
    win.dispatchEvent(new win.PopStateEvent('popstate', { state: home }));
    assert.ok(capture);
    await capture();
    assert.equal(engine.direction, 'pop');
    assert.equal(nav.parentElement, content);
    assert.equal(nav.hasAttribute('data-stackflow-fixed-target'), false);
    assert.equal(skipped, false);
  } finally {
    engine.dispose();
  }
});

test('navigation without animation or swipe back does not clone the previous screen', () => {
  const { engine, window, el } = setup();
  try {
    let clones = 0;
    const cloneNode = el.cloneNode.bind(el);
    el.cloneNode = deep => { clones++; return cloneNode(deep); };
    engine.navigate('push', '/detail', () => window.history.pushState({}, '', '/detail'));
    engine.commit('/detail');
    assert.equal(clones, 0);
    assert.equal(engine.previousVisual(), undefined);
  } finally {
    engine.dispose();
  }
});

test('swipe back keeps a preview of the previous screen after Back in a deep stack', async () => {
  const { engine, window, el } = setup(16);
  window.document.body.append(el);
  engine.setSwipeBackEnabled(true);
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  const visit = (path: string) => {
    engine.navigate('push', path, () => window.history.pushState({}, '', path));
    el.textContent = path;
    engine.commit(path);
  };
  try {
    el.textContent = '/';
    for (const path of ['/a', '/b', '/c', '/d', '/e', '/f']) visit(path);
    assert.equal(engine.previousVisual()?.textContent, '/e');
    for (const path of ['/e', '/d', '/c']) {
      window.history.back();
      await settle();
      el.textContent = path;
      engine.commit(path);
      const expected = `/${String.fromCharCode(path.charCodeAt(1) - 1)}`;
      assert.equal(engine.previousVisual()?.textContent, expected, `preview below ${path}`);
    }
    const retained = [...engine.entries.values()].filter(entry => entry.visual).length;
    assert.ok(retained <= 4, `retained ${retained} previews`);
  } finally {
    engine.dispose();
  }
});

test('snapshot styles are active before capture and clear if starting a transition fails', () => {
  const { engine, window } = setup();
  const root = window.document.documentElement;
  let captureStyle: string | undefined;
  (window.document as any).startViewTransition = () => {
    captureStyle = root.dataset.stackflowAnimating;
    throw new Error('Transition unavailable');
  };
  engine.options.animation = 'ios';
  try {
    engine.navigate('push', '/detail', () => window.history.pushState({}, '', '/detail'));
    engine.commit('/detail');
    assert.equal(captureStyle, 'true');
    assert.equal(root.dataset.stackflowAnimating, undefined);
    assert.equal(window.location.pathname, '/detail');
  } finally {
    engine.dispose();
  }
});

test('a change in viewport bounds uses the CSS slide and still commits navigation', async () => {
  const { engine, window, el } = setup();
  let top = 48;
  let skipped = 0;
  el.getBoundingClientRect = () => new window.DOMRect(0, top, 400, 500 - top);
  let update: (() => Promise<void>) | undefined;
  (window.document as any).startViewTransition = (callback: () => Promise<void>) => {
    update = callback;
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() { skipped++; } };
  };
  engine.options.animation = 'ios';
  try {
    engine.navigate('push', '/detail', () => window.history.pushState({}, '', '/detail'));
    top = 72;
    engine.commit('/detail');
    assert.equal(update, undefined);
    assert.equal(skipped, 0);
    assert.equal(el.dataset.stackflowSlideIncoming, 'push');
    assert.equal(window.location.pathname, '/detail');
  } finally {
    engine.dispose();
  }
});

test('back restores the selected region and keeps its position in the swipe preview', () => {
  const win = new Window({ url: 'http://localhost/' });
  const body = win.document.createElement('div');
  const target = win.document.createElement('main');
  body.append(target);
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => body as unknown as HTMLElement,
    { animation: 'none', preserveScroll: true, timeout: 30, maxEntries: 3 }, () => target as unknown as HTMLElement);
  engine.connect();
  engine.setSwipeBackEnabled(true);
  try {
    const first = win.history.state;
    body.scrollTop = 15;
    target.scrollTop = 123;
    engine.navigate('push', '/detail', () => win.history.pushState({}, '', '/detail'));
    engine.commit('/detail');
    assert.equal(target.scrollTop, 0);
    assert.equal(engine.previousVisual()?.dataset.stackflowScroll, '123');

    Object.getPrototypeOf(win.history).replaceState.call(win.history, first, '', '/');
    win.dispatchEvent(new win.PopStateEvent('popstate', { state: first }));
    engine.commit('/');
    assert.equal(target.scrollTop, 123);
    assert.equal(body.scrollTop, 15);
  } finally {
    engine.dispose();
  }
});
