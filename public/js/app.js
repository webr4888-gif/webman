// webr48 frontend logic: dynamic content, tracking, form, galleries
const API = '';
const sessionId = (sessionStorage.getItem('webr48_sid') || (()=>{const s='sid_'+Math.random().toString(36).slice(2,9)+Date.now().toString(36);sessionStorage.setItem('webr48_sid',s);return s})());

function track(event_type, element_id, meta){
  const payload = JSON.stringify({ event_type, element_id, sessionId, pageUrl: location.href, meta: meta||{} });
  const url = '/api/events';
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], {type:'application/json'});
    navigator.sendBeacon(url, blob);
  } else {
    fetch(url, { method:'POST', headers:{'Content-Type':'application/json','X-Session-Id':sessionId}, body: payload }).catch(()=>{});
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

async function loadContent(){
  try{
    const r = await fetch('/api/content?ts='+Date.now(), { cache:'no-store', headers:{'Cache-Control':'no-cache'} });
    if(!r.ok) throw new Error('content fetch failed');
    const c = await r.json();

    // theme
    const root = document.documentElement;
    if(c.theme_primary) root.style.setProperty('--primary', c.theme_primary);
    if(c.theme_accent) root.style.setProperty('--accent', c.theme_accent);
    if(c.theme_bg) root.style.setProperty('--bg', c.theme_bg);
    if(c.theme_text) root.style.setProperty('--text', c.theme_text);
    if(c.theme_button) root.style.setProperty('--primary', c.theme_button);
    if(c.theme_font) root.style.setProperty('--font', c.theme_font + ", system-ui, sans-serif");

    // urgency
    if(c.urgency_enabled === 'true' || c.urgency_enabled === true){
      const el=document.getElementById('urgency');
      el.textContent=c.urgency_text||'';
      el.classList.remove('hidden');
    }

    // helper to set text
    const set=(id,val)=>{ const el=document.getElementById(id); if(el && val!=null) el.textContent=String(val); };
    const setHtml=(id,val)=>{ const el=document.getElementById(id); if(el && val!=null) el.textContent=String(val); };
    // nav links (data-i bindings)
    document.querySelectorAll('[data-i]').forEach(el=>{
      const k=el.getAttribute('data-i');
      if(k && c[k]!=null) el.textContent = String(c[k]);
    });

    // nav / logo — text fallback + image logo + favicon
    const siteLogo = (c.site_logo || '').toString().trim();
    const siteLogoTextVal = (c.site_logo_text || '').toString().trim();
    const logoImg = document.getElementById('siteLogoImg');
    const logoLink = document.getElementById('logoLink');
    const logoTextEl = document.getElementById('logoText');
    const footerLogoImg = document.getElementById('footerLogoImg');
    const footerLogoWrap = document.getElementById('footerLogoWrap');
    // set logo text first (fallback)
    if(siteLogoTextVal) {
      const suffix = c.nav_logo_suffix || '48';
      const logo = siteLogoTextVal;
      if(suffix && logo.includes(suffix)) logoTextEl.innerHTML = escapeHtml(logo).replace(escapeHtml(suffix), `<span>${escapeHtml(suffix)}</span>`);
      else logoTextEl.textContent = logo;
      // also sync footer text
      const ft=document.getElementById('footerLogoText');
      if(ft) ft.textContent = logo;
    } else if(c.site_logo_text) {
      const suffix = c.nav_logo_suffix || '48';
      const logo = String(c.site_logo_text);
      if(suffix && logo.includes(suffix)) logoTextEl.innerHTML = escapeHtml(logo).replace(suffix, `<span>${escapeHtml(suffix)}</span>`);
      else logoTextEl.textContent = logo;
    }
    // if image logo is configured, show it and hide text via CSS class
    if(siteLogo){
      logoImg.src = siteLogo;
      logoImg.style.display = 'block';
      logoImg.alt = siteLogoTextVal || 'site logo';
      if(logoLink) logoLink.classList.add('has-image');
      if(footerLogoImg){ footerLogoImg.src = siteLogo; footerLogoImg.style.display='block'; if(footerLogoWrap) footerLogoWrap.classList.add('has-image'); }
      logoImg.onerror = ()=>{ logoImg.style.display='none'; if(logoLink) logoLink.classList.remove('has-image'); if(footerLogoImg) footerLogoImg.style.display='none'; if(footerLogoWrap) footerLogoWrap.classList.remove('has-image'); };
    } else {
      logoImg.style.display='none';
      if(logoLink) logoLink.classList.remove('has-image');
      if(footerLogoImg) footerLogoImg.style.display='none';
      if(footerLogoWrap) footerLogoWrap.classList.remove('has-image');
    }

    // favicon
    const siteFavicon = (c.site_favicon || '').toString().trim();
    if(siteFavicon){
      const favEl=document.getElementById('favicon');
      const favPngEl=document.getElementById('favicon-png');
      const appleEl=document.getElementById('appleTouchIcon');
      if(favEl) favEl.href = siteFavicon;
      if(favPngEl) favPngEl.href = siteFavicon;
      if(appleEl) appleEl.href = siteFavicon;
    }
    if(c.site_tagline) { const el=document.getElementById('siteTagline'); if(el) el.textContent=String(c.site_tagline); }
    // hero
    set('heroHeadline', c.hero_headline);
    set('heroSub', c.hero_subheadline);
    set('heroBadge', c.hero_badge);
    set('heroStars', c.hero_trust_stars);
    set('heroFloatTitle', c.hero_float_title);
    set('heroFloatSub', c.hero_float_sub);
    set('heroFloatStat', c.hero_float_stat);
    set('heroFloatLabel', c.hero_float_stat_label);
    if(c.hero_image) document.getElementById('heroImg').src = c.hero_image;
    if(c.hero_cta_primary) document.getElementById('heroBook').textContent = c.hero_cta_primary;
    if(c.hero_cta_secondary) document.getElementById('heroWhatsapp').textContent = c.hero_cta_secondary;
    if(c.whatsapp_prefill) { /* used for waLink below */ }
    if(c.cta_book_label){ document.getElementById('navBook').textContent=c.cta_book_label; }
    if(c.cta_whatsapp_label){ document.getElementById('navWhatsapp').textContent=c.cta_whatsapp_label; }

    // whatsapp / booking links
    const waNum = (c.whatsapp_number||'2348123456789').replace(/\D/g,'');
    const waMsg = encodeURIComponent(c.whatsapp_prefill||'Hi, I want to start a dropshipping store with webr48');
    const waLink = `https://wa.me/${waNum}?text=${waMsg}`;
    const bookLink = c.booking_link || 'https://calendly.com/webr48/intro';
    for(const id of ['navWhatsapp','heroWhatsapp','sideWhatsapp','footerWhatsapp']){
      const el=document.getElementById(id);
      if(el){ el.href = waLink; }
    }
    for(const id of ['navBook','heroBook','sideBook']){
      const el=document.getElementById(id);
      if(el){ el.href = bookLink; }
    }

    // stats
    set('statStores', c.stat_stores);
    set('statStoresL', c.stat_stores_label);
    set('statSales', c.stat_sales);
    set('statSalesL', c.stat_sales_label);
    set('statRating', c.stat_rating);
    set('statRatingL', c.stat_rating_label);
    set('statSupport', c.stat_support);
    set('statSupportL', c.stat_support_label);
    if(c.stat_stores && c.stat_sales) set('trustLine', `${c.stat_stores} stores launched • ${c.stat_sales} verified sales`);

    // headings
    set('portfolioH', c.portfolio_heading);
    set('portfolioP', c.portfolio_subheading);
    set('salesH', c.sales_heading);
    set('salesP', c.sales_subheading);
    set('howH', c.how_heading);
    set('howP', c.how_subheading);
    set('how1t', c.how_step_1_title);
    set('how1d', c.how_step_1_desc);
    set('how2t', c.how_step_2_title);
    set('how2d', c.how_step_2_desc);
    set('how3t', c.how_step_3_title);
    set('how3d', c.how_step_3_desc);
    set('how4t', c.how_step_4_title);
    set('how4d', c.how_step_4_desc);
    set('pricingH', c.pricing_heading);
    set('pricingP', c.pricing_subheading);
    set('priceStarterN', c.pricing_starter_name);
    set('priceStarterP', c.pricing_starter_price);
    set('priceProN', c.pricing_pro_name);
    set('priceProP', c.pricing_pro_price);
    set('priceCustomN', c.pricing_custom_name);
    set('priceCustomP', c.pricing_custom_price);
    set('pricingProPill', c.pricing_pro_pill);
    // features (stored as JSON strings)
    function renderFeatures(id, val){
      const el=document.getElementById(id);
      if(!el || !val) return;
      let arr=[]; try{ arr = typeof val==='string'? JSON.parse(val) : val; }catch{ arr=[String(val)] }
      el.innerHTML = arr.map(f=>`<li>${escapeHtml(f)}</li>`).join('');
    }
    renderFeatures('priceStarterF', c.pricing_starter_features);
    renderFeatures('priceProF', c.pricing_pro_features);
    renderFeatures('priceCustomF', c.pricing_custom_features);

    set('testiH', c.testimonials_heading);
    set('testiP', c.testimonials_subheading);
    set('faqH', c.faq_heading);
    set('faqP', c.faq_subheading);
    set('leadH', c.lead_heading);
    set('leadP', c.lead_subheading);
    set('leadSideHeading', c.lead_side_heading);
    set('leadSideSub', c.lead_side_sub);
    set('leadTick1', c.lead_side_tick1);
    set('leadTick2', c.lead_side_tick2);
    set('leadTick3', c.lead_side_tick3);
    set('leadTick4', c.lead_side_tick4);
    if(c.lead_side_whatsapp) document.getElementById('sideWhatsapp').textContent = c.lead_side_whatsapp;
    if(c.lead_side_book) document.getElementById('sideBook').textContent = c.lead_side_book;
    set('leadSideFooter', c.lead_side_footer);
    set('footerAbout', c.footer_about);
    set('footerEmail', c.footer_email);
    set('footerContactTitle', c.footer_contact_title);
    set('footerLinksTitle', c.footer_links_title);
    if(c.footer_whatsapp_label) document.getElementById('footerWhatsapp').textContent = c.footer_whatsapp_label;
    set('footerLegal', c.footer_legal);

    // testimonials
    let testis=[];
    try{ testis = typeof c.testimonials==='string'? JSON.parse(c.testimonials): c.testimonials||[] }catch{ testis=[] }
    const tg=document.getElementById('testiGrid');
    if(Array.isArray(testis) && testis.length){
      tg.innerHTML = testis.map(t=>`
        <div class="t-card">
          <div class="t-head">
            <img src="${escapeHtml(t.photo||'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80')}" alt="${escapeHtml(t.name||'')}" />
            <div><b>${escapeHtml(t.name||'')}</b><br><span>${escapeHtml(t.role||'')}</span></div>
          </div>
          <p>"${escapeHtml(t.quote||'')}"</p>
        </div>
      `).join('');
    }

    // faq
    let faqs=[];
    try{ faqs = typeof c.faq_items==='string'? JSON.parse(c.faq_items): c.faq_items||[] }catch{ faqs=[] }
    const fl=document.getElementById('faqList');
    if(Array.isArray(faqs)){
      fl.innerHTML = faqs.map(f=>`
        <div class="faq-item">
          <button class="faq-q" type="button"><span>${escapeHtml(f.q||f.question||'')}</span><span>+</span></button>
          <div class="faq-a">${escapeHtml(f.a||f.answer||'')}</div>
        </div>
      `).join('');
      fl.querySelectorAll('.faq-q').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const item=btn.closest('.faq-item');
          item.classList.toggle('open');
          track('faq_toggle', btn.textContent.slice(0,60));
        });
      });
    }

  }catch(e){ console.warn('loadContent error', e); }
}

