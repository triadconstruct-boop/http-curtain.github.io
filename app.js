const form = document.getElementById('claimForm');
const input = document.getElementById('claimInput');
const count = document.getElementById('count');
const workspace = document.getElementById('workspace');
const activeClaim = document.getElementById('activeClaim');

input.addEventListener('input', () => {
  count.textContent = `${input.value.length} / 1200`;
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const claim = input.value.trim();
  if (!claim) return;

  activeClaim.textContent = claim;
  workspace.classList.remove('hidden');

  // Placeholder metrics until a real evidence pipeline is connected.
  document.getElementById('evidenceScore').textContent = 'OPEN';
  document.getElementById('confidenceScore').textContent = 'UNRATED';
  document.getElementById('independenceScore').textContent = '—';
  document.getElementById('contradictionScore').textContent = '—';

  workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('resetBtn').addEventListener('click', () => {
  workspace.classList.add('hidden');
  input.value = '';
  count.textContent = '0 / 1200';
  input.focus();
});

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});
