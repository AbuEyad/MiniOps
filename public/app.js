const $ = id => document.getElementById(id);

async function api(method, path, body){
  const r = await fetch(path, {
    method, credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if(!r.ok){ const e = new Error(data.error || 'Request failed'); e.status = r.status; throw e; }
  return data;
}

let DB = { sales: [], daily: [] };      // the browser's copy of what the server last sent

function show(signedIn){ $('login').hidden = signedIn; $('app').hidden = !signedIn; }

function addRow(tbody, values){
  const tr = document.createElement('tr');
  values.forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
  tbody.appendChild(tr);
  return tr;
}

function render(){
  const daily = $('dailyBody'); daily.replaceChildren();
  DB.daily.forEach(d => addRow(daily, [d.date, d.qty, d.total.toFixed(2)]));
  const body = $('salesBody'); body.replaceChildren();
  DB.sales.forEach(s => {
    const tr = addRow(body, [s.date, s.product, s.qty, s.rate.toFixed(2), s.total.toFixed(2)]);
    const td = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Delete';
    btn.onclick = () => { if(confirm('Delete this sale?')) run(() => api('DELETE', '/api/sales/' + s.id)); };
    td.appendChild(btn); tr.appendChild(td);
  });
}

// One place that runs an action, stores the answer, redraws, and shows errors.
async function run(action){
  $('error').textContent = '';
  try{ DB = await action(); render(); }
  catch(err){ if(err.status === 401) show(false); else $('error').textContent = err.message; }
}

async function openApp(){ show(true); await run(() => api('GET', '/api/sales')); }

$('loginForm').onsubmit = async e => {
  e.preventDefault();
  try{ await api('POST', '/api/auth/login', { password: $('password').value }); $('password').value = ''; $('loginError').textContent = ''; await openApp(); }
  catch(err){ $('loginError').textContent = err.message; }
};
$('logout').onclick = async () => { await api('POST', '/api/auth/logout', {}); show(false); };
$('saleForm').onsubmit = e => {
  e.preventDefault();
  run(() => api('POST', '/api/sales', { date: $('date').value, product: $('product').value, qty: $('qty').value, rate: $('rate').value }));
  $('product').value = ''; $('qty').value = '';
};

(async function init(){
  $('date').value = new Date().toISOString().slice(0, 10);
  const s = await api('GET', '/api/auth/status');
  if(s.signedIn) await openApp(); else show(false);
})();