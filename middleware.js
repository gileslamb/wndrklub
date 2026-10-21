// The lemon gate. The page is served only to visitors with the session cookie;
// everyone else gets the gate: the lemon on a cream page with a password field.
// The password lives in the SITE_PASSWORD environment variable on Vercel, never
// in this repo or the page. A correct password sets a session cookie holding a
// hash of it, so returning visitors in the same browser session skip the field
// (the page itself still shows the lemon, to choose sound on or off).
// Ported from the old site (gileslamb/wndrklub, tag legacy-site-2026-09).

// Everything is behind the gate except the one image the gate page itself shows.
export const config = {
  matcher: ['/', '/((?!img/faces/lemon@2x\\.webp$).*)'],
};

const COOKIE = 'wk_pass';

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
        // no Max-Age: a session cookie, gone when the browser closes
        'Set-Cookie': `${COOKIE}=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (cookieValue(request, COOKIE) === expected) return;   // let the page through
  return page(url, '', 401);
}

// Same cream page, same lemon in the same place as the page's own gate, so
// getting the password right reads as the field going away.
function page(url, message, status) {
  const next = (url.pathname === '/__auth' ? '/' : url.pathname) + url.search;
  const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>WndrKlub</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='6' fill='%23c8292e'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 24px;
    background: #f5f1e8;
    color: #1a1814;
    font-family: 'Inter', sans-serif;
  }
  .lemon {
    width: min(46vw, 240px);
    aspect-ratio: 536 / 533;
    background: url('/img/faces/lemon@2x.webp') center / contain no-repeat;
    animation: bob 3.2s ease-in-out infinite;
  }
  @keyframes bob { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg) translateY(-4px); } }
  @media (prefers-reduced-motion: reduce) { .lemon { animation: none; } }
  form { height: 112px; padding-top: 26px; width: 100%; max-width: 300px; }
  .row { display: flex; gap: 8px; }
  input {
    flex: 1; min-width: 0;
    font: inherit; font-size: 16px;
    padding: 11px 16px;
    border: 1.5px solid #1a1814; border-radius: 99px;
    background: #fbf9f3; color: #1a1814;
  }
  input:focus { outline: 2px solid #c8292e; outline-offset: 2px; }
  button {
    font: inherit; font-weight: 500; font-size: 15px;
    padding: 11px 18px;
    border: 0; border-radius: 99px;
    background: #1a1814; color: #f5f1e8;
    cursor: pointer;
  }
  button:hover { background: #c8292e; }
  .msg { font-family: 'Caveat', cursive; font-size: 20px; color: #c8292e; margin-top: 10px; text-align: center; min-height: 1em; }
</style>
</head>
<body>
<div class="lemon" role="img" aria-label="A lemon"></div>
<form method="post" action="/__auth">
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
