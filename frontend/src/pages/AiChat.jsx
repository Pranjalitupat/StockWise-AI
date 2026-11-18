import { useEffect, useRef, useState } from 'react';
import { Bot, Send } from 'lucide-react';
import api, { getErrorMessage } from '../api/axios.js';
import { PageHeader, RichText } from '../components/ui.jsx';

const SUGGESTIONS = [
  'Which products are running low?',
  'Which products are out of stock?',
  'What is my total inventory value?',
  'Which products should I restock?',
  'Summarize my inventory',
  'Which products are overstocked?',
];

export default function AiChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    const el = logRef.current;
    if (el && (messages.length > 0 || busy)) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const send = async (text) => {
    const message = text.trim();
    if (!message || busy) return;
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setInput('');
    setBusy(true);
    try {
      const res = await api.post('/ai/chat', { message });
      const reply = typeof res.data?.reply === 'string' ? res.data.reply : '';
      if (!reply) throw new Error('The server returned an unexpected response. Make sure the backend is updated and restarted.');
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: getErrorMessage(err), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Ask questions about your own inventory. Answers come from your live data." />
      <div className="card chat">
        <div className="chat-log" ref={logRef}>
          {messages.length === 0 && (
            <div className="center">
              <Bot size={36} color="#7c3aed" />
              <strong>Ask about your stock</strong>
              <span>Pick a question below or type your own.</span>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role} ${m.error ? 'err' : ''}`}>
              {m.role === 'assistant' && !m.error ? <RichText text={m.content} /> : m.content}
            </div>
          ))}
          {busy && <div className="bubble assistant muted">Thinking...</div>}
        </div>
        <div className="chat-foot">
          <div className="chips">
            {SUGGESTIONS.map((s) => <button key={s} className="chip" disabled={busy} onClick={() => send(s)}>{s}</button>)}
          </div>
          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input className="input" placeholder="Ask about your inventory" maxLength={1000} value={input} onChange={(e) => setInput(e.target.value)} aria-label="Message" />
            <button className="btn" disabled={busy || !input.trim()}><Send size={16} /> Send</button>
          </form>
        </div>
      </div>
    </>
  );
}
