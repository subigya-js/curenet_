import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SYMPTOM_SEARCH_URL } from '../config/api';
import '../styles/symptom-search.css';

function formatRetrievalResponse(data) {
  const lines = [];
  if (data.emergency_message) {
    lines.push(`URGENT SAFETY NOTICE\n${data.emergency_message}\n`);
  }

  if (!data.results || data.results.length === 0) {
    lines.push('No related conditions were retrieved from the current corpus. Try describing the symptoms with more detail.');
  } else {
    lines.push('Related conditions in the symptom corpus:');
    data.results.forEach((result, index) => {
      const score = (result.similarity_score * 100).toFixed(1);
      const matched = result.matched_terms.length
        ? ` · matched terms: ${result.matched_terms.join(', ')}`
        : '';
      lines.push(`${index + 1}. ${result.condition} — ${score}% similarity${matched}`);
    });
  }

  lines.push(`\n${data.warning}`);
  return lines.join('\n');
}

function SymptomSearchPage() {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const query = prompt.trim();
    if (!query || loading) return;

    setMessages((current) => [...current, { sender: 'user', text: query }]);
    setPrompt('');
    setLoading(true);

    try {
      const response = await fetch(SYMPTOM_SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k: 5 }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'The retrieval service could not process this query.');
      }
      setMessages((current) => [
        ...current,
        { sender: 'bot', text: formatRetrievalResponse(data) },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          sender: 'bot',
          text: `${error.message}\n\nThe symptom retrieval service may be unavailable. No medical conclusion was produced.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <div className="container">
      <div className="chat-container">
        <div className="chat-header">
          <Link to="/" className="back-button">Research home</Link>
          <h1>Symptom Information Retrieval</h1>
          <Link to="/methodology" className="back-button">Methodology</Link>
        </div>

        <div className="chatbox" aria-live="polite">
          <div className="welcome-message">
            <h2>Search the symptom corpus</h2>
            <p>Describe multiple symptoms in plain language. CureNet ranks related condition descriptions using lexical information retrieval.</p>
            <p><strong>This is not a diagnosis, triage service, or substitute for a clinician.</strong></p>
          </div>

          {messages.map((message, index) => (
            <div key={`${message.sender}-${index}`} className={`message-container ${message.sender}-message`}>
              <div className="message-bubble">
                <div className="message-content">
                  {message.text.split('\n').map((line, lineIndex) => (
                    <React.Fragment key={`${index}-${lineIndex}`}>{line}<br /></React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-container bot-message">
              <div className="message-bubble"><div className="typing-indicator"><span /><span /><span /></div></div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="chat-input-form">
          <label htmlFor="symptom-query" className="visually-hidden">Describe symptoms</label>
          <textarea
            id="symptom-query"
            placeholder="Example: persistent cough, chest pain and difficulty breathing"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            className="chat-input"
            maxLength={2000}
          />
          <button type="submit" className="send-button" disabled={loading || !prompt.trim()}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SymptomSearchPage;
