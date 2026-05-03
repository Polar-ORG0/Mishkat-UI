import { useState, useEffect, useRef } from 'react';
import { queryRAGStream } from './services/ragService';
import { Terminal } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  id: string;
  role: 'user' | 'bot' | 'system';
  content: string;
};

const BOOT_SEQUENCE = [
  "[BOOT] Bismillah ir-Rahman ir-Rahim",
  "[BOOT] Initializing Hikmah (Wisdom) RAG Kernel v2.0...",
  "[BOOT] Loading knowledge base indices [OK]",
  "[BOOT] Establishing connection to remote cluster [OK]",
  "[BOOT] Loading generative LLM core [OK]",
  "[OK] As-salamu alaykum. Terminal ready. Type your query below."
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isResponse, setIsResponse] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  useEffect(() => {
    const timeoutIds: NodeJS.Timeout[] = [];
    
    BOOT_SEQUENCE.forEach((sysMsg, index) => {
      const id = setTimeout(() => {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'system', content: sysMsg }]);
        
        if (index === BOOT_SEQUENCE.length - 1) {
          setIsBooting(false);
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }, index * 400 + 300);
      timeoutIds.push(id);
    });

    return () => timeoutIds.forEach(clearTimeout);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing || isBooting) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: userMessage }]);
    setIsProcessing(true);

    const botMsgId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: botMsgId, role: 'bot', content: "" }]);

    try {
      let fullContent = "";
      
      setIsResponse(true)
      await queryRAGStream(userMessage, (chunk) => {
        if (fullContent === "") setIsProcessing(false);
        fullContent += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === botMsgId ? { ...msg, content: fullContent } : msg
        ));
      });
      setIsResponse(false);
      
    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId ? { ...msg, content: "[ERROR] Stream connection dropped." } : msg
      ));
    } finally {
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div className="w-full h-screen p-4 sm:p-8 flex items-center justify-center bg-black">
      <div 
        className="w-full h-full max-w-6xl max-h-[900px] flex flex-col bg-[#04120e]/80 border border-emerald-900/40 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md shadow-emerald-900/10"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="glass-header h-12 flex items-center px-4 shrink-0 justify-between select-none bg-[#020d09]">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-sm"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-sm"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-sm"></div>
          </div>
          <div className="flex items-center text-emerald-600/70 text-xs font-semibold uppercase tracking-widest gap-2">
            <Terminal size={14} />
            <span>Mishkat</span>
          </div>
          <div className="w-12"></div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 pb-20 flex flex-col space-y-3 relative z-10 text-[15px]">
          {messages.map((msg) => (
            <div key={msg.id} className="whitespace-pre-wrap break-words">
              {msg.role === 'user' && (
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mb-1" dir="auto">
                  <span className="shrink-0 flex items-center font-bold">
                    <span className="text-amber-400">talib</span>
                    <span className="text-slate-400">@</span>
                    <span className="text-emerald-500">hikmah-sys</span>
                    <span className="text-slate-400 ml-1">~$</span>
                  </span>
                  <span className="text-slate-200">{msg.content}</span>
                </div>
              )}
              {msg.role === 'system' && (
                <div className="text-emerald-600/90 tracking-wide" dir="auto">{msg.content}</div>
              )}
              {msg.role === 'bot' && (
                <div className="text-emerald-300 mt-2 mb-5 leading-relaxed bg-[#020c09]/50 p-4 rounded-lg border border-emerald-900/20 shadow-inner" dir="auto">
                  <div className="markdown-body">
                    <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isProcessing && (
            <div className="text-emerald-500 font-medium mt-2 flex items-center gap-2">
               <span className="text-amber-400 animate-pulse">⚙</span> 
               [PROC] Analyzing knowledge base<span className="animate-pulse">...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {!isBooting&&!isResponse && (
          <form 
            onSubmit={handleSubmit} 
            className="shrink-0 bg-[#020d09] border-t border-emerald-900/30 p-4 px-6 flex flex-col sm:flex-row sm:items-center gap-2 z-20"
          >
            <span className="shrink-0 flex items-center font-bold">
              <span className="text-amber-400">ask</span>
              <span className="text-slate-400">@</span>
              <span className="text-emerald-500">miskat</span>
              <span className="text-slate-400 ml-1">~$</span>
            </span>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isProcessing}
              autoFocus
              className="flex-1 bg-transparent border-none outline-none text-slate-200 caret-emerald-500 disabled:opacity-50 tracking-wide"
              spellCheck={false}
              autoComplete="off"
            />
          </form>
        )}
      </div>
    </div>
  );
}