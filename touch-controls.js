/*
 * Shared touch controls for the homeschool games.
 *
 * Adds a "back to all games" button, plus on-screen joysticks and buttons that
 * press the same keyboard keys the game already listens for. Games need no
 * changes to their own input code.
 *
 *   <script src="../touch-controls.js"></script>
 *   <script>
 *     TouchControls({
 *       back: 'top-left',                       // or 'top-right'
 *       backCompact: true,                      // round arrow only, for tight corners
 *       bottom: 16,                             // px gap from the bottom edge
 *       zones: [
 *         { side: 'left',  when: () => true, items: [
 *             { stick: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' } } ] },
 *         { side: 'right', items: [ { label: 'Jump', code: 'Space', big: true } ] },   // big / mid / small; tap: true for one-shot keys
 *         { side: 'top-right', items: [ { label: '❚❚', code: 'KeyP', small: true } ] },
 *       ],
 *     });
 *   </script>
 *
 * Touch controls show on touch screens (or with ?touch=1 in the URL).
 */
(function () {
  const CSS = `
  .tc-back, .tc-btn, .tc-stick { all: unset; box-sizing: border-box; -webkit-user-select: none; user-select: none;
    -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; touch-action: none; }
  .tc-back { position: fixed; z-index: 2147483000; top: calc(10px + env(safe-area-inset-top, 0px));
    display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px 0 10px; border-radius: 999px;
    background: rgba(15, 20, 30, .72); color: #fff; font: 600 14px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
    border: 1.5px solid rgba(255, 255, 255, .35); cursor: pointer; text-decoration: none; backdrop-filter: blur(4px); }
  .tc-back:hover, .tc-back:focus-visible { background: rgba(15, 20, 30, .9); outline: 2px solid #fff; outline-offset: 2px; }
  .tc-back.compact { width: 44px; height: 44px; padding: 0; justify-content: center; font-size: 20px; }
  .tc-back.tl { left: calc(10px + env(safe-area-inset-left, 0px)); }
  .tc-back.tr { right: calc(10px + env(safe-area-inset-right, 0px)); }
  .tc-zone { position: fixed; z-index: 2147482000; display: none; align-items: flex-end; gap: 14px; pointer-events: none; }
  .tc-on .tc-zone.tc-show { display: flex; }
  .tc-zone > * { pointer-events: auto; }
  .tc-zone.left { left: calc(16px + env(safe-area-inset-left, 0px)); }
  .tc-zone.right { right: calc(16px + env(safe-area-inset-right, 0px)); flex-direction: row; }
  .tc-zone.top-right { right: calc(10px + env(safe-area-inset-right, 0px)); top: calc(10px + env(safe-area-inset-top, 0px)); align-items: flex-start; }
  .tc-btn { display: flex; align-items: center; justify-content: center; text-align: center; width: 72px; height: 72px;
    border-radius: 50%; background: rgba(10, 15, 25, .45); border: 2px solid rgba(255, 255, 255, .8); color: #fff;
    font: 700 15px/1.1 system-ui, -apple-system, "Segoe UI", sans-serif; text-shadow: 0 1px 2px rgba(0, 0, 0, .7);
    box-shadow: 0 2px 8px rgba(0, 0, 0, .25); cursor: pointer; }
  .tc-btn.big { width: 92px; height: 92px; font-size: 17px; }
  .tc-btn.mid { width: 58px; height: 58px; font-size: 14px; }
  .tc-btn.small { width: 44px; height: 44px; font-size: 15px; }
  .tc-btn.down { background: rgba(255, 255, 255, .55); color: #111; text-shadow: none; transform: scale(.94); }
  .tc-stick { position: relative; width: 132px; height: 132px; border-radius: 50%; background: rgba(10, 15, 25, .35);
    border: 2px solid rgba(255, 255, 255, .75); box-shadow: 0 2px 8px rgba(0, 0, 0, .25); }
  .tc-knob { position: absolute; left: 50%; top: 50%; width: 58px; height: 58px; margin: -29px 0 0 -29px; border-radius: 50%;
    background: rgba(255, 255, 255, .65); border: 2px solid #fff; pointer-events: none; }
  .tc-hint { position: absolute; inset: 0; pointer-events: none; color: rgba(255, 255, 255, .85); font: 700 12px system-ui, sans-serif; }
  .tc-hint span { position: absolute; text-shadow: 0 1px 2px rgba(0, 0, 0, .7); }
  @media (max-height: 420px) {
    .tc-btn { width: 62px; height: 62px; } .tc-btn.big { width: 78px; height: 78px; } .tc-btn.mid { width: 52px; height: 52px; } .tc-btn.small { width: 40px; height: 40px; }
    .tc-stick { width: 116px; height: 116px; }
  }`;

  const KEY_NAMES = { Space: ' ', Enter: 'Enter', Escape: 'Escape', ShiftLeft: 'Shift', ShiftRight: 'Shift',
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Period: '.', Slash: '/' };
  const keyName = code => KEY_NAMES[code] || (code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code);

  // Count holds per key so two controls pressing the same key don't release each other.
  const held = new Map();
  function send(type, code) {
    window.dispatchEvent(new KeyboardEvent(type, { code, key: keyName(code), bubbles: true, cancelable: true }));
  }
  function press(code) { const n = held.get(code) || 0; held.set(code, n + 1); if (!n) send('keydown', code); }
  function release(code) { const n = held.get(code) || 0; if (!n) return; if (n === 1) { held.delete(code); send('keyup', code); } else held.set(code, n - 1); }

  function noMenu(el) { el.addEventListener('contextmenu', e => e.preventDefault()); }

  function makeButton(item, resets) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tc-btn' + (item.big ? ' big' : '') + (item.mid ? ' mid' : '') + (item.small ? ' small' : '');
    b.textContent = item.label;
    b.setAttribute('aria-label', item.title || item.label);
    let down = false;
    const up = () => { if (!down) return; down = false; b.classList.remove('down'); if (!item.tap) release(item.code); };
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
      if (down) return;
      down = true; b.classList.add('down');
      if (item.tap) { send('keydown', item.code); send('keyup', item.code); } else press(item.code);
    });
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    noMenu(b);
    resets.push(up);
    return b;
  }

  function makeStick(keys, resets) {
    const base = document.createElement('div');
    base.className = 'tc-stick';
    base.setAttribute('aria-hidden', 'true');
    const knob = document.createElement('div'); knob.className = 'tc-knob';
    base.append(knob);
    if (keys.hint) {
      const h = document.createElement('div'); h.className = 'tc-hint';
      const pos = { up: 'top:6px;left:0;right:0;text-align:center', down: 'bottom:6px;left:0;right:0;text-align:center',
                    left: 'left:8px;top:50%;margin-top:-7px', right: 'right:8px;top:50%;margin-top:-7px' };
      for (const d in keys.hint) { const s = document.createElement('span'); s.style.cssText = pos[d]; s.textContent = keys.hint[d]; h.append(s); }
      base.append(h);
    }
    let id = null, on = new Set();
    function set(dirs) {
      for (const d of on) if (!dirs.has(d)) release(keys[d]);
      for (const d of dirs) if (!on.has(d)) press(keys[d]);
      on = dirs;
    }
    function move(e) {
      const r = base.getBoundingClientRect(), rad = r.width / 2;
      let dx = e.clientX - (r.left + rad), dy = e.clientY - (r.top + rad);
      const len = Math.hypot(dx, dy), max = rad - 18;
      if (len > max) { dx *= max / len; dy *= max / len; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dirs = new Set();
      if (len > rad * 0.25) {
        const nx = dx / Math.hypot(dx, dy), ny = dy / Math.hypot(dx, dy);
        if (nx > 0.38) dirs.add('right'); if (nx < -0.38) dirs.add('left');
        if (ny > 0.38) dirs.add('down'); if (ny < -0.38) dirs.add('up');
      }
      set(dirs);
    }
    const end = e => { if (e && e.pointerId !== id) return; id = null; knob.style.transform = ''; set(new Set()); };
    base.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId;
      try { base.setPointerCapture(id); } catch (err) {}
      move(e);
    });
    base.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end); base.addEventListener('lostpointercapture', end);
    noMenu(base);
    resets.push(() => end());
    return base;
  }

  window.TouchControls = function (cfg) {
    cfg = cfg || {};
    const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);

    function build() {
      const root = document.documentElement;
      const forced = /[?&]touch=1\b/.test(location.search);
      const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
      if (forced || coarse()) root.classList.add('tc-on');
      // A hybrid laptop may report a fine pointer; turn controls on at the first real touch.
      addEventListener('touchstart', () => root.classList.add('tc-on'), { passive: true, capture: true });

      if (cfg.back !== false) {
        const a = document.createElement('a');
        a.className = 'tc-back ' + (cfg.back === 'top-right' ? 'tr' : 'tl') + (cfg.backCompact ? ' compact' : '');
        a.href = cfg.backHref || '../';
        a.title = 'All games';
        a.innerHTML = cfg.backCompact ? '<span aria-hidden="true">←</span><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">All games</span>' : '<span aria-hidden="true">←</span> All games';
        a.addEventListener('pointerdown', e => e.stopPropagation());
        document.body.append(a);
      }

      const zones = (cfg.zones || []).map(z => {
        const el = document.createElement('div');
        el.className = 'tc-zone ' + (z.side || 'left');
        if (z.side !== 'top-right') el.style.bottom = `calc(${cfg.bottom || 16}px + env(safe-area-inset-bottom, 0px))`;
        const resets = [];
        for (const item of z.items) el.append(item.stick ? makeStick(item.stick, resets) : makeButton(item, resets));
        document.body.append(el);
        return { el, when: z.when, resets, shown: null };
      });

      // Show or hide each group as the game moves between menus and play.
      function tick() {
        for (const z of zones) {
          let show = true;
          if (z.when) { try { show = !!z.when(); } catch (e) { show = true; } }
          if (show !== z.shown) {
            z.shown = show;
            z.el.classList.toggle('tc-show', show);
            if (!show) z.resets.forEach(fn => fn());
          }
        }
      }
      tick();
      setInterval(tick, 100);
      // Let go of everything if the page loses focus mid-press.
      addEventListener('blur', () => zones.forEach(z => z.resets.forEach(fn => fn())));
    }
    if (document.body) build(); else addEventListener('DOMContentLoaded', build);
  };
})();