async function loadMedia(){
  try{
    const r=await fetch('/api/media');
    const all=await r.json();
    const portfolio = all.filter(m=>m.category==='portfolio');
    const sales = all.filter(m=>m.category==='sales_proof');
    function render(list, containerId){
      const c=document.getElementById(containerId);
      if(!c) return;
      if(!list.length){ c.innerHTML='<p class="muted" style="text-align:center;grid-column:1/-1">No images yet. Add them in the admin panel.</p>'; return; }
      c.innerHTML=list.map(m=>`
        <div class="g-card" data-url="${escapeHtml(m.url)}" data-caption="${escapeHtml(m.caption||'')}">
          <img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.caption||'store')}" loading="lazy" />
          ${m.caption?`<div class="cap">${escapeHtml(m.caption)}</div>`:''}
        </div>
      `).join('');
      c.querySelectorAll('.g-card').forEach(card=>{
        card.addEventListener('click', ()=>{
          document.getElementById('lbImg').src=card.dataset.url;
          document.getElementById('lightbox').classList.add('open');
          track('gallery_view', containerId+':'+card.dataset.url);
        });
      });
    }
    render(portfolio,'portfolioGrid');
    render(sales,'salesGrid');
  }catch(e){ console.warn('loadMedia',e)}
}

// lightbox close
document.getElementById('lbClose').addEventListener('click', ()=> document.getElementById('lightbox').classList.remove('open'));
document.getElementById('lightbox').addEventListener('click', (e)=>{ if(e.target.id==='lightbox') e.currentTarget.classList.remove('open') });

