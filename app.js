const form = document.getElementById('claimForm');
const input = document.getElementById('claimInput');
const count = document.getElementById('count');
const workspace = document.getElementById('workspace');
const activeClaim = document.getElementById('activeClaim');
const button = form.querySelector('button[type="submit"]');
let pending = false;
const status = document.createElement('p');
status.setAttribute('role', 'status');
status.style.whiteSpace = 'pre-wrap';
form.append(status);
const result = document.createElement('article');
result.className = 'wide';
result.style.whiteSpace = 'pre-wrap';
result.style.overflowWrap = 'anywhere';
workspace.querySelector('.workspace-head').after(result);
input.addEventListener('input', () => { count.textContent = input.value.length + ' / 1200'; });
form.addEventListener('submit', async e => {
  e.preventDefault();
  const claim = input.value.trim();
  if (!claim || pending) return;
  result.replaceChildren();
  workspace.classList.add('hidden');
  pending = true;
  button.disabled = true;
  status.textContent = 'Connecting to CURTAIN analysis…';
  try {
    const configResponse = await fetch('analysis-config.json', {cache: 'no-store'});
    if (!configResponse.ok) throw new Error('Astra is not connected yet. CURTAIN needs its analysis server and OpenAI API credential configured.');
    const config = await configResponse.json();
    if (!config.endpoint) throw new Error('Astra is not connected yet. The analysis server has not been configured.');
    const endpoint = new URL(config.endpoint, location.href);
    if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(endpoint.hostname)) throw new Error('The analysis endpoint must use HTTPS.');
    const token = window.prompt('Enter your CURTAIN access token (not your OpenAI API key):');
    if (!token) { status.textContent = 'Analysis cancelled. No claim was sent.'; return; }
    status.textContent = 'Astra is analyzing your claim. This may take several minutes…';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
      body: JSON.stringify({claim}),
      signal: AbortSignal.timeout(300000)
    });
    const data = await response.json().catch(() => { throw new Error('The analysis server returned an unreadable response.'); });
    if (!response.ok) throw new Error(data.error || 'Analysis failed (' + response.status + ').');
    if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('Astra returned no answer. Submit again to retry.');
    activeClaim.textContent = claim;
    result.textContent = data.answer;
    const sources = document.createElement('div');
    for (const source of data.sources || []) {
      try {
        const url = new URL(source.url);
        if (!['http:', 'https:'].includes(url.protocol)) continue;
        const link = document.createElement('a');
        link.href = url.href; link.textContent = source.title || url.href;
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        sources.append(link, document.createElement('br'));
      } catch {}
    }
    result.append(sources);
    // Hide starter demonstrations rather than presenting them as analyzed evidence.
    for (const selector of ['.scoregrid', '.tabs', '.panels']) workspace.querySelector(selector).hidden = true;
    workspace.classList.remove('hidden');
    status.textContent = 'Analysis complete · GPT-6 Astra · high reasoning';
    workspace.scrollIntoView({behavior: 'smooth', block: 'start'});
  } catch (error) {
    status.textContent = error.name === 'TimeoutError'
      ? 'The request timed out. The server may still be finishing; no automatic retry was sent.'
      : (error.message === 'Failed to fetch' ? 'Cannot reach the analysis server. Check its availability and connection settings.' : error.message);
  } finally { pending = false; button.disabled = false; }
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (pending) return;
  workspace.classList.add('hidden'); result.replaceChildren(); status.textContent = '';
  input.value = ''; count.textContent = '0 / 1200'; input.focus();
});
