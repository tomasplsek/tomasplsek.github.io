(function(){
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const buffers = Array.from(document.querySelectorAll('.buffer'));

  function show(target){
    // tab active
    tabs.forEach(t=>t.classList.toggle('active', t.dataset.target===target));
    // buffer show
    buffers.forEach(b=>b.classList.toggle('show', b.id===target));
  }

  // --- Minimal markdown-like renderer -------------------------------------------------
const urlRe = /(https?:\/\/[^\s)]+)(?![^<]*>)/g;
  const esc = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const linkify = s => s.replace(urlRe, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const italicizeQuotes = s => s.replace(/"([^"]+)"/g, '<em>$1</em>');
  // Support both absolute and relative markdown links; add download for local PDFs
  const mdLinks = s => s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, href) => {
    const isAbs = /^https?:\/\//i.test(href);
    const isPdf = /\.pdf$/i.test(href) && !isAbs;
    const safeHref = esc(href);
    const safeText = esc(text);
    if(isAbs){
      return `<a href="${safeHref}" target="_blank" rel="noopener">${safeText}</a>`;
    } else {
      return `<a href="${safeHref}"${isPdf ? ' download' : ''}>${safeText}</a>`;
    }
  });
  const boldify = s => s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Important: apply mdLinks after escaping and then boldify; DO NOT run linkify here to avoid mangling anchors
