import { useState, useEffect, useRef } from 'react';
import { queryRAGStream } from './services/ragService'; 
import { Send, BookHeart, Sparkles, Menu, Plus, Search, X, User, Lock, AtSign } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  id: string;
  role: 'user' | 'bot';
  content: string;
};

type Chat = {
  id: string;
  title: string;
  preview: string;
};

const API_URL = import.meta.env.VITE_API_URL

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authError, setAuthError] = useState("");
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [referenceSources, setReferenceSources] = useState<any[]>([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bot',
      content: "As-salamu alaykum. I am Mishkat. How may I assist you with Islamic knowledge today? You can type `@` at the beginning to mention specific Hadith books."
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState<number>(0);

  const getAuthHeaders = () => {
    const token = currentUser?._id
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    console.log(API_URL)
    fetch(`${API_URL}/api/v1/ref/`)
      .then(res => res.json())
      .then(data => data.map((ref: any) => JSON.parse(ref)))
      .then(data => {
        const formatted = data.map((ref: any) => ({ 
          id: ref.reference_id, 
          name: ref.reference_name, 
          arabicTitle: ref.reference_arabic_name 
        }));
        setReferenceSources(formatted);
      })
      .catch(err => console.error(err));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    try {
      const endpoint = authMode === 'login' ? '/api/v1/users/login' : '/api/v1/users/register';
      const payload = authMode === 'login' 
        ? { username, password } 
        : { username, password, full_name: fullName || undefined };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Authentication failed");
      }

      const userData = await response.json();
      setCurrentUser(userData);
      localStorage.setItem('currentUser', JSON.stringify(userData));
      setIsLoggedIn(true);
      
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  useEffect(() => {
    console.log(currentUser)
    if(!currentUser){
      setCurrentUser(JSON.parse(localStorage.getItem('currentUser')!));
    }
    if (currentUser) {
      setIsLoggedIn(true);
    }
    if (currentUser) {
      fetchUserChats();
    }
  }, [isLoggedIn, currentUser]);

  const fetchUserChats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/chats/?page=1&size=50`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const formattedChats = data.chats.map((chat: any) => ({
          id: chat._id || chat.id,
          title: chat.name || "New Conversation",
          preview: ""
        }));
        setChats(formattedChats);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setIsSidebarOpen(false); 
    
    try {
      const response = await fetch(`${API_URL}/api/v1/messages/?chat_id=${chatId}&page=1&size=100`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const loadedMessages = data.messages?.map((msg: any) => ({
          id:msg.id,
          role: msg.role === 'user' ? 'user' : 'bot',
          content: msg.content
        })) || [];

        if (loadedMessages.length > 0) {
          setMessages(loadedMessages);
        } else {
          setMessages([{ id: generateId(), role: 'bot', content: "Chat loaded but no messages found." }]);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([
      {
        id: generateId(),
        role: 'bot',
        content: "As-salamu alaykum. I am Mishkat. How may I assist you with Islamic knowledge today? You can type `@` at the beginning to mention specific Hadith books."
      }
    ]);
    setIsSidebarOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z\s\u0600-\u06FF]*)$/);

    if (match) {
      let textBeforeMention = textBeforeCursor.slice(0, match.index!).trimStart();
      let isValidStart = true;

      while (textBeforeMention.length > 0) {
        let matchedRef = false;
        for (const ref of referenceSources) {
          const mentionStr = `@${ref.name}`;
          if (textBeforeMention.startsWith(mentionStr)) {
            textBeforeMention = textBeforeMention.slice(mentionStr.length).trimStart();
            matchedRef = true;
            break;
          }
        }
        if (!matchedRef) {
          isValidStart = false;
          break;
        }
      }

      if (isValidStart) {
        setMentionQuery(match[1]);
        setMentionStartIndex(match.index!);
        setMentionSelectedIndex(0);
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }
  };

  const handleSelectMention = (ref: any) => {
    if (!inputRef.current) return;
    const before = inputValue.slice(0, mentionStartIndex);
    const after = inputValue.slice(inputRef.current.selectionStart);
    setInputValue(before + `@${ref.name} ` + after);
    setMentionQuery(null);
    inputRef.current.focus();
  };

  const filteredRefs = mentionQuery !== null
    ? referenceSources.filter(r => 
        r.name.toLowerCase().includes(mentionQuery.toLowerCase()) || 
        r.arabicTitle.includes(mentionQuery)
      )
    : [];

  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(chatSearchQuery.toLowerCase()) || 
    chat.preview.toLowerCase().includes(chatSearchQuery.toLowerCase())
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawUserMessage = inputValue.trim();
    if (!rawUserMessage || isProcessing) return;

    let cleanedMessage = rawUserMessage;
    const mentionedIdsSet = new Set<string>();

    let extracting = true;
    while (extracting) {
      let matched = false;
      for (const ref of referenceSources) {
        const mentionStr = `@${ref.name}`;
        if (cleanedMessage.startsWith(mentionStr)) {
          mentionedIdsSet.add(ref.id);
          cleanedMessage = cleanedMessage.slice(mentionStr.length).trimStart();
          matched = true;
          break;
        }
      }
      if (!matched) extracting = false;
    }

    if (!cleanedMessage) return;

    const mentionedIds = Array.from(mentionedIdsSet);
    setInputValue("");
    setMentionQuery(null);
    if (inputRef.current) inputRef.current.style.height = 'auto';

    setMessages(prev => [...prev, { id: generateId(), role: 'user', content: cleanedMessage }]);
    setIsProcessing(true);

    try {
      let activeChatId = currentChatId;

      if (!activeChatId) {
        const chatRes = await fetch(`${API_URL}/api/v1/chats/`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ first_message_content: cleanedMessage })
        });
        
        if (chatRes.ok) {
          const newChat = await chatRes.json();
          activeChatId = newChat._id || newChat.id;
          setCurrentChatId(activeChatId);
          fetchUserChats();
        }
      }

      const botMsgId = generateId();
      setMessages(prev => [...prev, { id: botMsgId, role: 'bot', content: "" }]);

      let fullContent = "";
      const userIdOrToken = currentUser?._id
      
      await queryRAGStream(cleanedMessage, mentionedIds, userIdOrToken, activeChatId, (chunk) => {
        fullContent += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === botMsgId ? { ...msg, content: fullContent } : msg
        ));
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionQuery !== null && filteredRefs.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex(prev => Math.min(prev + 1, filteredRefs.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSelectMention(filteredRefs[mentionSelectedIndex]);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-[#fdfdfc] p-4">
        <form onSubmit={handleAuth} className="bg-white border border-[#d4af37]/30 shadow-xl rounded-3xl p-8 max-w-sm w-full flex flex-col items-center gap-4">
          <Sparkles className="text-[#d4af37] w-12 h-12 mb-2" />
          <h1 className="font-serif text-3xl font-bold text-[#b59325]">Mishkat</h1>
          <p className="text-sm text-slate-500 mb-2 text-center">
            {authMode === 'login' ? 'Welcome back. Please log in.' : 'Create a new account.'}
          </p>

          {authError && (
            <div className="w-full p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100">
              {authError}
            </div>
          )}

          {authMode === 'register' && (
            <div className="w-full relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name (Optional)"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
              />
            </div>
          )}

          <div className="w-full relative">
            <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
            />
          </div>

          <div className="w-full relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d4af37]/50"
            />
          </div>

          <button type="submit" className="w-full bg-[#d4af37] text-white font-medium py-3 rounded-xl hover:bg-[#c29e2e] transition-colors mt-2 shadow-md shadow-[#d4af37]/20">
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <button 
            type="button" 
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            className="text-sm text-slate-500 hover:text-[#d4af37] transition-colors mt-2"
          >
            {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] flex bg-[#fdfdfc] text-slate-800 overflow-hidden relative">
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-[#d4af37]/20 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <button 
            onClick={startNewChat}
            className="flex-1 flex items-center gap-2 bg-[#FAF6EC] text-[#927822] px-4 py-2.5 rounded-xl font-medium hover:bg-[#F2E8CE] transition-colors"
          >
            <Plus size={18} /> New Chat
          </button>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden ml-2 p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 pb-2 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search chats..."
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#d4af37]/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredChats.length === 0 ? (
            <p className="text-center text-xs text-slate-400 mt-4">No chats found.</p>
          ) : (
            filteredChats.map(chat => (
              <button 
                key={chat.id}
                onClick={() => loadChat(chat.id)}
                className={`w-full text-left px-3 py-3 rounded-lg flex flex-col gap-1 transition-colors ${currentChatId === chat.id ? 'bg-[#d4af37]/10 border border-[#d4af37]/20' : 'hover:bg-slate-50 border border-transparent'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-slate-700 truncate">{chat.title}</span>
                </div>
                {chat.preview && <span className="text-xs text-slate-500 truncate">{chat.preview}</span>}
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#d4af37] text-white flex items-center justify-center font-bold">
            {currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : <User size={16} />}
          </div>
          <div className="flex-1 truncate">
            <p className="text-sm font-semibold text-slate-700 truncate">{currentUser?.full_name || currentUser?.username || 'User'}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full relative">
        <header className="w-full bg-white/80 backdrop-blur-md border-b border-[#d4af37]/20 py-4 px-4 flex items-center gap-3 sticky top-0 z-30 shadow-sm shadow-[#d4af37]/5">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2 flex-1 lg:justify-center">
            <Sparkles className="text-[#d4af37] w-6 h-6" />
            <h1 className="font-serif text-2xl font-bold text-[#b59325]">Mishkat</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 flex flex-col space-y-8 scroll-smooth lg:items-center">
          <div className="w-full max-w-4xl flex flex-col space-y-8">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                dir="auto"
              >
                {msg.role === 'bot' && (
                  <div className="flex items-center gap-2 mb-2 px-1 text-sm font-semibold text-[#b59325] select-none">
                    <Sparkles size={16} />
                    <span>Mishkat</span>
                  </div>
                )}
                <div 
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-5 py-4 ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-[#d4af37] to-[#ba9829] text-white shadow-md rounded-br-none' 
                      : 'bg-white border border-[#d4af37]/20 shadow-sm rounded-bl-none text-slate-700'
                  }`}
                >
                  <div dir='rtl' className={msg.role === 'bot' ? 'markdown-body text-[15px]' : 'whitespace-pre-wrap text-[15px]'}>
                    {msg.role === 'bot' ? (
                      <Markdown remarkPlugins={[remarkGfm]}>{msg.content || "..."}</Markdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex flex-col items-start px-2">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[#b59325] select-none">
                  <Sparkles size={16} />
                  <span>Mishkat</span>
                </div>
                <div className="bg-white border border-[#d4af37]/20 shadow-sm rounded-2xl rounded-bl-none px-6 py-5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#d4af37] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#d4af37] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#d4af37] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        <div className="w-full px-4 sm:px-6 pb-6 pt-2 shrink-0 flex justify-center">
          <div className="w-full max-w-4xl relative">
            <form 
              onSubmit={handleSubmit} 
              className="relative flex items-end gap-2 bg-white border border-[#d4af37]/30 shadow-lg shadow-[#d4af37]/10 rounded-3xl p-2 transition-all focus-within:ring-2 focus-within:ring-[#d4af37]/50 focus-within:border-[#d4af37]"
            >
              {mentionQuery !== null && (
                <div className="absolute bottom-[calc(100%+0.5rem)] left-0 w-full sm:w-80 max-h-60 overflow-y-auto bg-white border border-[#d4af37]/30 rounded-2xl shadow-xl z-50 flex flex-col p-1">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 border-b border-slate-100">
                    <BookHeart size={14} /> Sources
                  </div>
                  {filteredRefs.length > 0 ? (
                    filteredRefs.map((ref, idx) => (
                      <button
                        key={ref.id}
                        type="button"
                        onMouseEnter={() => setMentionSelectedIndex(idx)}
                        onClick={() => handleSelectMention(ref)}
                        className={`flex justify-between items-center px-4 py-3 text-left transition-colors ${idx === mentionSelectedIndex ? 'bg-[#FAF6EC] text-[#927822]' : 'hover:bg-[#FAF6EC]/50 text-slate-700'}`}
                        dir="auto"
                      >
                        <span className="font-semibold text-[#927822]">{ref.name}</span>
                        <span className="font-serif text-sm text-slate-500">{ref.arabicTitle}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                      No sources found.
                    </div>
                  )}
                </div>
              )}

              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                placeholder="Ask Mishkat... (Type @ at the start to mention sources)"
                className="flex-1 max-h-[200px] min-h-[44px] bg-transparent border-none outline-none resize-none px-4 py-3 text-[15px] placeholder:text-slate-400 disabled:opacity-50"
                rows={1}
                dir="auto"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isProcessing}
                className="shrink-0 p-3 mb-0.5 mr-0.5 rounded-full bg-[#d4af37] text-white hover:bg-[#c29e2e] active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center shadow-md shadow-[#d4af37]/30"
              >
                <Send size={20} className="relative ml-0.5" />
              </button>
            </form>
            <div className="text-center mt-3 text-xs text-slate-400 font-medium">
              Mishkat can make mistakes. Consider verifying important knowledge.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}