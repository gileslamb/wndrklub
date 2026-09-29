// Password gate for the main page. The password lives in the SITE_PASSWORD
// environment variable on Vercel (never in this public repo). A correct
// password sets a cookie holding a hash of it, valid for 30 days.
// music.html and /api/track stay open so existing animator links keep working.

export const config = {
  matcher: ['/', '/index', '/index.html', '/__auth'],
};

const COOKIE = 'wk_pass';
const MAX_AGE = 60 * 60 * 24 * 30;

async function token(password) {
  const data = new TextEncoder().encode(`wndrklub:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function cookieValue(request, name) {
  const match = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

export default async function middleware(request) {
  const password = process.env.SITE_PASSWORD;
  const url = new URL(request.url);
  if (!password) return page(url, 'The site is closed for now.', 503);   // fail closed
  const expected = await token(password);

  if (url.pathname === '/__auth') {
    if (request.method !== 'POST') return Response.redirect(new URL('/', url), 303);
    const form = await request.formData();
    const back = String(form.get('next') || '/');
    const dest = new URL(back.startsWith('/') && !back.startsWith('//') ? back : '/', url);
    if (String(form.get('password') || '').trim().toLowerCase() !== password.toLowerCase()) {
      return page(dest, 'Not quite. Try again?', 401);
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: dest.pathname + dest.search,
        'Set-Cookie': `${COOKIE}=${expected}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (cookieValue(request, COOKIE) === expected) return;   // let the page through
  return page(url, '', 401);
}

function page(url, message, status) {
  const next = (url.pathname === '/__auth' ? '/' : url.pathname) + url.search;
  const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>WndrKlub.</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500&family=Fraunces:opsz,wght@9..144,900&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    background: #f5f1e8;
    color: #1a1814;
    font-family: 'Inter', sans-serif;
  }
  form { width: 100%; max-width: 340px; text-align: center; }
  h1 { font-family: 'Fraunces', serif; font-weight: 900; font-size: 56px; letter-spacing: -0.04em; line-height: 1; }
  h1 span { color: #c8292e; }
  p { font-family: 'Caveat', cursive; font-size: 22px; color: #3a3530; margin: 10px 0 28px; }
  .row { display: flex; gap: 8px; }
  input {
    flex: 1; min-width: 0;
    font: inherit; font-size: 16px;
    padding: 12px 16px;
    border: 1.5px solid #1a1814; border-radius: 99px;
    background: #fbf9f3; color: #1a1814;
  }
  input:focus { outline: 2px solid #c8292e; outline-offset: 2px; }
  button {
    font: inherit; font-weight: 500; font-size: 15px;
    padding: 12px 20px;
    border: 0; border-radius: 99px;
    background: #1a1814; color: #f5f1e8;
    cursor: pointer;
  }
  button:hover { background: #c8292e; }
  .msg { font-size: 13px; color: #c8292e; margin-top: 14px; min-height: 1em; }
</style>
</head>
<body>
<form method="post" action="/__auth">
  <h1>WndrKlub<span>.</span></h1>
  <p>A peek behind the curtain.</p>
  <input type="hidden" name="next" value="${esc(next)}">
  <div class="row">
    <input type="password" name="password" placeholder="Password" aria-label="Password" autocomplete="current-password" autofocus required>
    <button type="submit">Enter</button>
  </div>
  <div class="msg" role="alert">${esc(message)}</div>
</form>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
