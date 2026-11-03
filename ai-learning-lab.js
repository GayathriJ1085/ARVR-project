const $ = (id) => document.getElementById(id);
const language = $('language');
const question = $('question');
const askButton = $('ask-btn');
const answerBox = $('tutor-answer');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Turns the AI's text into clean HTML: no "##", no stray "*", proper bullets and steps.
function inline(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*/g, '');
}
function formatAnswer(text) {
  const out = [];
  let list = null; // 'ul' | 'ol'
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const open = (type) => { if (list !== type) { close(); out.push(`<${type}>`); list = type; } };

  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    let m;
    if ((m = line.match(/^#{1,6}\s*(.+)$/))) { close(); out.push(`<h4>${inline(m[1].replace(/\*\*/g, ''))}</h4>`); }
    else if ((m = line.match(/^[-*•]\s+(.+)$/))) { open('ul'); out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = line.match(/^\d+[.)]\s+(.+)$/))) { open('ol'); out.push(`<li>${inline(m[1])}</li>`); }
    else { close(); out.push(`<p>${inline(line)}</p>`); }
  }
  close();
  return out.join('');
}

async function health() {
  const status = $('status');
  try {
    const r = await fetch('/api/health');
    if (!r.ok) throw new Error();
    status.textContent = 'Tutor online'; status.className = 'status online';
  } catch {
    status.textContent = 'Tutor offline'; status.className = 'status offline';
  }
}
health();

question.addEventListener('input', () => { $('char-count').textContent = `${question.value.length} / 1000`; });
for (const chip of document.querySelectorAll('.chip')) {
  chip.addEventListener('click', () => {
    question.value = chip.textContent;
    question.dispatchEvent(new Event('input'));
    ask();
  });
}
askButton.addEventListener('click', ask);
question.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask(); });

async function ask() {
  const text = question.value.trim();
  if (!text) { question.focus(); return; }
  askButton.disabled = true; askButton.textContent = 'Thinking…';
  answerBox.innerHTML = '<div class="loading"><span class="dots"><i></i><i></i><i></i></span>Finding the steps…</div>';
  try {
    const response = await fetch('/api/tutor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: language.value, question: text }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    const offTopic = response.headers.get('X-Off-Topic') === '1';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      answerBox.innerHTML = `<div class="answer${offTopic ? ' notice' : ''}">${formatAnswer(full)}</div>`;
    }
    if (!full.trim()) answerBox.innerHTML = '<p class="error">No answer came back. Please try again.</p>';
  } catch (error) {
    answerBox.innerHTML = `<p class="error" role="alert">${escapeHtml(error.message)}</p><p class="fine-print">Make sure both terminals are running: <code>node server.js</code> and <code>npm run dev</code>.</p>`;
  } finally {
    askButton.disabled = false; askButton.textContent = 'Ask the tutor';
  }
}
