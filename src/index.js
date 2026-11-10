/** A bounded cache of live DOM screens. Import apelike/style.css once. */
export function createApelike({root, render, maxRetained = 3, duration = 260, interaction = true, onError = console.error} = {}) {
  const host = typeof root === 'string' ? document.querySelector(root) : root;
  if (!host || typeof render !== 'function') throw new TypeError('root and render are required');
  if (!Number.isInteger(maxRetained) || maxRetained < 1) throw new RangeError('maxRetained must be a positive integer');
  if (!Number.isFinite(duration) || duration < 0) throw new RangeError('duration must be nonnegative');
  const doc = host.ownerDocument, win = doc.defaultView;
  const original = [...host.childNodes];
  const stack = doc.createElement('div'); stack.className = 'apelike-stack';
  if (interaction) stack.classList.add('apelike-touch');
  const indicator = doc.createElement('div'); indicator.className = 'apelike-indicator'; indicator.setAttribute('aria-hidden','true');
  stack.append(indicator); host.replaceChildren(stack);
  let entries = [], index = -1, destroyed = false, queue = Promise.resolve(), timer;
  function updateIndicator() {
    const el = entries[index]?.element;
    if (!el) return;
    const height = el.clientHeight, total = el.scrollHeight;
    const thumb = Math.min(height, Math.max(24, height * height / total));
    indicator.style.height = `${thumb}px`;
    indicator.style.transform = `translateY(${total > height ? el.scrollTop / (total-height) * (height-thumb) : 0}px)`;
    indicator.style.opacity = total > height ? '1' : '0';
    win.clearTimeout(timer); timer = win.setTimeout(() => { indicator.style.opacity = '0'; }, 700);
  }
  const observer = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(updateIndicator) : null;
  observer?.observe(stack);
  function dispose(entry) {
    if (!entry.element) return;
    observer?.unobserve(entry.element); entry.element.removeEventListener('scroll', updateIndicator);
    entry.element.remove(); entry.element = null; entry.focus = null;
    const cleanup = entry.cleanup; entry.cleanup = null;
    try { cleanup?.(); } catch (error) { onError(error); }
  }
  async function mount(entry) {
    if (entry.element) return;
    const el = doc.createElement('section'); el.className = 'apelike-screen';
    const result = await render(entry.route, {restored: entry.visited, state: entry.state});
    const node = result?.element ?? result;
    if (!node || node.nodeType !== 1) throw new TypeError('render must return an Element or {element, dispose}');
    if (destroyed) { result?.dispose?.(); throw new Error('Apelike is destroyed'); }
    el.append(node); entry.element = el; entry.cleanup = result?.dispose; entry.visited = true;
    el.hidden = true; el.inert = true; stack.insertBefore(el, indicator);
    el.addEventListener('scroll', updateIndicator, {passive:true}); observer?.observe(el);
  }
  async function transition(next, direction) {
    await mount(next);
    const previous = entries[index];
    if (previous?.element) { previous.scroll = previous.element.scrollTop; previous.focus = doc.activeElement; previous.element.inert = true; }
    const incoming = next.element; incoming.hidden = false; incoming.inert = false; incoming.scrollTop = next.scroll;
    incoming.style.zIndex = direction > 0 ? '2' : '1';
    const outgoing = previous?.element;
    if (outgoing) outgoing.style.zIndex = direction > 0 ? '1' : '2';
    try {
      if (outgoing && incoming.animate && !win.matchMedia('(prefers-reduced-motion: reduce)').matches && duration) {
        const frames = direction > 0 ? [['100%','0%'],['0%','-25%']] : [['-25%','0%'],['0%','100%']];
        await Promise.all([incoming,outgoing].map((el,i) => {
          const animation = el.animate(frames[i].map(x=>({transform:`translateX(${x})`})),{duration,easing:'cubic-bezier(.2,.7,.2,1)'});
          return animation.finished.catch(()=>{});
        }));
      }
    } finally {
      if (outgoing) { outgoing.hidden = true; outgoing.inert = true; outgoing.style.zIndex = ''; }
      incoming.style.zIndex = '';
    }
  }
  function enqueue(fn) {
    const pending = queue.then(() => { if (destroyed) throw new Error('Apelike is destroyed'); return fn(); });
    queue = pending.catch(()=>{}); return pending;
  }
  function settle() {
    const retained = entries.filter(e=>e.element && e!==entries[index]).sort((a,b)=>b.used-a.used);
    retained.slice(maxRetained-1).forEach(dispose);
    entries[index].used = Date.now();
    const active = entries[index];
    const focus = active.focus?.isConnected ? active.focus : active.element.querySelector('[autofocus]');
    if (focus?.focus) focus.focus({preventScroll:true});
    else { active.element.tabIndex = -1; active.element.focus({preventScroll:true}); }
    updateIndicator();
  }
  return {
    push(route, state) { return enqueue(async()=>{
      const entry = {route,state,scroll:0,visited:false,used:0};
      try { await transition(entry,1); } catch(error) { dispose(entry); throw error; }
      entries.splice(index+1).forEach(dispose); entries.push(entry); index++; settle();
    }); },
    back() { return enqueue(async()=>{ if(index<1) return false; await transition(entries[index-1],-1); index--; settle(); return true; }); },
    forward() { return enqueue(async()=>{ if(index+1>=entries.length) return false; await transition(entries[index+1],1); index++; settle(); return true; }); },
    replace(route,state) { return enqueue(async()=>{
      const entry={route,state,scroll:0,visited:false,used:0};
      try { await transition(entry,1); } catch(error) { dispose(entry); throw error; }
      if(index<0){entries.push(entry);index=0;} else {dispose(entries[index]);entries[index]=entry;} settle();
    }); },
    get state() { return {index, routes:entries.map(e=>e.route), retained:entries.filter(e=>e.element).length}; },
    async destroy() { destroyed=true; await queue; entries.forEach(dispose); observer?.disconnect(); win.clearTimeout(timer); stack.remove(); host.append(...original); entries=[]; index=-1; }
  };
}
