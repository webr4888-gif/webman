const tokenKey='webr48_admin_token';
function getToken(){ return localStorage.getItem(tokenKey); }
function setToken(t){ localStorage.setItem(tokenKey, t); }
function headers(){ const h={'Content-Type':'application/json'}; const t=getToken(); if(t) h.Authorization='Bearer '+t; return h; }
function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

const loginView=document.getElementById('loginView');
const appView=document.getElementById('appView');

async function checkAuth(){
  const t=getToken();
  if(!t){ showLogin(); return; }
  try{
    const r=await fetch('/api/auth/me',{headers:headers()});
    if(!r.ok) throw new Error();
    const j=await r.json();
    document.getElementById('userLabel').textContent=j.user.username;
    showApp();
  }catch{ showLogin(); }
}
function showLogin(){ loginView.classList.remove('hidden'); appView.classList.add('hidden'); }
function showApp(){ loginView.classList.add('hidden'); appView.classList.remove('hidden'); loadAll(); }

document.getElementById('loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  document.getElementById('loginErr').textContent='';
  try{
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:fd.get('username'),password:fd.get('password')})});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||'Login failed');
    setToken(j.token);
    document.getElementById('userLabel').textContent=j.username;
    showApp();
  }catch(err){ document.getElementById('loginErr').textContent=err.message; }
});
document.getElementById('logoutBtn').addEventListener('click', ()=>{ localStorage.removeItem(tokenKey); showLogin(); });

// tabs
document.querySelectorAll('.side-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.side-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const tab=b.dataset.tab;
    document.querySelectorAll('main section').forEach(s=>s.classList.add('hidden'));
    document.getElementById('tab-'+tab).classList.remove('hidden');
    if(tab==='leads') loadLeads();
    if(tab==='analytics') loadAnalytics();
    if(tab==='media') loadMedia();
  });
});

// ---------- CONTENT ----------
let contentCache={};
const contentFields=[
  ['site_logo_text','Logo text'],
  ['cta_book_label','CTA Book label'],
  ['cta_whatsapp_label','CTA WhatsApp label'],
  ['hero_headline','Hero headline'],
  ['hero_subheadline','Hero subheadline'],
  ['hero_cta_primary','Hero primary CTA'],
  ['hero_cta_secondary','Hero secondary CTA'],
  ['hero_badge','Hero badge'],
  ['hero_image','Hero image URL'],
  ['stat_stores','Stat stores'],
  ['stat_stores_label','Stat stores label'],
  ['stat_sales','Stat sales'],
  ['stat_sales_label','Stat sales label'],
  ['stat_rating','Stat rating'],
  ['stat_rating_label','Stat rating label'],
  ['stat_support','Stat support'],
  ['stat_support_label','Stat support label'],
  ['portfolio_heading','Portfolio heading'],
  ['portfolio_subheading','Portfolio sub'],
  ['sales_heading','Sales heading'],
  ['sales_subheading','Sales sub'],
  ['how_heading','How heading'],
  ['how_subheading','How sub'],
  ['pricing_heading','Pricing heading'],
  ['pricing_subheading','Pricing sub'],
  ['pricing_starter_name','Starter name'],
  ['pricing_starter_price','Starter price'],
  ['pricing_pro_name','Pro name'],
  ['pricing_pro_price','Pro price'],
  ['pricing_pro_pill','Pro pill'],
  ['pricing_custom_name','Custom name'],
  ['pricing_custom_price','Custom price'],
];
const navFields=[
  ['site_tagline','Tagline (under logo if used)'],
  ['nav_logo_suffix','Logo suffix to highlight (e.g. 48)'],
  ['nav_link_services','Nav: Services'],
  ['nav_link_proof','Nav: Proof'],
  ['nav_link_pricing','Nav: Pricing'],
  ['nav_link_faq','Nav: FAQ'],
  ['whatsapp_prefill','WhatsApp prefill message'],
];
const heroExtrasFields=[
  ['hero_trust_stars','Hero trust stars (★ 4.9/5)'],
  ['hero_float_title','Hero float title (Live store preview)'],
  ['hero_float_sub','Hero float sub (Checkout tested)'],
  ['hero_float_stat','Hero float stat (3.2%)'],
  ['hero_float_stat_label','Hero float stat label (conversion)'],
  ['social_proof_title','Social proof title'],
];
const howFields=[
  ['how_step_1_title','Step 1 title'],['how_step_1_desc','Step 1 desc'],
  ['how_step_2_title','Step 2 title'],['how_step_2_desc','Step 2 desc'],
  ['how_step_3_title','Step 3 title'],['how_step_3_desc','Step 3 desc'],
  ['how_step_4_title','Step 4 title'],['how_step_4_desc','Step 4 desc'],
];
const pricingFields=[
  ['pricing_starter_features','Starter features (JSON array)'],
  ['pricing_pro_features','Pro features (JSON)'],
  ['pricing_custom_features','Custom features (JSON)'],
  ['testimonials_heading','Testimonials heading'],
  ['testimonials_subheading','Testimonials sub'],
  ['faq_heading','FAQ heading'],
  ['faq_subheading','FAQ sub'],
  ['lead_heading','Lead heading'],
  ['lead_subheading','Lead sub'],
];
const leadSideFields=[
  ['lead_side_heading','Lead side heading'],
  ['lead_side_sub','Lead side sub'],
  ['lead_side_tick1','Lead tick 1'],
  ['lead_side_tick2','Lead tick 2'],
  ['lead_side_tick3','Lead tick 3'],
  ['lead_side_tick4','Lead tick 4'],
  ['lead_side_whatsapp','Lead WhatsApp button'],
  ['lead_side_book','Lead Book button'],
  ['lead_side_footer','Lead side footer (Avg response)'],
];
const footerFields=[
  ['footer_about','Footer about'],
  ['footer_email','Footer email'],
  ['footer_contact_title','Footer Contact title'],
  ['footer_links_title','Footer Links title'],
  ['footer_whatsapp_label','Footer WhatsApp label'],
  ['footer_legal','Footer legal'],
];

