import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {NavigationEngine,HISTORY_KEY,safeHref} from '../../src/next/engine.ts';
import {createSkeletonRouteMatcher} from '../../src/next/skeleton-routes.ts';
function setup(maxEntries=3){const window=new Window({url:'http://localhost/'});const el=window.document.createElement('main');const engine=new NavigationEngine(window as unknown as globalThis.Window,()=>el as unknown as HTMLElement,{animation:'none',preserveScroll:true,timeout:30,maxEntries});engine.connect();return {engine,window,el};}
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
test('timeout releases pending browser snapshot; reduced-motion path skips snapshots',async()=>{const {engine}=setup();engine.navigate('push','/uncommitted',()=>{});await new Promise(r=>setTimeout(r,50));assert.equal((engine as any).finish,null);engine.dispose();});
test('stale wrappers left beneath framework patches delegate without tagging twice',()=>{const {engine,window}=setup();const stale=window.history.pushState;window.history.pushState=function(...args){return stale.apply(window.history,args);};engine.dispose();const replacement=new NavigationEngine(window as unknown as globalThis.Window,()=>null,{animation:'none',preserveScroll:true,timeout:30,maxEntries:8});replacement.connect();window.history.pushState({__NA:true},'','/b');replacement.commit('/b');assert.equal(window.history.state[HISTORY_KEY].position,1);assert.equal(replacement.entries.size,2);replacement.dispose();});
test('browser forward branch is discarded by a new push; null state is retained',()=>{const {engine,window}=setup(8);engine.write('nullable',null);assert.equal(engine.read('nullable','fallback'),null);window.history.pushState({},'','/b');engine.commit('/b');window.history.pushState({},'','/c');engine.commit('/c');const entry=[...engine.entries.values()].find(e=>e.url==='/b')!;Object.getPrototypeOf(window.history).replaceState.call(window.history,{[HISTORY_KEY]:{id:entry.id,position:entry.position}},'','/b');window.dispatchEvent(new window.PopStateEvent('popstate'));engine.commit('/b');window.history.pushState({},'','/d');engine.commit('/d');assert.equal([...engine.entries.values()].some(e=>e.url==='/c'),false);engine.dispose();});
test('cancelled snapshot callback cannot execute an obsolete navigation',async()=>{const {engine,window}=setup();const callbacks:Array<()=>Promise<void>>=[];(window.document as any).startViewTransition=(callback:any)=>{callbacks.push(callback);return {ready:Promise.resolve(),finished:Promise.resolve(),skipTransition(){}};};engine.options.animation='ios';let route='';engine.navigate('push','/a',()=>{route='a';});engine.navigate('push','/b',()=>{route='b';});await callbacks[0]();assert.equal(route,'');const pending=callbacks[1]();assert.equal(route,'b');engine.dispose();await pending;});
test('a pop route committing before the browser snapshot callback never waits for timeout',async()=>{const {engine,window}=setup();let callback:(()=>Promise<void>)|undefined;(window.document as any).startViewTransition=(fn:any)=>{callback=fn;return {ready:Promise.resolve(),finished:Promise.resolve(),skipTransition(){}};};engine.options.animation='ios';engine.begin('pop','/',()=>{});engine.commit('/');await Promise.race([callback!(),new Promise((_,reject)=>setTimeout(()=>reject(Error('snapshot completion gate registered too late')),10))]);engine.dispose();});

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
    assert.deepEqual(delivered, []);

    replace.call(window.history, detail, '', '/detail');
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: detail }));
    assert.equal(engine.isPending(), true);
    assert.equal(engine.direction, 'push');
    assert.equal(callbacks.length, 2);
    await callbacks[0]();
    assert.deepEqual(delivered, []);
    await callbacks[1]();
    assert.equal(engine.isPending(), false);
    assert.deepEqual(delivered, ['/detail']);
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

test('two quick Back events capture the rendered route when the intermediate entry has no animation', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => null, {
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
    assert.deepEqual(delivered, ['/instant']);
    assert.equal(callbacks.length, 1);
    assert.equal(engine.direction, 'pop');

    const pending = callbacks[0]();
    assert.deepEqual(delivered, ['/instant', '/']);
    engine.commit('/');
    await pending;
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
    const pending = update!();
    engine.commit('/detail/?q=1');
    assert.equal(engine.isPending(), false);
    assert.equal(skipped, false);
    await pending;
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
    const pending = update!();
    engine.commit('/login?returnTo=%2Faccount');
    assert.equal(engine.isPending(), false);
    assert.equal(skipped, true);
    assert.equal(engine.stack?.activities.find(activity => activity.isTop)?.params.url, '/login?returnTo=%2Faccount');
    await pending;
  } finally {
    engine.dispose();
  }
});

