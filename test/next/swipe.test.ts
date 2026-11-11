import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {NavigationEngine} from '../../src/next/engine.ts';
import {attachSwipeBack} from '../../src/next/swipe.ts';
function setup(){const w=new Window({url:'http://localhost/'});const parent=w.document.createElement('div'),el=w.document.createElement('div');parent.append(el);w.document.body.append(parent);(el as any).animate=undefined;el.innerHTML='<input id="draft" value="saved"/><p>Previous screen</p>';Object.defineProperty(el,'clientWidth',{value:400});const engine=new NavigationEngine(w as any,()=>el as any,{animation:'none',preserveScroll:true,timeout:100,maxEntries:8});engine.connect();engine.setSwipeBackEnabled(true);engine.navigate('push','/b',()=>w.history.pushState({},'','/b'));engine.commit('/b');let backs=0;const detach=attachSwipeBack(engine,el as any,()=>backs++);function pointer(type:string,x:number,y=0){el.dispatchEvent(new w.PointerEvent(type,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,bubbles:true,cancelable:true}));}return {engine,el,parent,pointer,detach,backs:()=>backs};}
test('swipe follows pointer and cancellation restores the current screen',async()=>{const s=setup();s.pointer('pointerdown',2);s.pointer('pointermove',160);assert.equal(s.el.style.transform,'translateX(158px)');assert.equal(s.parent.querySelector('[aria-hidden=true]')?.querySelector('[id]'),null);s.pointer('pointercancel',160);await Promise.resolve();assert.equal(s.backs(),0);assert.equal(s.el.style.transform,'');assert.equal(s.parent.children.length,1);s.detach();s.engine.dispose();});
test('completed swipe requests one back; cleanup releases preview and transforms',async()=>{const s=setup();s.pointer('pointerdown',2);s.pointer('pointermove',200);s.pointer('pointerup',200);await Promise.resolve();assert.equal(s.backs(),1);assert.equal(s.engine.skipNextPopAnimation,true);s.detach();assert.equal(s.parent.children.length,1);assert.equal(s.el.style.transform,'');s.engine.dispose();});
test('vertical scroll and gestures outside the left edge do not navigate',()=>{const s=setup();s.pointer('pointerdown',50);s.pointer('pointermove',250);assert.equal(s.parent.children.length,1);s.pointer('pointerdown',2);s.pointer('pointermove',5,50);assert.equal(s.parent.children.length,1);assert.equal(s.backs(),0);s.detach();s.engine.dispose();});

test('an edge press does not mount the previous screen before horizontal intent', () => {
  const { engine, parent, pointer, detach, backs } = setup();
  try {
    pointer('pointerdown', 2);
    assert.equal(parent.children.length, 1, 'pressing the edge must leave only the active screen');
    pointer('pointermove', 7);
    assert.equal(parent.children.length, 1, 'subthreshold motion must not show a preview');
    pointer('pointerup', 7);
    assert.equal(backs(), 0);
  } finally {
    detach();
    engine.dispose();
  }
});

test('edge swipe with fixed targets navigates on release without moving the live DOM', () => {
  const { engine, el, parent, pointer, detach, backs } = setup();
  engine.hasFixedTargets = () => true;
  try {
    pointer('pointerdown', 2);
    pointer('pointermove', 200);
    assert.equal(parent.children.length, 1);
    assert.equal(el.style.transform, '');
    assert.equal(backs(), 0);
    pointer('pointerup', 200);
    assert.equal(backs(), 1);
    assert.equal(engine.skipNextPopAnimation, false);
  } finally {
    detach();
    engine.dispose();
  }
});
