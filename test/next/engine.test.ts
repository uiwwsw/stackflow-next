import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {NavigationEngine,HISTORY_KEY,safeHref} from '../../src/next/engine.ts';
function setup(maxEntries=3){const window=new Window({url:'http://localhost/'});const el=window.document.createElement('main');const engine=new NavigationEngine(window as unknown as globalThis.Window,()=>el as unknown as HTMLElement,{animation:'none',preserveScroll:true,timeout:30,maxEntries});engine.connect();return {engine,window,el};}
test('rejects executable and cross-origin destinations',()=>{for(const href of ['javascript:alert(1)','https://evil.example','//evil.example'])assert.throws(()=>safeHref(href,'http://localhost/'));assert.equal(safeHref('/a?q=1#part','http://localhost/'),'/a?q=1#part');});
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
  const first = makeEngine();
  first.connect();
  first.commit('/detail');
  assert.deepEqual(directions, []);
  const detail = win.history.state;
  first.navigate('push', '/next', () => win.history.pushState({}, '', '/next'));
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
      reloaded.commit(path);
    }
    assert.deepEqual(directions, ['push', 'pop', 'push']);
  } finally {
    reloaded.dispose();
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