const fmt = s => mdLinks(boldify(italicizeQuotes(esc(s)))) ;

  function renderCodeToHtml(codeEl){
    const text = codeEl.textContent || '';
    const lines = text.split(/\r?\n/);
    const html = lines.map(line => {
      const t = line.trim();
      // image wrapped in link: [![alt](src)](href)
      const imgLinkMatch = /^\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/.exec(t);
      if(imgLinkMatch){
        const alt = esc(imgLinkMatch[1] || '');
        const src = esc(imgLinkMatch[2] || '');
        const href = esc(imgLinkMatch[3] || '#');
        return `<div class=\"md-img\"><a href=\"${href}\" target=\"_blank\" rel=\"noopener\"><img src=\"${src}\" alt=\"${alt}\"></a></div>`;
      }
      // very simple image syntax: ![alt](src)
      const imgMatch = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(t);
      if(imgMatch){
        const alt = esc(imgMatch[1] || '');
        const src = esc(imgMatch[2] || '');
        return `<div class=\"md-img\"><img src=\"${src}\" alt=\"${alt}\"></div>`;
      }
      if(t.startsWith('## ')){
        return `<div class="md-h2">${fmt(t.slice(3))}</div>`;
      } else if(t.startsWith('# ')){
        return `<div class="md-h1">${fmt(t.slice(2))}</div>`;
      } else if(t.startsWith('- ')){
        return `<div class="md-li"><span class="bullet">•</span>${fmt(t.slice(2))}</div>`;
      } else if(t.length === 0){
        return '<div class="md-blank"></div>';
      } else {
        return `<div class="md-p">${fmt(line)}</div>`;
      }
    }).join('\n');

    const view = document.createElement('div');
    view.className = 'md-view';
    view.innerHTML = html;
    codeEl.parentNode.insertAdjacentElement('afterend', view);
  }

  // Render all buffers
  Array.from(document.querySelectorAll('.buffer pre code')).forEach(renderCodeToHtml);
  document.body.classList.add('md-ready');

  // Ensure bio wrapper exists before building About layout
  (function ensureBioWrap(){
    const aboutEl = document.getElementById('about');
    if(!aboutEl) return;
    const view = aboutEl.querySelector('.md-view');
    const h1 = aboutEl.querySelector('.md-view .md-h1');
    if(view && h1 && !aboutEl.querySelector('.md-bio')){
      const bioWrap = document.createElement('div');
      bioWrap.className = 'md-bio';
      let node = h1.nextElementSibling; // start after H1
      let firstH2 = null;
      while(node){
        if(node.classList && node.classList.contains('md-h2')){ firstH2 = node; break; }
        const next = node.nextElementSibling;
        bioWrap.appendChild(node);
        node = next;
      }
      if(bioWrap.children.length){
        if(firstH2){ view.insertBefore(bioWrap, firstH2); }
        else { view.appendChild(bioWrap); }
      }
    }
  })();

  // Build About layout: text + image side by side
  (function buildAboutLayout(){
    const about = document.getElementById('about');
    if(!about) return;
    const view = about.querySelector('.md-view');
    const profile = about.querySelector('.profile');
    const bio = about.querySelector('.md-bio');
    const title = about.querySelector('.md-view .md-h1');
    if(view && profile && bio && title){
      const layout = document.createElement('div');
      layout.className = 'about-layout';
      const textWrap = document.createElement('div');
      textWrap.className = 'about-text';
      // Insert layout before the title so title+bio are grouped
      title.parentNode.insertBefore(layout, title);
      layout.appendChild(textWrap);
      textWrap.appendChild(title);
      // Wrap existing bio content into a container, then place profile inside md-bio for alignment
      const bioContent = document.createElement('div');
      bioContent.className = 'bio-content';
      while(bio.firstChild){ bioContent.appendChild(bio.firstChild); }
      bio.appendChild(bioContent);
      // Move md-bio under text and append profile inside it
      textWrap.appendChild(bio);
      bio.appendChild(profile);
    }
  })();

  // Mobile order handled purely by CSS (no JS DOM reordering needed)

  // Move the tabs (editor-header) into the titlebar so tabs sit on same row as window controls
  (function moveTabsToTitlebar(){
    const titlebar = document.querySelector('.titlebar');
    const header = document.querySelector('.editor-header');
    const controls = document.querySelector('.window-controls');
    if(titlebar && header){
      header.classList.add('in-titlebar');
      // Place tabs before window controls if present; otherwise append to end
      if(controls){ titlebar.insertBefore(header, controls); }
      else { titlebar.appendChild(header); }
    }
  })();

  (function wirePdfLinks(){
    // About CV label
    const about = document.getElementById('about');
    if(about){
      const p = Array.from(about.querySelectorAll('.md-view .md-p'))
        .find(x => /Download full CV \(PDF\)/i.test(x.textContent));
      if(p){ p.classList.add('cv-link'); }
      const a = p ? p.querySelector('a') : null;
      if(a){
        a.textContent = 'Download full CV (PDF)';
        a.setAttribute('href','cv.pdf');
      }
    }
    // Papers PDF label
const papers = document.getElementById('papers');
    if(papers){
      const p2 = Array.from(papers.querySelectorAll('.md-view .md-p')).find(x => /List of publications \(PDF\)/i.test(x.textContent));
      if(p2){
        p2.classList.add('pubs-pdf-link');
        p2.innerHTML = '<a href="list_of_publications.pdf" target="_blank" rel="noopener">List of publications (PDF)</a>';
      }
    }
    // Global: open all local PDFs in new tab
    document.querySelectorAll('.md-view a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const isPdf = /\.pdf(\?|#|$)/i.test(href);
      const isAbs = /^https?:\/\//i.test(href);
      if(isPdf && !isAbs){
        a.removeAttribute('download');
        a.setAttribute('target','_blank');
        a.setAttribute('rel','noopener');
      }
    });
  })();

  // Convert 'List of all publications (ADS)' at the end of papers into a clickable link without exposing the URL
  (function wireAdsLink(){
    const papers = document.getElementById('papers');
    if(!papers) return;
    const paras = Array.from(papers.querySelectorAll('.md-view .md-p'));
    const target = paras.reverse().find(p => /List of all publications \(ADS\)/.test(p.textContent.trim()));
    if(target){
      target.classList.add('ads-link');
      const adsUrl = 'https://ui.adsabs.harvard.edu/search/fq=%7B!type%3Daqp%20v%3D%24fq_database%7D&fq_database=(database%3Aastronomy)&q=pubdate%3A%5B2021-01%20TO%209999-12%5D%20author%3A(%22pl%C5%A1ek%2C%20tom%C3%A1%C5%A1%22)&sort=date%20desc%2C%20bibcode%20desc&p_=0';
      target.innerHTML = `<a href="${adsUrl}" rel="noopener" target="_blank">List of publications (ADS)</a>`;
    }
  })();

  // Restyle paper list items: split into title/authors/journal blocks with accent color
  (function restylePapers(){
    const papers = document.getElementById('papers');
    if(!papers) return;
    const items = Array.from(papers.querySelectorAll('.md-view .md-li'));
    const escHtml = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    items.forEach(li => {
      // skip if already processed
      if(li.querySelector('.pub-item')) return;
      const bulletEl = li.querySelector('.bullet');
      const bulletHtml = bulletEl ? bulletEl.outerHTML : '';
      if(bulletEl) bulletEl.remove();
      // Prepare HTML and text forms (to preserve links in title)
      const tmpHtml = document.createElement('div');
      tmpHtml.innerHTML = li.innerHTML;
      const rawHtml = tmpHtml.innerHTML.trim();
      const htmlParts = rawHtml.split(' — ');
      const tmpText = document.createElement('div');
      tmpText.innerHTML = li.innerHTML;
      const rawText = (tmpText.textContent || '').trim();
      const textParts = rawText.split(' — ');
      if(htmlParts.length < 3 || textParts.length < 3){
        // fallback: keep original
        li.innerHTML = bulletHtml + rawHtml;
        return;
      }
      const dateText = textParts[0].trim();
      const titleHtml = htmlParts[1].trim(); // may include <a>
      const metaText = textParts.slice(2).join(' — ').trim();
      let authors = metaText;
      let journal = '';
      const semi = metaText.indexOf(';');
      if(semi !== -1){
        authors = metaText.slice(0, semi).trim();
        journal = metaText.slice(semi + 1).trim();
      }
      const metaLine = journal ? `${authors}, ${journal}` : authors;
      const html = `${bulletHtml}<div class=\"pub-item\"><div class=\"pub-head\"><span class=\"pub-date\">${escHtml(dateText)}</span>: <span class=\"pub-title\">${titleHtml}</span></div><div class=\"pub-meta\">${escHtml(metaLine)}</div></div>`;
      li.innerHTML = html;
      li.classList.add('pub-li');
    });
  })();

  // Color date parts in About lists
  (function colorAboutDates(){
    const about = document.getElementById('about');
    if(!about) return;
    const items = Array.from(about.querySelectorAll('.md-view .md-li'));
    items.forEach(li => {
      // Avoid double processing
      if(li.querySelector('.about-date')) return;
      const bullet = li.querySelector('.bullet');
      const htmlAfterBullet = (()=>{
        const tmp = li.cloneNode(true);
        const b = tmp.querySelector('.bullet');
        if(b) b.remove();
        return (tmp.textContent || '').trim();
      })();
      const sep = ' — ';
      if(!htmlAfterBullet.includes(sep)) return;
      const [datePart, rest] = htmlAfterBullet.split(sep);
      if(!rest) return;
      // Heuristic: treat short first segment with a digit as a date
      if(/\d/.test(datePart) && datePart.length <= 24){
        const original = li.innerHTML;
        // Replace only the first occurrence of datePart followed by the separator
        const safeDate = datePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(${safeDate})(\u00A0?| )—(\u00A0?| )`); // spaces around em dash
        li.innerHTML = original.replace(re, '<span class="about-date">$1</span> — ');
      }
    });
  })();

  // Highlight \"Plšek T.\" occurrences in papers (authors/journal only)
  (function highlightMe(){
    const papers = document.getElementById('papers');
    if(!papers) return;
    const nodes = papers.querySelectorAll('.md-view .pub-meta, .md-view .md-p');
    const re = /(T\.?\s*Plšek|Plšek\s*T\.?)/g;
    nodes.forEach(n => {
      if(n.querySelector('.me')) return;
      n.innerHTML = n.innerHTML.replace(re, '<span class="me">$1</span>');
    });
  })();

  // Ensure the HEA shorthand is linked properly inside the about paragraph
  (function fixHeaLink(){
    const aboutEl = document.getElementById('about');
    if(!aboutEl) return;
    const paras = aboutEl.querySelectorAll('.md-view .md-p');
    paras.forEach(p => {
      const txt = p.innerHTML;
      if(txt.includes('High Energy Astrophysics (HEA)')){
        p.innerHTML = txt.replace('(HEA)', '(<a href="https://hea.physics.muni.cz/" target="_blank" rel="noopener">HEA</a>)');
      }
    });
  })();

  // Projects: add captions and reorder figures below first paragraph on mobile
  (function tweakProjects(){
    const proj = document.getElementById('projects');
    if(!proj) return;
    const view = proj.querySelector('.md-view');
    if(!view) return;

    function ensureCaptions(){
      view.querySelectorAll('.md-img').forEach(box => {
        const img = box.querySelector('img');
        if(!img) return;
        const src = (img.getAttribute('src')||'').toLowerCase();
        let caption = '';
        if(src.includes('architecture.png')) caption = 'Schematic image of the CADET pipeline';
else if(src.includes('beta.png')) caption = 'Interface of the Interactive beta modelling tool.';
        // add wider class for beta figure
        if(src.includes('beta.png')) box.classList.add('beta-fig');
        if(!caption) return;
        let cap = box.querySelector('.caption');
        if(!cap){
          cap = document.createElement('div');
          cap.className = 'caption';
          box.appendChild(cap);
        }
        // ensure trailing period
        const text = caption.trim();
        cap.textContent = /[.!?]$/.test(text) ? text : text + '.';
      });
    }

    function reorderMobile(){
      const isMobile = window.matchMedia('(max-width: 900px)').matches;
      if(!isMobile) return; // only move on mobile
      // For each section between H2 and next H2, move any leading md-img to after the first md-p
      const nodes = Array.from(view.children);
      for(let i=0;i<nodes.length;i++){
        if(!nodes[i].classList || !nodes[i].classList.contains('md-h2')) continue;
        // collect until next md-h2
        const section = [];
        let j=i+1;
        for(; j<nodes.length && !(nodes[j].classList && nodes[j].classList.contains('md-h2')); j++){
          section.push(nodes[j]);
        }
        const firstImg = section.find(n => n.classList && n.classList.contains('md-img'));
        const firstP = section.find(n => n.classList && n.classList.contains('md-p'));
        if(firstImg && firstP){
          const rel = firstImg.compareDocumentPosition(firstP);
          // If image is before paragraph, move it to just after the first paragraph
          if(rel & Node.DOCUMENT_POSITION_FOLLOWING){
            firstP.insertAdjacentElement('afterend', firstImg);
          }
        }
        i = j-1; // jump to next section
      }
    }

    ensureCaptions();
    reorderMobile();
    window.addEventListener('resize', reorderMobile);
    const header = document.querySelector('.editor-header');
    if(header){ header.addEventListener('click', ()=> setTimeout(()=>{ ensureCaptions(); reorderMobile(); }, 0)); }
  })();

  // Wrap all content from after H1 up to (but not including) first H2 into a bio container
  (function wrapBio(){
    const aboutEl = document.getElementById('about');
    if(!aboutEl) return;
    const view = aboutEl.querySelector('.md-view');
    const h1 = aboutEl.querySelector('.md-view .md-h1');
    if(view && h1 && !aboutEl.querySelector('.md-bio')){
      const bioWrap = document.createElement('div');
      bioWrap.className = 'md-bio';
      let node = h1.nextElementSibling; // start after H1
      let firstH2 = null;
      while(node){
        if(node.classList && node.classList.contains('md-h2')){ firstH2 = node; break; }
        const next = node.nextElementSibling;
        bioWrap.appendChild(node);
        node = next;
      }
      if(bioWrap.children.length){
        if(firstH2){ view.insertBefore(bioWrap, firstH2); }
        else { view.appendChild(bioWrap); }
      }
    }
  })();

  // ------------------------------------------------------------------------------------

  // Dynamically compute a single outer gap from titlebar height (slightly smaller via --outer-gap-scale)
  function setChromeGaps(){
    const root = document.documentElement;
    const title = document.querySelector('.titlebar');
    const base = title ? Math.ceil(title.getBoundingClientRect().height) : 44;
    const scaleRaw = getComputedStyle(root).getPropertyValue('--outer-gap-scale').trim();
    const scale = parseFloat(scaleRaw) || 0.85;
    const gap = Math.max(8, Math.round(base * scale));
    root.style.setProperty('--outer-gap', gap + 'px');
  }
  setChromeGaps();
  window.addEventListener('resize', setChromeGaps);
  document.querySelector('.editor-header').addEventListener('click', ()=> setTimeout(setChromeGaps, 0));

  document.querySelector('.editor-header').addEventListener('click', (e)=>{
    const tab = e.target.closest('.tab');
    if(!tab) return;
    show(tab.dataset.target);
  });

  // Window control actions
  (function wireWindowButtons(){
    const shell = document.querySelector('.ide-window');
    if(!shell) return;
    const btnMin = document.querySelector('.window-controls .btn.min');
    const btnMax = document.querySelector('.window-controls .btn.max');
    const btnClose = document.querySelector('.window-controls .btn.close');
    if(btnMin){ btnMin.addEventListener('click', ()=>{
      shell.classList.toggle('minimized');
      if(shell.classList.contains('minimized')) shell.classList.remove('maximized');
    }); }
    if(btnMax){ btnMax.addEventListener('click', ()=>{
      const isMobile = window.matchMedia('(max-width: 600px)').matches;
      if(isMobile) return; // Do nothing on mobile when maximize is clicked
      shell.classList.toggle('maximized');
      if(shell.classList.contains('maximized')) shell.classList.remove('minimized');
    }); }
    if(btnClose){ btnClose.addEventListener('click', ()=>{
      shell.classList.add('closed');
      launchPong();
    }); }
  })();

  // Simple Pong game ---------------------------------------------------------
  function launchPong(){
    // Create overlay if missing
    let overlay = document.getElementById('pong-overlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'pong-overlay';
      overlay.className = 'pong-overlay';
      const wrap = document.createElement('div');
      wrap.className = 'pong-wrap';
      const canvas = document.createElement('canvas');
      canvas.id = 'pong-canvas';
      canvas.width = 800; canvas.height = 500;
      wrap.appendChild(canvas);
      overlay.appendChild(wrap);
      document.body.appendChild(overlay);
    }

    overlay.classList.add('show');

    const canvas = overlay.querySelector('#pong-canvas');
    const ctx = canvas.getContext('2d');

    // Ensure theme toggle remains accessible during Pong
    let themeBtn = document.querySelector('.theme-toggle');
    if(themeBtn){
      overlay.appendChild(themeBtn);
      themeBtn.classList.add('in-pong');
      themeBtn.style.position = 'fixed';
      themeBtn.style.top = '16px';
      themeBtn.style.right = '16px';
      themeBtn.style.zIndex = '10001';
    }

    let rafId = null;
    let playing = true;

    function sizeCanvas(){
      const aspectDesktop = 3/4; // height/width for landscape-ish (~4:3)
      const aspectMobile  = 4/3; // height/width for tall portrait (~3:4 width/height)
      const isMobile = window.matchMedia('(max-width: 600px)').matches;
      if(isMobile){
        // Fill (almost) the whole viewport height on mobile; allow free aspect
        const pad = 0; // edge-to-edge
        const targetH = Math.max(200, window.innerHeight - pad*2);
        const targetW = Math.max(200, window.innerWidth - pad*2);
        const h = Math.min(targetH, Math.round(window.innerHeight * 0.998));
        const w = targetW; // use available width
        canvas.width = w;
        canvas.height = h;
      } else {
        // Desktop: almost full viewport height with comfortable margins
        const pad = 24;
        const maxH = Math.max(300, Math.round(window.innerHeight * 0.94) - pad*2);
        const maxW = Math.max(300, Math.round(window.innerWidth * 0.9) - pad*2);
        let h = maxH;
        let w = Math.round(h / aspectDesktop);
        if(w > maxW){
          w = maxW;
          h = Math.round(w * aspectDesktop);
        }
        // Cap extreme width to avoid ultra-wide stretching
        const hardMaxW = 1400;
        if(w > hardMaxW){ w = hardMaxW; h = Math.round(w * aspectDesktop); }
        canvas.width = w;
        canvas.height = h;
      }
    }
    sizeCanvas();

    const state = {
      // Top-vs-bottom paddles (opponent top, player bottom)
      pw: 120,   // paddle width (length)
      ph: 12,    // paddle height (thickness)
      br: 6,     // ball radius (bigger for visibility)
      leftY: 0,  // reuse as top paddle X (left coordinate)
      rightY: 0, // reuse as bottom paddle X (left coordinate)
      bx: 0,
      by: 0,
      bvx: 0,
      bvy: 0,
      speed: 6, // base ball speed in px per frame
      aiSpeed: 6,
      scoreTop: 0,
      scoreBottom: 0,
      left:false, right:false
    };

    function resetBall(dirY = (Math.random()<0.5?-1:1)){
      // dirY: -1 launches upward (toward top), +1 downward (toward bottom)
      state.bx = canvas.width/2;
      state.by = canvas.height/2;
      const angle = (Math.random()*0.6 - 0.3); // -0.3..0.3 rad (~±17deg)
      state.bvy = dirY * state.speed * Math.cos(angle);
      state.bvx = state.speed * Math.sin(angle);
    }

    function resetPaddles(){
      // Slightly thinner paddles
      state.ph = Math.max(6, Math.round(canvas.height*0.018));
      state.pw = Math.max(60, Math.round(canvas.width*0.18));
      // Center paddles horizontally
      state.leftY = (canvas.width - state.pw)/2;   // top paddle X
      state.rightY = (canvas.width - state.pw)/2;  // bottom paddle X
    }

    resetPaddles();
    resetBall();

    // Countdown before start
    let countdownUntil = Date.now() + 3000; // 3 seconds

    // Controls: mouse/touch for right paddle; arrows as fallback
    function onMouse(e){
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width/rect.width);
      state.rightY = Math.max(0, Math.min(canvas.width - state.pw, x - state.pw/2));
    }
    function onTouch(e){
      if(!e.touches || e.touches.length===0) return;
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = (t.clientX - rect.left) * (canvas.width/rect.width);
      state.rightY = Math.max(0, Math.min(canvas.width - state.pw, x - state.pw/2));
    }
    function onKey(e){
      if(e.key==='ArrowLeft' || e.key==='a') state.left=true;
      if(e.key==='ArrowRight' || e.key==='d') state.right=true;
    }
    function onKeyUp(e){
      if(e.key==='ArrowLeft' || e.key==='a') state.left=false;
      if(e.key==='ArrowRight' || e.key==='d') state.right=false;
    }

    canvas.addEventListener('mousemove', onMouse);
    canvas.addEventListener('touchmove', onTouch, {passive:true});
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', ()=>{ sizeCanvas(); resetPaddles(); });

    function stop(){
      playing = false;
      if(rafId) cancelAnimationFrame(rafId);
      overlay.classList.remove('show');
      // Re-open the IDE window
      const shell = document.querySelector('.ide-window');
      if(shell){ shell.classList.remove('closed'); }
      // Cleanup listeners
      canvas.removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('touchmove', onTouch);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      // Return theme toggle to normal placement
      if(themeBtn){
        themeBtn.classList.remove('in-pong');
        themeBtn.style.position = '';
        themeBtn.style.top = '';
        themeBtn.style.right = '';
        themeBtn.style.zIndex = '';
        document.body.appendChild(themeBtn);
        // Trigger re-placement logic bound to resize
        window.dispatchEvent(new Event('resize'));
      }
    }

    function step(){
      const now = Date.now();
      const playingLive = now >= countdownUntil;

      // Keyboard control fallback (only after countdown)
      if(playingLive){
        if(state.left) state.rightY = Math.max(0, state.rightY - 8);
        if(state.right) state.rightY = Math.min(canvas.width - state.pw, state.rightY + 8);
      }

      // AI for top paddle: follow ball X with slight lag (freeze during countdown)
      const targetX = state.bx - state.pw/2;
      if(state.leftY + 6 < targetX) state.leftY = Math.min(targetX, state.leftY + state.aiSpeed);
      else if(state.leftY - 6 > targetX) state.leftY = Math.max(targetX, state.leftY - state.aiSpeed);
      state.leftY = Math.max(0, Math.min(canvas.width - state.pw, state.leftY));

      // Move ball (only after countdown)
      if(playingLive){
        state.bx += state.bvx;
        state.by += state.bvy;
      }

      // Collide left/right walls
      if(state.bx < state.br){ state.bx = state.br; state.bvx = Math.abs(state.bvx); }
      if(state.bx > canvas.width - state.br){ state.bx = canvas.width - state.br; state.bvx = -Math.abs(state.bvx); }

      // Paddle rects (top and bottom)
      const topPad = {x:state.leftY, y:20, w:state.pw, h:state.ph};
      const botPad = {x:state.rightY, y:canvas.height - 20 - state.ph, w:state.pw, h:state.ph};

      // Collisions with paddles
      // Top paddle
      if(state.by - state.br <= topPad.y + topPad.h && state.bx >= topPad.x && state.bx <= topPad.x + topPad.w && state.bvy < 0){
        state.by = topPad.y + topPad.h + state.br;
        state.bvy = Math.abs(state.bvy) * 1.03; // bounce downward and speed up slightly
        const rel = (state.bx - (topPad.x + topPad.w/2)) / (topPad.w/2);
        state.bvx = Math.max(-8, Math.min(8, state.bvx + rel * 3));
      }
      // Bottom paddle
      if(state.by + state.br >= botPad.y && state.bx >= botPad.x && state.bx <= botPad.x + botPad.w && state.bvy > 0){
        state.by = botPad.y - state.br;
        state.bvy = -Math.abs(state.bvy) * 1.03; // bounce upward
        const rel = (state.bx - (botPad.x + botPad.w/2)) / (botPad.w/2);
        state.bvx = Math.max(-8, Math.min(8, state.bvx + rel * 3));
      }

      // Scoring (top or bottom miss) — only active after countdown
      if(playingLive && state.by < -10){
        state.scoreBottom++;
        if(state.scoreBottom >= 5){ gameOver('YOU WIN'); return; }
        resetPaddles();
        resetBall(1);
      }
      if(playingLive && state.by > canvas.height + 10){
        state.scoreTop++;
        if(state.scoreTop >= 5){ gameOver('YOU LOSE'); return; }
        resetPaddles();
        resetBall(-1);
      }

      // Draw
      const cs = getComputedStyle(document.documentElement);
      const colBg = cs.getPropertyValue('--panel-2').trim() || '#11151c';
      const colFg = cs.getPropertyValue('--text').trim() || '#e6edf3';
      const colBorder = cs.getPropertyValue('--border').trim() || '#1f242d';
      const colAccent = cs.getPropertyValue('--accent').trim() || '#58a6ff';

      ctx.fillStyle = colBg; ctx.fillRect(0,0,canvas.width, canvas.height);
      // Center dashed line (horizontal)
      ctx.strokeStyle = colBorder; ctx.setLineDash([6,8]); ctx.beginPath(); ctx.moveTo(10, canvas.height/2); ctx.lineTo(canvas.width-10, canvas.height/2); ctx.stroke(); ctx.setLineDash([]);
      // Paddles
      ctx.fillStyle = colFg; ctx.fillRect(topPad.x, topPad.y, topPad.w, topPad.h); ctx.fillRect(botPad.x, botPad.y, botPad.w, botPad.h);
      // Ball
      ctx.fillStyle = colAccent; ctx.beginPath(); ctx.arc(state.bx, state.by, state.br, 0, Math.PI*2); ctx.fill();
      // Scores on their respective sides; player's (bottom) slightly lower
      ctx.fillStyle = colFg; ctx.font = Math.max(16, Math.round(canvas.width*0.05)) + 'px ui-monospace, monospace'; ctx.textAlign = 'center';
      const yTopScore = Math.round(canvas.height * 0.22);
      const yBotScore = Math.round(canvas.height * 0.78); // moved a little further down
      ctx.fillText(String(state.scoreTop), canvas.width/2, yTopScore);
      ctx.fillText(String(state.scoreBottom), canvas.width/2, yBotScore);

      // Countdown overlay
      if(!playingLive){
        const secs = Math.ceil(Math.max(0, countdownUntil - now) / 1000);
        const label = secs > 0 ? String(secs) : 'GO';
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = colFg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = Math.max(28, Math.round(canvas.width*0.18)) + 'px ui-monospace, monospace';
        ctx.fillText(label, canvas.width/2, canvas.height/2);
        ctx.restore();
      }

      if(playing) rafId = requestAnimationFrame(step);
    }

    playing = true;
    step();

    function gameOver(msg){
      playing = false;
      if(rafId) cancelAnimationFrame(rafId);
      // Draw overlay message on the canvas and auto-exit after 1s
      const cs = getComputedStyle(document.documentElement);
      const colFg = cs.getPropertyValue('--text').trim() || '#e6edf3';
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = colFg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = Math.max(28, Math.round(canvas.width*0.1)) + 'px ui-monospace, monospace';
      ctx.fillText(msg, canvas.width/2, canvas.height/2);
      ctx.restore();
      setTimeout(stop, 1000);
    }
  }

  // Theme toggle --------------------------------------------------------------
  (function themeToggle(){
    const root = document.documentElement;
    const btn = document.querySelector('.theme-toggle');
    if(!btn) return;

    const ICONS = {
      sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
      moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
    };

    function setIcon(theme){
      btn.innerHTML = theme === 'light' ? ICONS.sun : ICONS.moon;
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      btn.setAttribute('title', theme === 'light' ? 'Switch to dark' : 'Switch to light');
    }

    function currentTheme(){
      const saved = localStorage.getItem('theme');
      if(saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function apply(theme){
      if(theme === 'light') root.setAttribute('data-theme','light');
      else root.removeAttribute('data-theme');
      setIcon(theme);
      // Update MUNI icon based on theme; fall back gracefully if asset missing
      const muniImg = document.querySelector('.icon-btn.muni img');
      if(muniImg){
const desired = theme === 'light' ? (muniImg.dataset.srcLight || 'figures/m-black.png') : (muniImg.dataset.srcDark || 'figures/m-white.png');
        if(muniImg.getAttribute('src') !== desired){
          const prev = muniImg.getAttribute('src');
          muniImg.onerror = () => { muniImg.onerror = null; muniImg.setAttribute('src', prev); };
          muniImg.setAttribute('src', desired);
        }
      }
    }

    function toggle(){
      const next = (currentTheme() === 'light') ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      apply(next);
    }

    apply(currentTheme());
    btn.addEventListener('click', toggle);

    // Move the toggle into window controls on narrow screens
    function placeToggle(){
      const small = window.matchMedia('(max-width: 600px)').matches;
      if(small){
        // Try to place inside the current tab's H1 (e.g., About heading); fallback below titlebar
        const activeH1 = document.querySelector('.buffer.show .md-view .md-h1');
        const titlebar = document.querySelector('.titlebar');
        if(activeH1 && btn.parentElement !== activeH1){
          activeH1.appendChild(btn);
          btn.classList.add('in-heading');
        } else if(!activeH1 && titlebar && btn.previousElementSibling !== titlebar){
          titlebar.insertAdjacentElement('afterend', btn);
          btn.classList.remove('in-heading');
        }
      } else {
        // Desktop: fixed at top-right
        if(btn.parentElement !== document.body){
          document.body.appendChild(btn);
        }
        btn.classList.remove('in-heading');
      }
    }
    placeToggle();
    window.addEventListener('resize', placeToggle);
    // Reposition after tab changes
    const header = document.querySelector('.editor-header');
    if(header){ header.addEventListener('click', ()=> setTimeout(placeToggle, 0)); }
  })();
})();