function buildForm(containerId, fields){
  const c=document.getElementById(containerId);
  if(!c) return;
  c.innerHTML=fields.map(([k,label])=>{
    const isLong = k.includes('headline')||k.includes('subheading')||k.includes('about')||k.includes('desc')||k.includes('tick')||k.includes('prefill')||k.includes('footer');
    const isJson = k.includes('features') || k.startsWith('pricing_') && k.includes('features');
    const tag = isJson ? 'textarea' : (isLong? 'textarea':'input');
    return `<div class="field"><label>${esc(label)} <span class="muted" style="font-weight:400">(${k})</span></label><${tag} data-key="${k}" ${tag==='textarea'?'rows="2"':''}></${tag}></div>`;
  }).join('');
}
buildForm('contentForm', contentFields);
buildForm('navForm', navFields);
buildForm('heroExtrasForm', heroExtrasFields);
buildForm('howForm', howFields);
buildForm('pricingForm', pricingFields);
buildForm('leadSideForm', leadSideFields);
buildForm('footerForm', footerFields);

async function loadContent(){
  const r=await fetch('/api/content');
  const j=await r.json();
  contentCache=j;
  document.querySelectorAll('[data-key]').forEach(el=>{
    const k=el.dataset.key;
    const v=j[k];
    el.value = v==null? '' : (typeof v==='string'? v : JSON.stringify(v));
  });
  document.getElementById('testimonialsJson').value = typeof j.testimonials==='string'? j.testimonials : JSON.stringify(j.testimonials||[],null,2);
  document.getElementById('faqJson').value = typeof j.faq_items==='string'? j.faq_items : JSON.stringify(j.faq_items||[],null,2);
  // theme
  document.getElementById('thPrimary').value = j.theme_primary||'#6C5CE7';
  document.getElementById('thAccent').value = j.theme_accent||'#00cec9';
  document.getElementById('thBg').value = j.theme_bg||'#ffffff';
  document.getElementById('thText').value = j.theme_text||'#0f172a';
  document.getElementById('thButton').value = j.theme_button||'#6C5CE7';
  document.getElementById('thFont').value = j.theme_font||'Inter';
  document.getElementById('thWa').value = j.whatsapp_number||'';
  document.getElementById('thBook').value = j.booking_link||'';
  document.getElementById('thUrgEn').value = String(j.urgency_enabled||'false');
  document.getElementById('thUrgText').value = j.urgency_text||'';
  // advanced: show any keys not in known lists
  const known = new Set([
    ...contentFields.map(([k])=>k), ...navFields.map(([k])=>k), ...heroExtrasFields.map(([k])=>k),
    ...howFields.map(([k])=>k), ...pricingFields.map(([k])=>k), ...leadSideFields.map(([k])=>k), ...footerFields.map(([k])=>k),
    'testimonials','faq_items','theme_primary','theme_accent','theme_bg','theme_text','theme_button','theme_font','whatsapp_number','booking_link','urgency_enabled','urgency_text'
  ]);
  const advancedKeys = Object.keys(j).filter(k=> !known.has(k));
  const advContainer = document.getElementById('advancedForm');
  if(advContainer){
    if(advancedKeys.length===0){
      advContainer.innerHTML = '<span class="muted" style="font-size:12px">All keys are covered above. Add new content via API and it will appear here.</span>';
    } else {
      advContainer.innerHTML = advancedKeys.map(k=>{
        const v=j[k];
        const val = v==null? '' : (typeof v==='string'? v : JSON.stringify(v, null, 2));
        const isLong = val.length>80 || k.includes('heading') || k.includes('desc');
        const tag = isLong ? 'textarea' : 'input';
        return `<div class="field"><label>${esc(k)} <span class="muted" style="font-weight:400">(${k})</span></label><${tag} data-key="${k}" ${tag==='textarea'?'rows="2"':''}>${esc(val)}</${tag}></div>`;
      }).join('');
      // populate values after render
      advContainer.querySelectorAll('[data-key]').forEach(el=>{
        const k=el.dataset.key; const v=j[k];
        el.value = v==null? '' : (typeof v==='string'? v : JSON.stringify(v));
      });
    }
  }
}

