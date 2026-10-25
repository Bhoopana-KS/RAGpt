import React from 'react';
import { useEffect, useRef, useState } from "react";
import './App.css';
import {
  Plus, PanelLeftClose, PanelLeftOpen, FileText, File, FileUp, Send,
  Trash2, X, Sparkles, MessageSquare, CheckCircle2, LoaderCircle, Paperclip,
  ChevronDown, BookOpen, AlertCircle
} from "lucide-react";

const API = "http://127.0.0.1:8000";
const ACCEPT = ".pdf,.txt,.docx";

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function titleFrom(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 34 ? clean.slice(0, 34) + "…" : clean || "New chat";
}
function fileIcon(ext) {
  return ext === "pdf" ? "PDF" : ext === "docx" ? "DOCX" : "TXT";
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState("");
  const [apiOnline, setApiOnline] = useState(false);
  const [expandedSources, setExpandedSources] = useState({});
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  const activeChat = chats.find((chat) => chat.id === activeId) || null;
  const messages = activeChat?.messages || [];

  useEffect(() => {
    refreshFiles();
    fetch(`${API}/health`).then((r) => r.json()).then((d) => setApiOnline(d.status === "ok")).catch(() => setApiOnline(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }

  async function refreshFiles() {
    try {
      const response = await fetch(`${API}/files`);
      if (!response.ok) throw new Error("Could not load file list");
      const data = await response.json();
      setFiles(data.files || []);
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    }
  }

  function newChat() {
    const chat = { id: makeId(), title: "New chat", messages: [], updated: Date.now() };
    setChats((old) => [chat, ...old]);
    setActiveId(chat.id);
    setInput("");
    setPendingFiles([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function ensureChat(firstText) {
    if (activeChat) return activeChat;
    const chat = { id: makeId(), title: titleFrom(firstText), messages: [], updated: Date.now() };
    setChats((old) => [chat, ...old]);
    setActiveId(chat.id);
    return chat;
  }

  function updateChat(chatId, updater) {
    setChats((old) => old.map((chat) => chat.id === chatId ? updater(chat) : chat));
  }

  function selectFiles(fileList) {
    const picked = Array.from(fileList || []);
    const valid = picked.filter((f) => /\.(pdf|txt|docx)$/i.test(f.name));
    const invalidCount = picked.length - valid.length;
    if (invalidCount) notify("Only PDF, TXT, and DOCX files are supported.");
    setPendingFiles((old) => [...old, ...valid].filter((file, index, arr) =>
      arr.findIndex((x) => x.name === file.name && x.size === file.size) === index
    ));
  }

  async function uploadPending() {
    if (!pendingFiles.length) return [];
    setUploading(true);
    const form = new FormData();
    pendingFiles.forEach((file) => form.append("files", file));
    try {
      const response = await fetch(`${API}/upload`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Upload failed");
      const succeeded = (data.results || []).filter((r) => r.status === "success");
      const failed = (data.results || []).filter((r) => r.status !== "success");
      setFiles(data.files || []);
      if (succeeded.length) notify(`Processed ${succeeded.length} file${succeeded.length > 1 ? "s" : ""}.`);
      if (failed.length) notify(failed.map((r) => `${r.name}: ${r.message}`).join(" · "));
      setPendingFiles([]);
      return succeeded.map((r) => r.name);
    } catch (error) {
      notify(`Upload failed: ${error.message}. Is the FastAPI backend running?`);
      return [];
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(name) {
    try {
      const response = await fetch(`${API}/files/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove file");
      const data = await response.json();
      setFiles(data.files || []);
      notify(`Removed ${name}`);
    } catch (error) {
      notify(error.message);
    }
  }

  async function sendMessage(textOverride) {
    const question = (textOverride ?? input).trim();
    if ((!question && !pendingFiles.length) || sending || uploading) return;
    let chat = activeChat;
    if (!chat) {
      chat = { id: makeId(), title: titleFrom(question || pendingFiles[0]?.name), messages: [], updated: Date.now() };
      setChats((old) => [chat, ...old]);
      setActiveId(chat.id);
    }
    const chatId = chat.id;
    const uploadedNames = pendingFiles.map((f) => f.name);
    const userMessage = { id: makeId(), role: "user", content: question, files: uploadedNames };
    updateChat(chatId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? titleFrom(question || uploadedNames[0]) : c.title,
      updated: Date.now(),
      messages: [...c.messages, userMessage],
    }));
    setInput("");
    const added = await uploadPending();

    if (!question) {
      updateChat(chatId, (c) => ({
        ...c, updated: Date.now(),
        messages: [...c.messages, {
          id: makeId(), role: "assistant",
          content: added.length ? `I've processed **${added.join(", ")}**. What would you like to know?` : "I couldn't process the selected files. Please check the file type and try again.",
          sources: []
        }]
      }));
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "The request failed");
      updateChat(chatId, (c) => ({
        ...c, updated: Date.now(),
        messages: [...c.messages, {
          id: makeId(), role: "assistant", content: data.answer || "No answer was returned.",
          sources: data.sources || []
        }]
      }));
    } catch (error) {
      updateChat(chatId, (c) => ({
        ...c, updated: Date.now(),
        messages: [...c.messages, {
          id: makeId(), role: "assistant",
          content: `I couldn't answer that. ${error.message}`,
          sources: []
        }]
      }));
    } finally {
      setSending(false);
      refreshFiles();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function handleComposerKey(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function deleteChat(id, event) {
    event?.stopPropagation();
    const next = chats.filter((chat) => chat.id !== id);
    setChats(next);
    if (activeId === id) setActiveId(next[0]?.id || null);
  }

  const suggestions = [
    { icon: BookOpen, title: "Summarize a document", prompt: "Summarize the main points in my uploaded documents." },
    { icon: MessageSquare, title: "Find key information", prompt: "What are the most important points in my documents?" },
    { icon: Sparkles, title: "Explain a topic simply", prompt: "Explain the main topic in my documents in simple terms." },
  ];

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      {sidebarOpen && <aside className="sidebar">
        <div className="sidebar-top">
          <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
            <img src="/logo.png" alt="RAGpt — Retrieval-Augmented Generation Assistant" />
          </a>
          <button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar"><PanelLeftClose size={18}/></button>
        </div>
        <button className="new-chat" onClick={newChat}><Plus size={18}/> <span>New chat</span></button>
        <div className="sidebar-label">YOUR CHATS</div>
        <div className="chat-history">
          {chats.length === 0 ? <p className="empty-history">Your conversations will appear here.</p> :
            chats.slice().sort((a,b) => b.updated-a.updated).map((chat) => (
              <div key={chat.id} className={`history-row ${activeId === chat.id ? "active" : ""}`}>
                <button className="history-open" onClick={() => setActiveId(chat.id)} title={chat.title}>
                  <MessageSquare size={15}/><span>{chat.title}</span>
                </button>
                <button className="history-delete" onClick={(e) => deleteChat(chat.id, e)} title="Delete chat"><X size={14}/></button>
              </div>
            ))
          }
        </div>
        <div className="sidebar-docs">
          <div className="sidebar-label files-heading"><span>PROCESSED FILES</span><span className="count">{files.length}</span></div>
          <div className="file-list">
            {files.length === 0 ? <div className="no-files">Upload a document to get started.</div> :
              files.map((file) => (
                <div className="file-row" key={file.name}>
                  <div className="file-type">{fileIcon(file.extension)}</div>
                  <div className="file-meta"><span title={file.name}>{file.name}</span><small>{file.chunks} chunks · ready</small></div>
                  <button className="file-delete" title={`Remove ${file.name}`} onClick={() => removeFile(file.name)}><Trash2 size={14}/></button>
                </div>
              ))
            }
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className={`status-dot ${apiOnline ? "" : "offline"}`}/>
          <span>{apiOnline ? "Workspace ready" : "Backend not connected"}</span>
          <button className="icon-button" onClick={refreshFiles} title="Refresh status"><LoaderCircle size={15}/></button>
        </div>
      </aside>}

      <main className="main-area">
        <header className="topbar">
          {!sidebarOpen && <button className="icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><PanelLeftOpen size={19}/></button>}
          <div className="topbar-title">RAGpt <span>AI ASSISTANT</span></div>
          <div className="topbar-right"><span className={`status-pill ${apiOnline ? "online" : "offline"}`}><i/>{apiOnline ? "Ready" : "Offline"}</span><button className="new-chat compact" onClick={newChat}><Plus size={16}/> New chat</button></div>
        </header>

        <section className={`conversation ${messages.length === 0 ? "welcome-conversation" : ""}`}>
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-mark"><Sparkles size={22}/></div>
              <p className="eyebrow">YOUR DOCUMENTS, UNDERSTOOD</p>
              <h1>What can I help you<br className="desktop-break"/> discover today?</h1>
              <p className="welcome-subtitle">Ask questions, explore ideas, and find answers in your documents.</p>
              <div className="suggestions">
                {suggestions.map(({icon: Icon, title, prompt}) => (
                  <button className="suggestion" key={title} onClick={() => { setInput(prompt); inputRef.current?.focus(); }}>
                    <Icon size={19}/><span>{title}</span><span className="suggestion-arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  {message.role === "assistant" && <div className="assistant-avatar"><Sparkles size={17}/></div>}
                  <div className="message-body">
                    {message.files?.length > 0 && <div className="message-attachments">{message.files.map((name) => <span key={name}><FileText size={13}/>{name}</span>)}</div>}
                    {message.content && <div className="message-content">{message.content.split(/(\*\*.*?\*\*)/g).map((part, i) =>
                      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2,-2)}</strong> : part.split("\n").map((line,j) => <span key={`${i}-${j}`}>{line}{j < part.split("\n").length-1 && <br/>}</span>)
                    )}</div>}
                    {message.sources?.length > 0 && <div className="source-area">
                      <button className="source-toggle" onClick={() => setExpandedSources((old) => ({...old, [message.id]: !old[message.id]}))}>
                        <FileText size={14}/> {message.sources.length} source{message.sources.length > 1 ? "s" : ""} <ChevronDown size={14} className={expandedSources[message.id] ? "rotated" : ""}/>
                      </button>
                      {expandedSources[message.id] && <div className="source-list">{message.sources.map((source, i) => (
                        <div className="source-card" key={`${source.source}-${source.chunk}-${i}`}>
                          <div><strong>{source.source}</strong><span>Part {source.chunk} · {source.match}% match</span></div>
                          <p>{source.snippet}</p>
                        </div>
                      ))}</div>}
                    </div>}
                  </div>
                </article>
              ))}
              {sending && <article className="message assistant"><div className="assistant-avatar"><Sparkles size={17}/></div><div className="typing"><i/><i/><i/></div></article>}
              <div ref={bottomRef}/>
            </div>
          )}
        </section>

        <div className="composer-wrap">
          {pendingFiles.length > 0 && <div className="pending-files">{pendingFiles.map((file, i) => <div className="pending-file" key={`${file.name}-${i}`}><FileText size={15}/><span>{file.name}</span><button onClick={() => setPendingFiles((old) => old.filter((_, idx) => idx !== i))} aria-label="Remove attachment"><X size={14}/></button></div>)}</div>}
          <form className="composer" onSubmit={handleSubmit}>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { selectFiles(e.target.files); e.target.value = ""; }}/>
            <button type="button" className="composer-attach" title="Attach documents" onClick={() => fileRef.current?.click()}><Plus size={21}/></button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleComposerKey}
              placeholder="Message RAGpt or attach a document…"
              rows={1}
              aria-label="Message"
            />
            <button type="submit" className="send-button" disabled={(!input.trim() && pendingFiles.length === 0) || sending || uploading} title="Send message">
              {uploading ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>}
            </button>
          </form>
          <p className="composer-note">RAGpt can make mistakes. Verify important information from your documents.</p>
        </div>
      </main>
      {toast && <div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
    </div>
  );
}