test('a route that commits before the new navigation action leaves the new transition pending', async () => {
  const { engine, window } = setup();
  let update: (() => Promise<void>) | undefined;
  (window.document as any).startViewTransition = (callback: () => Promise<void>) => {
    update = callback;
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  engine.options.animation = 'ios';
  try {
    engine.navigate('push', '/latest', () => window.history.pushState({}, '', '/latest'));
    window.history.pushState({}, '', '/earlier');
    engine.commit('/earlier');
    assert.equal(engine.isPending(), true);
    const pending = update!();
    engine.commit('/latest');
    assert.equal(engine.isPending(), false);
    await pending;
  } finally {
    engine.dispose();
  }
});

test('query changes under a base path use ordinary history and ignore legacy query rules', async () => {
  const win = new Window({ url: 'http://localhost/app/detail?city=seoul' });
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => null, {
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
    const opened = update!();
    engine.commit(map);
    await opened;
    assert.equal(engine.current?.url, '/app' + map);
    const mapState = win.history.state;

    const replace = Object.getPrototypeOf(win.history).replaceState;
    for (const [path, state] of [['/detail?city=seoul', detail], [map, mapState]] as const) {
      replace.call(win.history, state, '', '/app' + path);
      win.dispatchEvent(new win.PopStateEvent('popstate', { state }));
      const pending = update!();
      engine.commit(path);
      await pending;
      assert.equal(engine.current?.url, '/app' + path);
    }

    const quiet = '/detail?panel=quiet';
    engine.navigate('push', quiet, () => win.history.pushState({ __NA: true }, '', '/app' + quiet));
    const openedQuiet = update!();
    engine.commit(quiet);
    await openedQuiet;

    const editor = '/editor?draft=1';
    engine.navigate('replace', editor, () => win.history.replaceState({ __NA: true }, '', '/app' + editor));
    const replaced = update!();
    engine.commit(editor);
    await replaced;
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
  const makeEngine = () => new NavigationEngine(win as unknown as globalThis.Window, () => null, {
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
    assert.equal(delivered, 0);
    await Promise.resolve();
    assert.equal(delivered, 1);
    engine.commit('/');
    await callback!();
    assert.equal(delivered, 1);
    assert.equal(engine.isPending(), false);
  } finally {
    engine.dispose();
  }
});

test('Next receives Back and Forward only after the outgoing snapshot is captured', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => null, {
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
      assert.equal(delivered.length, previousCount);
      assert.equal(engine.isPending(), true);
      assert.equal(win.document.documentElement.dataset.stackflowDirection, direction);
      const pending = capture!();
      assert.equal(delivered.length, previousCount + 1);
      assert.deepEqual(delivered.at(-1), state);
      engine.commit(path);
      await pending;
    }
  } finally {
    engine.dispose();
  }
});

test('first Back replays Next state after capture even when the entry lacks Stackflow metadata', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const navigation = { currentEntry: { index: 0 } };
  Object.defineProperty(win, 'navigation', { value: navigation });
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => null, {
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
    assert.equal(delivered.length, 0);
    const back = update!();
    engine.commit('/');
    await back;
    assert.deepEqual(delivered, [initial]);
    assert.equal(engine.read('draft', ''), 'saved before the first push');

    navigation.currentEntry.index = 1;
    replace.call(win.history, detail, '', '/detail');
    win.dispatchEvent(new win.PopStateEvent('popstate', { state: detail }));
    assert.equal(engine.direction, 'push');
    const forward = update!();
    engine.commit('/detail');
    await forward;
    assert.deepEqual(delivered, [initial, detail]);
  } finally {
    engine.dispose();
  }
});

test('the slide waits for a visible loading boundary after the destination commits', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const content = win.document.createElement('main');
  const loading = win.document.createElement('div');
  loading.setAttribute('data-stackflow-loading', '');
  Object.defineProperty(loading, 'getClientRects', { value: () => ({ length: 1 }) });
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => content as unknown as HTMLElement, {
    animation: 'ios', preserveScroll: true, timeout: 500, maxEntries: 3, waitForPage: true,
  });
  let update: (() => Promise<void>) | undefined;
  (win.document as any).startViewTransition = (callback: () => Promise<void>) => {
    update = callback;
    return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition() {} };
  };
  engine.connect();
  try {
    engine.navigate('push', '/slow', () => {
      win.history.pushState({}, '', '/slow');
      content.append(loading);
    });
    assert.equal(engine.isPending(), true);
    const pending = update!();
    engine.commit('/slow');
    assert.equal(engine.isPending(), true);
    loading.remove();
    await pending;
    assert.equal(engine.isPending(), false);
  } finally {
    engine.dispose();
  }
});

test('literal and regex skeleton rules match the app pathname before releasing a loading boundary', async () => {
  const win = new Window({ url: 'http://localhost/shop' });
  const viewport = win.document.createElement('main');
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
      const pending = update!();
      engine.commit(destination);
      assert.equal(engine.isPending(), !showsSkeleton, destination);
      assert.equal(viewport.contains(loading), true);
      loading.remove();
      await pending;
      assert.equal(engine.isPending(), false);
    }
    assert.equal(products.lastIndex, 5);
  } finally {
    engine.dispose();
  }
});

test('modal routes rise on push and Forward and descend on Back', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const engine = new NavigationEngine(win as unknown as globalThis.Window, () => null, {
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
    const opened = update!();
    engine.commit('/compose?draft=1');
    await opened;
    assert.equal(engine.usesNonInteractiveBack(), true);
    const modal = win.history.state;
    const replace = Object.getPrototypeOf(win.history).replaceState;
    for (const [path, state] of [['/', home], ['/compose?draft=1', modal]] as const) {
      replace.call(win.history, state, '', path);
      win.dispatchEvent(new win.PopStateEvent('popstate', { state }));
      const pending = update!();
      engine.commit(path);
      await pending;
    }
    assert.deepEqual(motions, ['enter', 'exit', 'enter']);
  } finally {
    engine.dispose();
  }
});

test('Back keeps sliding when the previous page brings back a fixed navigation bar', async () => {
  const win = new Window({ url: 'http://localhost/' });
  const content = win.document.createElement('main');
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

test('navigation without swipe back does not clone the previous screen', () => {
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

test('a change in the vertical viewport bounds skips the snapshot, not navigation', async () => {
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
    const pending = update!();
    assert.equal(skipped, 0);
    top = 72;
    engine.commit('/detail');
    await pending;
    assert.equal(skipped, 1);
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