// mobile toggle
document.getElementById('mobToggle').addEventListener('click', ()=>{
  document.getElementById('navLinks').classList.toggle('open');
});

// scam details conditional
document.querySelectorAll('input[name="wasScammed"]').forEach(r=>{
  r.addEventListener('change', ()=>{
    document.getElementById('scamDetailsWrap').style.display = (r.value==='yes' && r.checked) ? 'grid' : 'none';
  });
});
// also handle any change on group
document.addEventListener('change', (e)=>{
  if(e.target.name==='wasScammed'){
    const v=document.querySelector('input[name="wasScammed"]:checked')?.value;
    document.getElementById('scamDetailsWrap').style.display = v==='yes' ? 'grid' : 'none';
  }
});

// form
const form=document.getElementById('leadForm');
let formStarted=false;
form.addEventListener('focusin', ()=>{
  if(!formStarted){ formStarted=true; track('form_start','lead_form'); }
});
form.addEventListener('input', ()=>{
  if(!formStarted){ formStarted=true; track('form_start','lead_form'); }
});

function setErr(name, msg){
  const el=document.querySelector(`[data-err="${name}"]`);
  if(el) el.textContent=msg||'';
}
form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  // clear errs
  ['name','storeName','budget','storeStatus','wasScammed','whatsapp','email','consent','form'].forEach(k=>setErr(k,''));
  const fd=new FormData(form);
  const data={
    name: (fd.get('name')||'').toString().trim(),
    storeName: (fd.get('storeName')||'').toString().trim(),
    budget: (fd.get('budget')||'').toString().trim(),
    storeStatus: (fd.get('storeStatus')||'').toString().trim(),
    wasScammed: (fd.get('wasScammed')||'').toString().trim(),
    scamDetails: (fd.get('scamDetails')||'').toString().trim(),
    whatsapp: (fd.get('whatsapp')||'').toString().trim(),
    email: (fd.get('email')||'').toString().trim(),
    hearAbout: (fd.get('hearAbout')||'').toString().trim(),
    contactTime: (fd.get('contactTime')||'').toString().trim(),
    consent: !!fd.get('consent'),
    website: (fd.get('website')||'').toString().trim(),
    source: (fd.get('hearAbout')||'').toString().trim(),
    pageUrl: location.href
  };
  let hasError=false;
  if(!data.name || data.name.length<2){ setErr('name','Full name required'); hasError=true; }
  if(!data.storeName){ setErr('storeName','Store name required'); hasError=true; }
  if(!data.budget){ setErr('budget','Budget required'); hasError=true; }
  if(!data.storeStatus){ setErr('storeStatus','Choose one'); hasError=true; }
  if(!data.wasScammed){ setErr('wasScammed','Choose one'); hasError=true; }
  if(!data.whatsapp || !/^\+?[0-9\s\-()]{8,20}$/.test(data.whatsapp)){ setErr('whatsapp','Valid WhatsApp number required'); hasError=true; }
  if(!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)){ setErr('email','Valid email required'); hasError=true; }
  if(!data.consent){ setErr('consent','Consent required'); hasError=true; }
  if(hasError){ track('form_error','lead_form'); return; }

  const btn=form.querySelector('button[type="submit"]');
  const old=btn.textContent; btn.textContent='Sending…'; btn.disabled=true;
  try{
    const r=await fetch('/api/leads', {
      method:'POST',
      headers:{'Content-Type':'application/json','X-Session-Id':sessionId},
      body: JSON.stringify(data)
    });
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||'Submission failed');
    track('form_submit','lead_form', { budget:data.budget, wasScammed:data.wasScammed });
    const waNum = document.getElementById('navWhatsapp')?.href || '#';
    const successEl=document.getElementById('formSuccess');
    successEl.innerHTML = `Thanks! We'll reach out on WhatsApp within 24 hours. <br><a href="${waNum}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px" class="btn btn-whatsapp">Open WhatsApp →</a>`;
    successEl.classList.add('show');
    form.reset();
    document.getElementById('scamDetailsWrap').style.display='none';
    setTimeout(()=> successEl.classList.remove('show'), 12000);
  }catch(err){
    setErr('form', err.message);
  }finally{
    btn.textContent=old; btn.disabled=false;
  }
});

// tracking: pageview + CTA clicks
track('pageview', 'landing', { url: location.href, utm: location.search });
document.addEventListener('click', (e)=>{
  const a=e.target.closest('[data-track]');
  if(a){
    const id=a.getAttribute('data-track');
    track('cta_click', id, { href: a.getAttribute('href')||'', text: a.textContent.trim().slice(0,80) });
  }
});

// init
loadContent();
loadMedia();
// auto-refresh frontend when admin publishes (poll published_at every 10s)
let lastPublished=null;
setInterval(async()=>{
  try{
    const r=await fetch('/api/content/publish?ts='+Date.now(),{cache:'no-store'});
    const j=await r.json();
    if(j.published_at && lastPublished && j.published_at!==lastPublished){
      loadContent(); loadMedia();
    }
    lastPublished=j.published_at||null;
  }catch{}
},10000);
// init poll baseline
fetch('/api/content/publish?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(j=>{lastPublished=j.published_at||null}).catch(()=>{});

// also refresh on visibility change (instant when tab refocused after publish)
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ loadContent(); } });
