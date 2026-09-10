import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './chat.css';

function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (event) => {
    setPrompt(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!prompt.trim()) {
      return;
    }

    const userMessage = { sender: 'user', text: prompt };
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    setLoading(true);

    try {
      const res = await fetch("http://localhost:8801/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: prompt }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch response");
      }

      const responseData = await res.json();
      const botMessage = { 
        sender: 'bot', 
        text: responseData.response || "Sorry, I couldn't understand that." 
      };

      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } catch (error) {
      console.error("Error:", error);
      const botMessage = { 
        sender: 'bot', 
        text: "An error occurred while fetching response." 
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } finally {
      setLoading(false);
      setPrompt("");
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const formatMessage = (text) => {
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  return (
    <div className="container">
      <div className="chat-container">
        <div className="chat-header">
          <button 
            onClick={() => navigate(-1)} 
            className="back-button"
          >
            Back
          </button>
          <h1>CureNet's Health Assistant</h1>
        </div>

        <div className="chatbox">
          <div className="welcome-message">
            <h2>Welcome to CureNet's Health Assistant</h2>
            <p>Ask me about your symptoms and I'll try to help!</p>
            <p>For better understanding! Provide More Symptoms</p>
          </div>
          
          {messages.map((msg, index) => (
            <div key={index} className={`message-container ${msg.sender}-message`}>
              <div className="message-bubble">
                <div className="message-content">
                  {formatMessage(msg.text)}
                </div>
                <div className="message-time">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="message-container bot-message">
              <div className="message-bubble">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="chat-input-form">
          <textarea
            placeholder="Describe your symptoms..."
            value={prompt}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="chat-input"
          />
          <button 
            type="submit" 
            className="send-button" 
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chatbot;