document.getElementById('saveContent').addEventListener('click', async ()=>{
  const payload={};
  document.querySelectorAll('[data-key]').forEach(el=> payload[el.dataset.key]=el.value);
  payload.testimonials = document.getElementById('testimonialsJson').value;
  payload.faq_items = document.getElementById('faqJson').value;
  // validate JSON fields
  for(const k of ['pricing_starter_features','pricing_pro_features','pricing_custom_features','testimonials','faq_items']){
    const v=payload[k];
    if(v){ try{ JSON.parse(v); }catch(e){ alert('Invalid JSON for '+k+': '+e.message); return; } }
  }
  document.getElementById('saveMsg').textContent='Saving…';
  const r=await fetch('/api/content',{method:'PUT',headers:headers(),body:JSON.stringify(payload)});
  const j=await r.json();
  document.getElementById('saveMsg').textContent = r.ok? 'Saved ✓' : (j.error||'Failed');
  setTimeout(()=>document.getElementById('saveMsg').textContent='',2000);
});

// ---------- MEDIA ----------
async function loadMedia(){
  const r=await fetch('/api/media');
  const all=await r.json();
  function render(cat, containerId){
    const list=all.filter(m=>m.category===cat);
    const c=document.getElementById(containerId);
    c.innerHTML = list.map(m=>`
      <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff">
        <img src="${esc(m.url)}" class="preview-img" />
        <div style="padding:8px">
          <div style="font-size:12px;color:#475569">${esc(m.caption||'')}</div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="btn btn-sm" onclick="deleteMedia(${m.id})">Delete</button>
          </div>
        </div>
      </div>
    `).join('') || '<span class="muted">No images</span>';
  }
  render('portfolio','portfolioAdmin');
  render('sales_proof','salesAdmin');
}
window.deleteMedia=async (id)=>{
  if(!confirm('Delete image?')) return;
  await fetch('/api/media/'+id,{method:'DELETE',headers:headers()});
  loadMedia();
};
document.getElementById('upBtn').addEventListener('click', async ()=>{
  const cat=document.getElementById('upCategory').value;
  const caption=document.getElementById('upCaption').value;
  const file=document.getElementById('upFile').files[0];
  const url=document.getElementById('upUrl').value.trim();
  document.getElementById('upMsg').textContent='Uploading…';
  try{
    let res;
    if(file){
      const fd=new FormData();
      fd.append('image', file);
      fd.append('category', cat);
      fd.append('caption', caption);
      res=await fetch('/api/media',{method:'POST',headers:{Authorization: headers().Authorization},body:fd});
    } else {
      if(!url) throw new Error('Pick a file or enter URL');
      res=await fetch('/api/media',{method:'POST',headers:headers(),body:JSON.stringify({category:cat,caption,url})});
    }
    const j=await res.json();
    if(!res.ok) throw new Error(j.error||'Upload failed');
    document.getElementById('upMsg').textContent='Uploaded ✓';
    document.getElementById('upFile').value=''; document.getElementById('upUrl').value=''; document.getElementById('upCaption').value='';
    loadMedia();
  }catch(e){ document.getElementById('upMsg').textContent=e.message; }
  setTimeout(()=>document.getElementById('upMsg').textContent='',2000);
});

