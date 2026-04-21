const http = require('http');
const fs = require('fs');
const https = require('https');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const ADMIN_USER = 'admin';
const ADMIN_PASS = '123456';
const MAX_RECORDS = 200;

const records = [];
const adminSessions = new Set();

function send(res, status, contentType, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return acc;
      acc[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
      return acc;
    }, {});
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function isAdminAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return Boolean(cookies.customer_admin_session && adminSessions.has(cookies.customer_admin_session));
}

function normalize(value, fallback = '未填寫') {
  const text = String(value || '').trim();
  return text || fallback;
}

function notifyTelegram(message) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  if (!token || !chatId) {
    return Promise.resolve(false);
  }

  const payload = JSON.stringify({
    chat_id: chatId,
    text: message
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      response => {
        let body = '';
        response.on('data', chunk => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(true);
            return;
          }
          reject(new Error(`Telegram API responded ${response.statusCode}: ${body}`));
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function renderAdminLogin(errorMessage = '') {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>管理員登入</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <style>
    :root{color-scheme:light;--bg:#eef2ff;--card:#ffffff;--line:#dbe4f0;--text:#0f172a;--muted:#64748b;--accent:#2563eb;--accent2:#0ea5e9}
    *{box-sizing:border-box}
    body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(180deg,#eaf1ff,#f8fafc);color:var(--text)}
    .wrap{min-height:100svh;display:grid;place-items:center;padding:24px 16px}
    .card{width:100%;max-width:420px;background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:24px;box-shadow:0 24px 60px rgba(15,23,42,.08);padding:26px}
    h1{margin:0;font-size:28px;letter-spacing:-.04em}
    .sub{margin:10px 0 18px;color:var(--muted);line-height:1.6}
    label{display:block;font-size:13px;font-weight:700;margin:14px 0 8px}
    input{width:100%;height:48px;border:1px solid var(--line);border-radius:14px;padding:0 14px;font-size:15px;background:#fbfdff}
    button{width:100%;height:48px;border:0;border-radius:14px;margin-top:18px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:16px;font-weight:800;cursor:pointer}
    .error{margin:0 0 12px;color:#b91c1c;font-weight:700}
    .hint{margin-top:12px;color:var(--muted);font-size:13px;line-height:1.5}
    code{background:#eff6ff;padding:2px 6px;border-radius:6px}
  </style>
</head>
<body>
  <div class="wrap">
    <form class="card" method="post" action="/admin-login">
      <h1>管理員登入</h1>
      <p class="sub">登入後可查看客戶資料名單。此版本只保存客戶聯絡資料，不保存任何登入憑證。</p>
      ${errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : ''}
      <label for="username">管理員帳號</label>
      <input id="username" name="username" autocomplete="username" required />
      <label for="password">管理員密碼</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button type="submit">登入後台</button>
      <div class="hint">初始帳號：<code>admin</code>，初始密碼：<code>123456</code></div>
    </form>
  </div>
</body>
</html>`;
}

function renderAdminDashboard() {
  const rows = records
    .slice()
    .reverse()
    .map(record => `
      <tr>
        <td>${escapeHtml(record.time)}</td>
        <td>${escapeHtml(record.account)}</td>
        <td>${escapeHtml(record.note)}</td>
        <td>${escapeHtml(record.source)}</td>
        <td>${escapeHtml(record.ip)}</td>
      </tr>
    `)
    .join('');

  const latest = records[0];

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>客戶資料後台</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <style>
    :root{color-scheme:light;--bg:#f6f8fb;--card:#fff;--line:#e5e7eb;--text:#0f172a;--muted:#64748b;--accent:#2563eb;--accent2:#0ea5e9}
    *{box-sizing:border-box}
    body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(180deg,#eef4ff,#f8fafc);color:var(--text)}
    .wrap{max-width:1200px;margin:0 auto;padding:28px 16px 40px}
    .header{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:18px}
    h1{margin:0;font-size:30px;letter-spacing:-.04em}
    .sub{margin:6px 0 0;color:var(--muted);line-height:1.6}
    .pill{padding:8px 12px;border-radius:999px;background:#e8eefc;color:var(--accent);font-weight:700;font-size:13px;text-decoration:none}
    .card{background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:22px;overflow:hidden;box-shadow:0 20px 50px rgba(15,23,42,.06)}
    .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid var(--line)}
    .stat{padding:18px 20px}
    .stat span{display:block;color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .stat b{display:block;font-size:20px;margin-top:6px;line-height:1.2;word-break:break-word}
    table{width:100%;border-collapse:collapse}
    th,td{padding:14px 18px;text-align:left;border-top:1px solid var(--line);vertical-align:top}
    th{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:#fafbfc}
    td{font-size:14px;word-break:break-word}
    .empty{padding:28px 20px;color:var(--muted)}
    .note{margin-top:14px;color:var(--muted);font-size:13px}
    @media (max-width: 900px){
      .stats{grid-template-columns:1fr 1fr}
      .header{flex-direction:column;align-items:flex-start}
    }
    @media (max-width: 720px){
      .stats{grid-template-columns:1fr}
      table,thead,tbody,th,td,tr{display:block}
      thead{display:none}
      tr{border-top:1px solid var(--line)}
      td{border-top:0;padding-top:10px;padding-bottom:4px}
    }
  </style>
  <script>
    async function refresh() {
      const res = await fetch('/records');
      if (!res.ok) return;
      const data = await res.json();
      document.getElementById('count').textContent = data.length;
      document.getElementById('latest').textContent = data[0]?.account || '尚無資料';
    }
    setInterval(refresh, 2500);
    window.addEventListener('DOMContentLoaded', refresh);
  </script>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div>
        <h1>客戶資料後台</h1>
        <p class="sub">僅記錄客戶帳號、備註與來源資訊。</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="pill">紀錄筆數：<span id="count">${records.length}</span></div>
        <a class="pill" href="/logout">登出</a>
      </div>
    </div>

    <div class="card">
      <div class="stats">
        <div class="stat"><span>最新帳號</span><b id="latest">${escapeHtml(latest?.account || '尚無資料')}</b></div>
        <div class="stat"><span>最新備註</span><b>${escapeHtml(latest?.note || '尚無資料')}</b></div>
        <div class="stat"><span>最新來源</span><b>${escapeHtml(latest?.source || '尚無資料')}</b></div>
        <div class="stat"><span>總筆數</span><b>${records.length}</b></div>
      </div>

      ${rows ? `<table><thead><tr><th>時間</th><th>帳號</th><th>備註</th><th>來源</th><th>IP</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">目前還沒有任何客戶資料。</div>'}
    </div>

    <div class="note">畫面會每 2.5 秒自動更新。</div>
  </div>
</body>
</html>`;
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'text/plain; charset=utf-8', 'Not found');
      return;
    }
    send(res, 200, contentType, data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';

  if (req.method === 'OPTIONS') {
    send(res, 204, 'text/plain; charset=utf-8', '');
    return;
  }

  if (req.method === 'POST' && pathname === '/submit') {
    const raw = await readBody(req);
    let payload = {};
    try {
      payload = raw.trim().startsWith('{') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
    } catch {
      payload = {};
    }

    const record = {
      time: new Date().toLocaleString('zh-TW'),
      account: normalize(payload.account),
      note: normalize(payload.note),
      source: normalize(payload.source, '網站表單'),
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    records.unshift(record);
    while (records.length > MAX_RECORDS) records.pop();

    send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'POST' && pathname === '/admin-login') {
    const raw = await readBody(req);
    const payload = Object.fromEntries(new URLSearchParams(raw));
    const username = String(payload.username || '');
    const password = String(payload.password || '');

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      adminSessions.add(token);
      send(res, 302, 'text/plain; charset=utf-8', 'Redirecting', {
        Location: '/admin',
        'Set-Cookie': `customer_admin_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`
      });
      return;
    }

    send(res, 401, 'text/html; charset=utf-8', renderAdminLogin('帳號或密碼錯誤'));
    return;
  }

  if (req.method === 'GET' && pathname === '/records') {
    if (!isAdminAuthenticated(req)) {
      send(res, 401, 'application/json; charset=utf-8', JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify(records));
    return;
  }

  if (req.method === 'GET' && pathname === '/admin') {
    if (!isAdminAuthenticated(req)) {
      send(res, 200, 'text/html; charset=utf-8', renderAdminLogin());
      return;
    }
    send(res, 200, 'text/html; charset=utf-8', renderAdminDashboard());
    return;
  }

  if (req.method === 'GET' && pathname === '/logout') {
    const cookies = parseCookies(req.headers.cookie || '');
    if (cookies.customer_admin_session) {
      adminSessions.delete(cookies.customer_admin_session);
    }
    send(res, 302, 'text/plain; charset=utf-8', 'Redirecting', {
      Location: '/admin',
      'Set-Cookie': 'customer_admin_session=; Max-Age=0; Path=/; SameSite=Lax'
    });
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    serveFile(res, path.join(ROOT, 'index.html'), 'text/html; charset=utf-8');
    return;
  }

  if (pathname === '/style.css') {
    serveFile(res, path.join(ROOT, 'style.css'), 'text/css; charset=utf-8');
    return;
  }

  if (pathname === '/favicon.ico') {
    send(res, 204, 'text/plain; charset=utf-8', '');
    return;
  }

  const assetPath = path.join(ROOT, pathname.replace(/^\/+/, ''));
  if (assetPath.startsWith(ROOT) && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
    const ext = path.extname(assetPath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    serveFile(res, assetPath, types[ext] || 'application/octet-stream');
    return;
  }

  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Customer records backend running at http://localhost:${PORT}`);
  notifyTelegram(`伺服器已啟動\n時間：${new Date().toLocaleString('zh-TW')}\n網址：http://localhost:${PORT}`)
    .catch(err => {
      console.warn(`Telegram start notification failed: ${err.message}`);
    });
});
