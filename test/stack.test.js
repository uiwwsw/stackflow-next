import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createApelike} from '../src/index.js';
function setup(maxRetained=3){
 const window=new Window(), root=window.document.createElement('main'); window.document.body.append(root);
 const disposed=[], contexts=[];
 const app=createApelike({root,maxRetained,duration:0,render(route,ctx){
  contexts.push([route,ctx]); if(route==='bad') throw Error('failed');
  const element=window.document.createElement('input'); element.value=route;
  return {element,dispose(){disposed.push(route);}};
 }});
 return {window,root,app,disposed,contexts};
}
test('retains actual input DOM and scroll across back/forward',async()=>{
 const {app,root}=setup(); await app.push('a'); const input=root.querySelector('input'); input.value='edited'; input.parentElement.scrollTop=123;
 await app.push('b'); await app.back(); assert.equal(root.querySelector('.apelike-screen:not([hidden]) input'),input); assert.equal(input.value,'edited'); assert.equal(input.parentElement.scrollTop,123);
 assert.equal(await app.forward(),true); await app.destroy();
});
test('bounds DOM retention and reports remount with supplied state',async()=>{
 const {app,contexts,disposed}=setup(1); await app.push('a',{draft:'saved'}); await app.push('b'); assert.equal(app.state.retained,1); assert.deepEqual(disposed,['a']);
 await app.back(); assert.deepEqual(contexts.at(-1),['a',{restored:true,state:{draft:'saved'}}]); await app.destroy();
});
test('serializes navigation and clears forward history on a branch',async()=>{
 const {app}=setup(); await Promise.all([app.push('a'),app.push('b'),app.push('c')]); await app.back(); await app.push('d'); assert.deepEqual(app.state.routes,['a','b','d']); assert.equal(await app.forward(),false); await app.destroy();
});
test('render failure preserves current screen and queue remains usable',async()=>{
 const {app,root}=setup(); await app.push('a'); await assert.rejects(app.push('bad')); assert.deepEqual(app.state.routes,['a']); assert.equal(root.querySelector('.apelike-screen').hidden,false); await app.push('b'); await app.destroy();
});
test('replace disposes old entry; destroy restores host nodes and rejects operations',async()=>{
 const {app,root,disposed}=setup(); await app.push('a'); await app.replace('b'); assert.deepEqual(app.state.routes,['b']); assert.deepEqual(disposed,['a']); await app.destroy(); assert.equal(root.children.length,0); await assert.rejects(app.push('c'));
});
