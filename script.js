/* tomasplsek.github.io — editor behaviour.
   Content is rendered to HTML by Jekyll; this file only adds interaction:
   tabs + URL hash, explorer/outline, source view, command palette,
   window controls, theme, collapsible author lists and Pong. */
(function(){
  'use strict';

  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const root = document.documentElement;
  const store = {
    get(key){ try { return localStorage.getItem(key); } catch(e){ return null; } },
    set(key, value){ try { localStorage.setItem(key, value); } catch(e){} }
  };
  const wideMq  = matchMedia('(min-width: 1100px)');
  const phoneMq = matchMedia('(max-width: 760px)');
  const escHtml = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));

  const win      = $('#window');
  const scroller = $('#editor-scroll');
  const buffers  = $$('.buffer');
  const FILES    = buffers.map(b => b.id);   // about, papers, projects
  const REPO_URL = 'https://github.com/tomasplsek/tomasplsek.github.io';
  const BASE_TITLE = document.title;
  const OWNER = BASE_TITLE.split(' — ')[0];

  let current = null;
  let sourceMode = false;

  // --- Files, tabs and the URL hash ----------------------------------------
  function openFile(id){
    if(!FILES.includes(id)) id = FILES[0];
    const changed = id !== current;
    current = id;

    buffers.forEach(b => b.classList.toggle('is-active', b.id === id));
    $$('.tab').forEach(tab => {
      const on = tab.dataset.file === id;
      tab.setAttribute('aria-selected', on);
      tab.tabIndex = on ? 0 : -1;
      if(on) revealTab(tab);
    });
    $$('.tree-item[data-file]').forEach(a => {
      if(a.dataset.file === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $('#crumb-file').textContent = id + '.md';
    document.title = id === FILES[0] ? BASE_TITLE : `${id}.md — ${OWNER}`;

    if(changed) scroller.scrollTop = 0;
    buildOutline();
    setPosition(null);
    if(!wideMq.matches) setSidebar(false, false);
  }

  function navigate(id){
    if(id !== current) history.pushState(null, '', '#' + id);
    openFile(id);
  }

  // Keep the active tab visible when the tab strip scrolls (phones)
  function revealTab(tab){
    const bar = tab.parentElement;
    const left = tab.offsetLeft, right = left + tab.offsetWidth;
    if(left < bar.scrollLeft) bar.scrollLeft = left;
    else if(right > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = right - bar.clientWidth;
  }

  document.addEventListener('click', e => {
    const link = e.target.closest('a[data-file]');
    if(!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(link.dataset.file);
  });
  window.addEventListener('popstate', () => openFile(location.hash.slice(1)));
  window.addEventListener('hashchange', () => openFile(location.hash.slice(1)));

  // Arrow keys move between tabs (WAI-ARIA tabs pattern)
  $('.tabs').addEventListener('keydown', e => {
    if(e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = FILES.indexOf(current) + (e.key === 'ArrowRight' ? 1 : -1);
    navigate(FILES[(i + FILES.length) % FILES.length]);
    $(`.tab[data-file="${current}"]`).focus();
  });

  // --- Explorer sidebar -----------------------------------------------------
  const sidebarBtn = $('#toggle-sidebar');
  const scrim = $('#sidebar-scrim');
  const sidebarOpen = () => !root.classList.contains('sidebar-closed');

  function setSidebar(open, persist = true){
    root.classList.toggle('sidebar-closed', !open);
    sidebarBtn.setAttribute('aria-expanded', open);
    scrim.hidden = !open;
    if(persist && wideMq.matches) store.set('sidebar', open ? 'open' : 'closed');
  }
  sidebarBtn.addEventListener('click', () => setSidebar(!sidebarOpen()));
  scrim.addEventListener('click', () => setSidebar(false, false));
  wideMq.addEventListener('change', () => {
    setSidebar(wideMq.matches && store.get('sidebar') !== 'closed', false);
  });

  // --- Outline (headings of the open file) ----------------------------------
  let outlineTargets = [];

  function buildOutline(){
    const buf = $('#' + current);
    if(sourceMode){
      outlineTargets = $$('.src-line', buf).map(el => {
        const m = /^(#{1,2}) (.*)$/.exec(el.textContent);
        return m && { el, level: m[1].length, label: m[2].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') };
      }).filter(Boolean);
    } else {
      outlineTargets = $$('.preview h1, .preview h2', buf).map(el => ({
        el, level: el.tagName === 'H1' ? 1 : 2, label: el.textContent.trim()
      }));
    }
    const list = $('#outline');
    list.textContent = '';
    outlineTargets.forEach(t => {
      const li = document.createElement('li');
      li.className = 'lvl-' + t.level;
      const a = document.createElement('a');
      a.href = '#' + current;
      a.appendChild(document.createElement('span')).textContent = t.label;
      a.addEventListener('click', e => {
        e.preventDefault();
        scroller.scrollTo({ top: t.el.offsetTop - 12 });
        if(!wideMq.matches) setSidebar(false, false);
      });
      li.appendChild(a);
      list.appendChild(li);
      t.link = a;
    });
    markOutline();
  }

  function markOutline(){
    const line = scroller.getBoundingClientRect().top + 40;
    let active = outlineTargets[0];
    for(const t of outlineTargets){
      if(t.el.getBoundingClientRect().top <= line) active = t; else break;
    }
    outlineTargets.forEach(t => t.link.classList.toggle('is-active', t === active));
  }
  let outlineQueued = false;
  scroller.addEventListener('scroll', () => {
    if(outlineQueued) return;
    outlineQueued = true;
    requestAnimationFrame(() => { outlineQueued = false; markOutline(); });
  }, { passive: true });

  // --- Source view: the markdown behind each file ---------------------------
  const sourceBtn = $('#toggle-source');

  // Highlight one line of markdown (headings, lists, links, emphasis, kramdown attributes)
  function highlightInline(text){
    const re = /(\{:[^}]*\})|(\*\*)([^*]+)(\*\*)|(\*)([^*\s][^*]*)(\*)|(!?\[)|(\]\()([^)\s]*)(\))|(\]\[)([^\]]*)(\])|(\])/g;
    let out = '', last = 0, depth = 0, m;
    const plain = s => s && (depth > 0 ? `<span class="tk-link">${escHtml(s)}</span>` : escHtml(s));
    while((m = re.exec(text))){
      out += plain(text.slice(last, m.index));
      last = re.lastIndex;
      if(m[1]) out += `<span class="tk-attr">${escHtml(m[1])}</span>`;
      else if(m[2]) out += `<span class="tk-strong">**${escHtml(m[3])}**</span>`;
      else if(m[5]) out += `<span class="tk-em">*${escHtml(m[6])}*</span>`;
      else if(m[8]){ depth++; out += `<span class="tk-mark">${escHtml(m[8])}</span>`; }
      else if(m[9]){ depth = Math.max(0, depth - 1); out += `<span class="tk-mark">](</span><span class="tk-url">${escHtml(m[10])}</span><span class="tk-mark">)</span>`; }
      else if(m[12]){ depth = Math.max(0, depth - 1); out += `<span class="tk-mark">][</span><span class="tk-url">${escHtml(m[13])}</span><span class="tk-mark">]</span>`; }
      else if(m[15]){ depth = Math.max(0, depth - 1); out += '<span class="tk-mark">]</span>'; }
    }
    return out + plain(text.slice(last));
  }

  function highlightLine(line){
    let m;
    if((m = /^(#{1,6} )(.*)$/.exec(line))) return `<span class="tk-mark">${m[1]}</span><span class="tk-h">${highlightInline(m[2])}</span>`;
    if((m = /^(\s*)([-*] )(.*)$/.exec(line))) return `${m[1]}<span class="tk-mark">${m[2]}</span>${highlightInline(m[3])}`;
    if((m = /^(\[[^\]]+\]:)(\s*)(.*)$/.exec(line))) return `<span class="tk-link">${escHtml(m[1])}</span>${m[2]}<span class="tk-url">${escHtml(m[3])}</span>`;
    return highlightInline(line);
  }

  function renderSource(pre){
    if(pre.dataset.ready) return;
    const code = $('code', pre);
    const lines = code.textContent.replace(/\s+$/, '').split('\n');
    code.innerHTML = lines.map(l => `<div class="src-line"><span>${highlightLine(l)}</span></div>`).join('');
    pre.dataset.ready = '1';
  }

  function setSource(on){
    const max = scroller.scrollHeight - scroller.clientHeight;
    const ratio = max > 0 ? scroller.scrollTop / max : 0;
    sourceMode = on;
    buffers.forEach(b => {
      const pre = $('.source', b);
      if(on) renderSource(pre);
      pre.hidden = !on;
      $('.preview', b).hidden = on;
    });
    sourceBtn.setAttribute('aria-pressed', on);
    const label = on ? 'Show preview' : 'Show markdown source';
    sourceBtn.setAttribute('aria-label', label);
    sourceBtn.title = `${label} (Ctrl+Shift+V)`;
    $('#sb-mode').textContent = on ? 'Source' : 'Preview';
    scroller.scrollTop = ratio * (scroller.scrollHeight - scroller.clientHeight);
    buildOutline();
    setPosition(null);
  }
  sourceBtn.addEventListener('click', () => setSource(!sourceMode));

  // Clicking a source line puts the "cursor" there and reports Ln/Col
  function caretColumn(e, span){
    let node = null, offset = 0;
    if(document.caretPositionFromPoint){
      const p = document.caretPositionFromPoint(e.clientX, e.clientY);
      if(p){ node = p.offsetNode; offset = p.offset; }
    } else if(document.caretRangeFromPoint){
      const r = document.caretRangeFromPoint(e.clientX, e.clientY);
      if(r){ node = r.startContainer; offset = r.startOffset; }
    }
    if(!node || !span.contains(node)) return 1;
    const range = document.createRange();
    range.setStart(span, 0);
    range.setEnd(node, offset);
    return range.toString().length + 1;
  }

  function setPosition(pos){
    const el = $('#sb-position');
    el.hidden = !sourceMode;
    $$('.src-line.is-current').forEach(l => l.classList.remove('is-current'));
    if(!pos){ el.textContent = 'Ln 1, Col 1'; return; }
    pos.line.classList.add('is-current');
    el.textContent = `Ln ${pos.ln}, Col ${pos.col}`;
  }

  buffers.forEach(b => $('.source', b).addEventListener('click', e => {
    const line = e.target.closest('.src-line');
    if(!line) return;
    const lines = $$('.src-line', b);
    setPosition({ line, ln: lines.indexOf(line) + 1, col: caretColumn(e, line.firstElementChild) });
  }));

  // --- Preview niceties -----------------------------------------------------
  // External links and PDFs open in a new tab
  $$('.preview a[href^="http"], .preview a[href$=".pdf"]').forEach(a => {
    a.target = '_blank';
    a.rel = 'noopener';
  });

  // Long author lists: show the first few names (plus mine) and a "+N more" toggle
  const AUTHORS_MAX = 8, AUTHORS_SHOWN = 3;
  $$('.pub-authors').forEach(list => {
    const authors = $$('.au', list);
    if(authors.length <= AUTHORS_MAX) return;
    const hidden = authors.filter((a, i) => i >= AUTHORS_SHOWN && !a.querySelector('.me'));
    const gaps = [];
    const gap = () => {
      const g = document.createElement('span');
      g.className = 'au-gap';
      g.textContent = ', …';
      gaps.push(g);
      return g;
    };
    authors.forEach((a, i) => {
      if(i > 0 && hidden.includes(authors[i - 1]) && !hidden.includes(a)) a.before(gap());
    });
    if(hidden.includes(authors[authors.length - 1])) list.appendChild(gap());

    const label = `+${hidden.length} more`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'authors-more';
    btn.textContent = label;
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      hidden.forEach(a => a.classList.toggle('is-hidden', !open));
      gaps.forEach(g => { g.hidden = open; });
      btn.textContent = open ? 'show fewer' : label;
      btn.setAttribute('aria-expanded', open);
    });
    hidden.forEach(a => a.classList.add('is-hidden'));
    list.appendChild(btn);
  });

  // --- Theme ----------------------------------------------------------------
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => root.dataset.theme || (darkMq.matches ? 'dark' : 'light');

  function labelThemeButtons(){
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    $$('.theme-toggle').forEach(btn => {
      btn.setAttribute('aria-label', `Switch to ${next} theme`);
      btn.title = `Switch to ${next} theme`;
    });
  }
  function toggleTheme(){
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    store.set('theme', next);
    labelThemeButtons();
    Pong.refreshColors();
  }
  $$('.theme-toggle').forEach(btn => btn.addEventListener('click', toggleTheme));
  darkMq.addEventListener('change', labelThemeButtons);

  // --- Window controls ------------------------------------------------------
  const maxBtn = $('.wc-max');

  function toggleMaximized(){
    if(phoneMq.matches) return;   // the window is already full-screen on phones
    win.classList.remove('is-minimized');
    const on = win.classList.toggle('is-maximized');
    maxBtn.setAttribute('aria-label', on ? 'Restore' : 'Maximize');
    maxBtn.title = on ? 'Restore' : 'Maximize';
  }
  function toggleMinimized(){
    win.classList.remove('is-maximized');
    win.classList.toggle('is-minimized');
  }
  $('.wc-min').addEventListener('click', toggleMinimized);
  maxBtn.addEventListener('click', toggleMaximized);
  $('.wc-close').addEventListener('click', () => Pong.start());

  // Titlebar background: double-click maximises; a click restores a minimised window
  const titlebar = $('.titlebar');
  const onChrome = e => !e.target.closest('button, a');
  titlebar.addEventListener('dblclick', e => { if(onChrome(e)) toggleMaximized(); });
  titlebar.addEventListener('click', e => {
    if(onChrome(e) && win.classList.contains('is-minimized')) toggleMinimized();
  });

  // --- Command palette ------------------------------------------------------
  const palette = $('#palette');
  const paletteInput = $('#palette-input');
  const paletteList = $('#palette-list');
  let paletteItems = [], paletteIndex = 0, paletteReturnFocus = null;

  const FILE_ITEMS = $$('.sidebar .tree-item').map(a => ({
    label: a.textContent.trim(),
    detail: a.dataset.file ? '' : 'files',
    icon: $('svg', a).outerHTML,
    run: () => a.dataset.file ? navigate(a.dataset.file) : window.open(a.href, '_blank', 'noopener')
  }));
  const COMMANDS = [
    { label: 'Preferences: Toggle Light/Dark Theme', run: toggleTheme },
    { label: 'Markdown: Toggle Source / Preview', key: 'Ctrl+Shift+V', run: () => setSource(!sourceMode) },
    { label: 'View: Toggle Explorer', key: 'Ctrl+B', run: () => setSidebar(!sidebarOpen()) },
    { label: 'View: Toggle Maximized Window', run: toggleMaximized },
    { label: 'Open CV (PDF)', run: () => window.open('files/cv.pdf', '_blank', 'noopener') },
    { label: 'Open Repository on GitHub', run: () => window.open(REPO_URL, '_blank', 'noopener') },
    { label: 'Play Pong', run: () => Pong.start() }
  ];

  // Subsequence match; consecutive letters and word starts score higher
  function fuzzy(query, text){
    const q = query.toLowerCase(), t = text.toLowerCase();
    const hits = [];
    let score = 0, prev = -2, j = 0;
    for(let i = 0; i < t.length && j < q.length; i++){
      if(t[i] !== q[j]) continue;
      score += (i === prev + 1 ? 3 : 1) + (i === 0 || /[\s._:/-]/.test(t[i - 1]) ? 2 : 0);
      hits.push(i); prev = i; j++;
    }
    return j === q.length ? { score, hits } : null;
  }
  const markHits = (text, hits) => [...text].map((c, i) => hits.includes(i) ? `<mark>${escHtml(c)}</mark>` : escHtml(c)).join('');

  function renderPalette(){
    const value = paletteInput.value;
    const commandMode = value.startsWith('>');
    const query = (commandMode ? value.slice(1) : value).trim();
    const pool = commandMode ? COMMANDS : FILE_ITEMS;
    paletteItems = pool
      .map(item => ({ item, m: query ? fuzzy(query, item.label) : { score: 0, hits: [] } }))
      .filter(r => r.m)
      .sort((a, b) => b.m.score - a.m.score);
    paletteIndex = 0;
    paletteList.innerHTML = paletteItems.length
      ? paletteItems.map((r, i) => `<li role="option" id="pl-${i}" data-i="${i}">
          ${r.item.icon || ''}<span>${markHits(r.item.label, r.m.hits)}</span>
          ${r.item.key ? `<kbd class="pl-key">${r.item.key}</kbd>` : ''}
          ${r.item.detail ? `<span class="pl-detail">${r.item.detail}</span>` : ''}</li>`).join('')
      : `<li class="pl-empty">No matching ${commandMode ? 'commands' : 'files'}</li>`;
    highlightPalette();
  }
  function highlightPalette(){
    $$('li[role="option"]', paletteList).forEach((li, i) => {
      li.setAttribute('aria-selected', i === paletteIndex);
      if(i === paletteIndex) li.scrollIntoView({ block: 'nearest' });
    });
    paletteInput.setAttribute('aria-activedescendant', paletteItems.length ? 'pl-' + paletteIndex : '');
  }
  function openPalette(prefix = ''){
    if(palette.hidden) paletteReturnFocus = document.activeElement;
    palette.hidden = false;
    paletteInput.value = prefix;
    renderPalette();
    paletteInput.focus();
  }
  function closePalette(){
    palette.hidden = true;
    if(paletteReturnFocus && paletteReturnFocus.focus) paletteReturnFocus.focus();
  }
  function runPalette(i){
    const r = paletteItems[i];
    if(!r) return;
    closePalette();
    r.item.run();
  }

  paletteInput.addEventListener('input', renderPalette);
  paletteInput.addEventListener('keydown', e => {
    const n = paletteItems.length;
    if(e.key === 'ArrowDown' && n){ e.preventDefault(); paletteIndex = (paletteIndex + 1) % n; highlightPalette(); }
    else if(e.key === 'ArrowUp' && n){ e.preventDefault(); paletteIndex = (paletteIndex - 1 + n) % n; highlightPalette(); }
    else if(e.key === 'Enter'){ e.preventDefault(); runPalette(paletteIndex); }
    else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closePalette(); }
    else if(e.key === 'Tab'){ e.preventDefault(); }
  });
  paletteList.addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    if(li) runPalette(+li.dataset.i);
  });
  palette.addEventListener('mousedown', e => { if(e.target === palette) closePalette(); });
  $('#open-palette').addEventListener('click', () => openPalette());

  // --- Keyboard shortcuts ---------------------------------------------------
  document.addEventListener('keydown', e => {
    if(Pong.running) return;   // Pong handles its own keys
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const typing = e.target.matches('input, textarea');
    if(mod && key === 'p'){ e.preventDefault(); openPalette(e.shiftKey ? '>' : ''); }
    else if(e.key === 'F1'){ e.preventDefault(); openPalette('>'); }
    else if(typing) return;
    else if(mod && e.shiftKey && key === 'v'){ e.preventDefault(); setSource(!sourceMode); }
    else if(mod && !e.shiftKey && key === 'b'){ e.preventDefault(); setSidebar(!sidebarOpen()); }
    else if(e.key === 'Escape' && sidebarOpen() && !wideMq.matches){ setSidebar(false, false); }
  });

  // --- Pong (the close button) ----------------------------------------------
  const Pong = (() => {
    const overlay = $('#pong');
    const canvas = $('#pong-canvas');
    const ctx = canvas.getContext('2d');
    const WIN_SCORE = 5, MARGIN = 22;
    let g = null, raf = 0, last = 0, colors = {};
    const keys = { left: false, right: false };

    // Theme colours are light-dark() values, so resolve them through a probe element
    function refreshColors(){
      const probe = document.createElement('span');
      overlay.appendChild(probe);
      const read = v => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
      colors = { bg: read('--editor'), fg: read('--strong'), line: read('--line'), accent: read('--accent'), muted: read('--muted') };
      probe.remove();
    }

    function resize(){
      const bar = $('.pong-bar', overlay).offsetHeight;
      let w, h;
      if(phoneMq.matches){
        w = innerWidth; h = innerHeight - bar;
      } else {
        h = Math.min(innerHeight * 0.88 - bar, Math.min(innerWidth * 0.9, 1200) * 0.75);
        w = h / 0.75;
      }
      w = Math.floor(w); h = Math.floor(h);
      const dpr = devicePixelRatio || 1;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      overlay.style.setProperty('--pong-w', w + 'px');
      if(g){   // rescale the running game to the new size
        const sx = w / g.w, sy = h / g.h;
        g.top *= sx; g.bot *= sx; g.target *= sx; g.bx *= sx; g.by *= sy; g.vx *= sx; g.vy *= sy;
        Object.assign(g, dims(w, h));
      }
    }

    const dims = (w, h) => ({ w, h, pw: Math.max(60, w * 0.18), ph: Math.max(8, h * 0.018), r: Math.max(5, w * 0.009) });

    function serve(dir){
      const speed = g.h * 0.85;   // px per second: crosses the court in ~1.2 s
      const angle = Math.random() * 0.6 - 0.3;
      g.bx = g.w / 2; g.by = g.h / 2;
      g.vx = speed * Math.sin(angle);
      g.vy = dir * speed * Math.cos(angle);
      g.wait = performance.now() + (g.started ? 700 : 3000);
      g.started = true;
    }

    function bounce(paddleX, dir){
      const rel = (g.bx - (paddleX + g.pw / 2)) / (g.pw / 2);
      const speed = Math.min(Math.hypot(g.vx, g.vy) * 1.04, g.h * 1.8);
      const angle = Math.max(-1, Math.min(1, rel)) * 0.9;
      g.vx = speed * Math.sin(angle);
      g.vy = dir * speed * Math.cos(angle);
    }

    function update(dt, now){
      const playerSpeed = g.w * 1.2, aiSpeed = g.w * 0.62;
      if(keys.left)  g.target -= playerSpeed * dt;
      if(keys.right) g.target += playerSpeed * dt;
      g.target = Math.max(0, Math.min(g.w - g.pw, g.target));
      g.bot = g.target;

      // Opponent follows the ball, a little slower than it can move
      const aim = g.bx - g.pw / 2;
      g.top += Math.max(-aiSpeed * dt, Math.min(aiSpeed * dt, aim - g.top));
      g.top = Math.max(0, Math.min(g.w - g.pw, g.top));

      if(now < g.wait) return;
      const prevY = g.by;
      g.bx += g.vx * dt;
      g.by += g.vy * dt;
      if(g.bx < g.r){ g.bx = g.r; g.vx = Math.abs(g.vx); }
      if(g.bx > g.w - g.r){ g.bx = g.w - g.r; g.vx = -Math.abs(g.vx); }

      // Swept collision against the paddle faces, so fast balls cannot tunnel through
      const topFace = MARGIN + g.ph, botFace = g.h - MARGIN - g.ph;
      if(g.vy < 0 && prevY - g.r >= topFace && g.by - g.r <= topFace && g.bx >= g.top - g.r && g.bx <= g.top + g.pw + g.r){
        g.by = topFace + g.r; bounce(g.top, 1);
      }
      if(g.vy > 0 && prevY + g.r <= botFace && g.by + g.r >= botFace && g.bx >= g.bot - g.r && g.bx <= g.bot + g.pw + g.r){
        g.by = botFace - g.r; bounce(g.bot, -1);
      }

      if(g.by < -g.r * 2){ g.you++; if(g.you >= WIN_SCORE) return over('YOU WIN'); serve(1); }
      if(g.by > g.h + g.r * 2){ g.cpu++; if(g.cpu >= WIN_SCORE) return over('YOU LOSE'); serve(-1); }
    }

    function draw(now){
      const { w, h } = g;
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.moveTo(12, h / 2); ctx.lineTo(w - 12, h / 2); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = colors.muted;
      ctx.font = `600 ${Math.round(Math.max(18, w * 0.05))}px ${getComputedStyle(root).getPropertyValue('--font-mono')}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.cpu, w / 2, h * 0.25);
      ctx.fillText(g.you, w / 2, h * 0.75);

      ctx.fillStyle = colors.fg;
      ctx.fillRect(g.top, MARGIN, g.pw, g.ph);
      ctx.fillRect(g.bot, h - MARGIN - g.ph, g.pw, g.ph);
      ctx.fillStyle = colors.accent;
      ctx.beginPath(); ctx.arc(g.bx, g.by, g.r, 0, Math.PI * 2); ctx.fill();

      const message = g.message || (now < g.wait && g.cpu + g.you === 0 ? String(Math.ceil((g.wait - now) / 1000)) : '');
      if(message){
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.fg;
        ctx.font = `600 ${Math.round(Math.max(28, w * (g.message ? 0.09 : 0.16)))}px ${getComputedStyle(root).getPropertyValue('--font-mono')}`;
        ctx.fillText(message, w / 2, h / 2);
      }
    }

    function frame(now){
      const dt = Math.min(0.05, (now - last) / 1000);   // clamp: no jumps after a background tab
      last = now;
      if(!g.message) update(dt, now);
      draw(now);
      if(api.running) raf = requestAnimationFrame(frame);
    }

    function over(message){
      g.message = message;
      setTimeout(stop, 1600);
    }

    function onPointer(e){
      const rect = canvas.getBoundingClientRect();
      g.target = e.clientX - rect.left - g.pw / 2;
    }
    function onKey(e){
      const down = e.type === 'keydown';
      if(e.key === 'Escape' && down){ e.preventDefault(); return stop(); }
      if(e.key === 'ArrowLeft' || e.key === 'a') keys.left = down;
      else if(e.key === 'ArrowRight' || e.key === 'd') keys.right = down;
      else return;
      e.preventDefault();
    }

    function start(){
      if(api.running) return;
      api.running = true;
      overlay.hidden = false;
      win.classList.add('is-closed');
      refreshColors();
      g = null;
      resize();
      g = Object.assign({ top: 0, bot: 0, target: 0, cpu: 0, you: 0, started: false, message: '' }, dims(canvas.clientWidth, canvas.clientHeight));
      g.top = g.bot = g.target = (g.w - g.pw) / 2;
      serve(Math.random() < 0.5 ? -1 : 1);
      keys.left = keys.right = false;
      canvas.addEventListener('pointermove', onPointer);
      canvas.addEventListener('pointerdown', onPointer);
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
      window.addEventListener('resize', resize);
      $('#pong-quit').focus();
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function stop(){
      if(!api.running) return;
      api.running = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('resize', resize);
      overlay.hidden = true;
      win.classList.remove('is-closed');
      $('.wc-close').focus();
    }

    $('#pong-quit').addEventListener('click', stop);
    const api = { running: false, start, stop, refreshColors: () => { if(api.running) refreshColors(); } };
    return api;
  })();

  // --- Start ----------------------------------------------------------------
  setSidebar(sidebarOpen(), false);
  labelThemeButtons();
  openFile(location.hash.slice(1));
})();