// ---------- LEADS ----------
let leadsCache=[];
async function loadLeads(){
  const r=await fetch('/api/leads',{headers:headers()});
  leadsCache=await r.json();
  renderLeads();
}
function renderLeads(){
  const q=(document.getElementById('leadSearch').value||'').toLowerCase();
  const fScam=document.getElementById('leadFilterScam').value;
  const fStatus=document.getElementById('leadFilterStatus').value;
  let list=leadsCache.filter(l=>{
    if(fScam && l.was_scammed!==fScam) return false;
    if(fStatus && l.status!==fStatus) return false;
    if(q && ![l.name,l.email,l.whatsapp,l.store_name].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
  const body=document.getElementById('leadsBody');
  body.innerHTML=list.map(l=>`
    <tr>
      <td>${esc(l.name)}</td>
      <td>${esc(l.store_name)}</td>
      <td>${esc(l.budget)}</td>
      <td>${esc(l.store_status)}</td>
      <td>${l.was_scammed==='yes'?'<span style="color:#dc2626;font-weight:700">yes</span>':esc(l.was_scammed)}${l.scam_details?`<br><span class="muted">${esc(l.scam_details.slice(0,60))}</span>`:''}</td>
      <td><a href="https://wa.me/${String(l.whatsapp).replace(/\D/g,'')}" target="_blank">${esc(l.whatsapp)}</a></td>
      <td>${esc(l.email)}</td>
      <td>${esc(l.source||'')}</td>
      <td><span class="badge ${l.webhook_status==='sent'?'sent':l.webhook_status==='failed'?'failed':'new'}">${esc(l.webhook_status)}</span> ${l.webhook_status==='failed'?`<button class="btn btn-sm" onclick="retryWebhook(${l.id})">Retry</button>`:''}</td>
      <td>
        <select onchange="updateLeadStatus(${l.id}, this.value)" style="padding:6px;border-radius:8px;border:1px solid #e2e8f0">
          <option value="new" ${l.status==='new'?'selected':''}>new</option>
          <option value="contacted" ${l.status==='contacted'?'selected':''}>contacted</option>
          <option value="booked" ${l.status==='booked'?'selected':''}>booked</option>
          <option value="closed" ${l.status==='closed'?'selected':''}>closed</option>
        </select>
      </td>
      <td>${esc((l.created_at||'').slice(0,16).replace('T',' '))}</td>
      <td><button class="btn btn-sm" onclick="retryWebhook(${l.id})">Resend webhook</button></td>
    </tr>
  `).join('') || '<tr><td colspan="12" class="muted">No leads</td></tr>';
}
window.updateLeadStatus=async (id,val)=>{
  await fetch('/api/leads/'+id,{method:'PATCH',headers:headers(),body:JSON.stringify({status:val})});
  const l=leadsCache.find(x=>x.id===id); if(l) l.status=val;
};
window.retryWebhook=async (id)=>{
  const r=await fetch('/api/leads/'+id+'/retry-webhook',{method:'POST',headers:headers()});
  const j=await r.json();
  alert(r.ok? 'Webhook '+j.webhook_status : 'Failed: '+(j.error||'')); loadLeads();
};
document.getElementById('leadSearch').addEventListener('input', renderLeads);
document.getElementById('leadFilterScam').addEventListener('change', renderLeads);
document.getElementById('leadFilterStatus').addEventListener('change', renderLeads);
document.getElementById('exportCsv').addEventListener('click', ()=>{
  const t=getToken();
  window.location='/api/leads/export/csv';
  // use authenticated fetch to trigger download with token
  fetch('/api/leads/export/csv',{headers:headers()}).then(r=>r.blob()).then(b=>{
    const url=URL.createObjectURL(b);
    const a=document.createElement('a'); a.href=url; a.download='webr48-leads.csv'; a.click(); URL.revokeObjectURL(url);
  });
});

// ---------- ANALYTICS ----------
async function loadAnalytics(){
  const r=await fetch('/api/analytics',{headers:headers()});
  const j=await r.json();
  document.getElementById('kpiViews').textContent=j.totals.pageviews;
  document.getElementById('kpiVisitors').textContent=j.totals.uniqueVisitors;
  document.getElementById('kpiCta').textContent=j.totals.ctaClicks;
  document.getElementById('kpiLeads').textContent=j.totals.totalLeads;
  document.getElementById('kpiStarts').textContent=j.totals.formStarts;
  document.getElementById('kpiSubmits').textContent=j.totals.formSubmits;
  document.getElementById('kpiDrop').textContent=j.totals.funnelDropOff+'%';
  document.getElementById('kpiEvents').textContent=j.totals.totalEvents;
  document.getElementById('byElement').innerHTML=Object.entries(j.byElement||{}).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span>${esc(k)}</span><b>${v}</b></div>`).join('')||'<span class="muted">No clicks yet</span>';
  document.getElementById('bySource').innerHTML=Object.entries(j.bySource||{}).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span>${esc(k||'unknown')}</span><b>${v}</b></div>`).join('')||'<span class="muted">No sources yet</span>';
  const eb=document.getElementById('eventsBody');
  eb.innerHTML=(j.recentEvents||[]).map(e=>`<tr><td>${esc((e.created_at||'').slice(0,19).replace('T',' '))}</td><td>${esc(e.event_type)}</td><td>${esc(e.element_id||'')}</td><td>${esc((e.session_id||'').slice(0,8))}</td><td class="muted" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(e.page_url||'')}</td></tr>`).join('');
  // simple bar chart for daily
  drawChart(j.byDay||{});
}
function drawChart(byDay){
  const canvas=document.getElementById('chart');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const days=Object.keys(byDay).sort();
  const vals=days.map(d=>byDay[d]);
  const max=Math.max(1,...vals);
  const pad=30;
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#e2e8f0'; ctx.strokeRect(pad,10,W-pad*2,H-40);
  if(!days.length){ ctx.fillStyle='#64748b'; ctx.font='12px Inter'; ctx.fillText('No data yet', W/2-40, H/2); return; }
  const barW=(W-pad*2)/days.length*0.6;
  days.forEach((d,i)=>{
    const v=vals[i];
    const h=(H-60)*v/max;
    const x=pad + (W-pad*2)/days.length*i + ((W-pad*2)/days.length - barW)/2;
    const y=H-30 - h;
    ctx.fillStyle='#6C5CE7';
    ctx.fillRect(x,y,barW,h);
    ctx.fillStyle='#64748b'; ctx.font='10px Inter'; ctx.fillText(d.slice(5), x, H-14);
    ctx.fillText(String(v), x, y-4);
  });
}

// ---------- THEME ----------
document.getElementById('saveTheme').addEventListener('click', async ()=>{
  const payload={
    theme_primary: document.getElementById('thPrimary').value,
    theme_accent: document.getElementById('thAccent').value,
    theme_bg: document.getElementById('thBg').value,
    theme_text: document.getElementById('thText').value,
    theme_button: document.getElementById('thButton').value,
    theme_font: document.getElementById('thFont').value,
    whatsapp_number: document.getElementById('thWa').value,
    booking_link: document.getElementById('thBook').value,
    urgency_enabled: document.getElementById('thUrgEn').value,
    urgency_text: document.getElementById('thUrgText').value,
  };
  document.getElementById('themeMsg').textContent='Saving…';
  const r=await fetch('/api/content',{method:'PUT',headers:headers(),body:JSON.stringify(payload)});
  document.getElementById('themeMsg').textContent = r.ok? 'Saved ✓' : 'Failed';
  setTimeout(()=>document.getElementById('themeMsg').textContent='',2000);
});
document.getElementById('changePw').addEventListener('click', async ()=>{
  const cur=document.getElementById('pwCur').value;
  const nw=document.getElementById('pwNew').value;
  if(!nw || nw.length<6){ alert('New password must be 6+ chars'); return; }
  const r=await fetch('/api/auth/change-password',{method:'POST',headers:headers(),body:JSON.stringify({currentPassword:cur,newPassword:nw})});
  const j=await r.json();
  alert(r.ok? 'Password changed' : (j.error||'Failed'));
  if(r.ok){ document.getElementById('pwCur').value=''; document.getElementById('pwNew').value=''; }
});

async function loadAll(){ await loadContent(); await loadMedia(); await loadLeads(); await loadAnalytics(); }

checkAuth();
