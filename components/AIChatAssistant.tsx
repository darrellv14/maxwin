import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Send,
  X,
  Minimize2,
  Maximize2,
  User,
  Loader2,
  Sparkles,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { chatApi } from "../services/apiService";
import { getOptimizedLogoUrl } from "../constants/logo";

// Optimized logo sizes for chat
const LOGO_SM = getOptimizedLogoUrl(24, 24);
const LOGO_MD = getOptimizedLogoUrl(32, 32);
const LOGO_LG = getOptimizedLogoUrl(48, 48);

// Simple markdown renderer for chat messages
const renderMarkdown = (text: string): React.ReactNode => {
  // Split by lines for processing
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  
  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType === 'ul' ? 'ul' : 'ol';
      elements.push(
        <ListTag key={`list-${elements.length}`} className={listType === 'ul' ? 'list-disc list-inside my-1 space-y-0.5' : 'list-decimal list-inside my-1 space-y-0.5'}>
          {listItems.map((item, i) => (
            <li key={i} className="text-xs sm:text-sm">{processInlineMarkdown(item)}</li>
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  const processInlineMarkdown = (line: string): React.ReactNode => {
    // Process inline markdown: **bold**, *italic*, `code`
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      // Bold: **text** or __text__
      const boldMatch = remaining.match(/^(.*?)(\*\*|__)(.+?)\2(.*)$/s);
      if (boldMatch) {
        if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
        parts.push(<strong key={key++} className="font-semibold text-white">{processInlineMarkdown(boldMatch[3])}</strong>);
        remaining = boldMatch[4];
        continue;
      }

      // Italic: *text* or _text_ (single)
      const italicMatch = remaining.match(/^(.*?)(\*|_)([^*_]+)\2(.*)$/s);
      if (italicMatch && !italicMatch[1].endsWith('*') && !italicMatch[4].startsWith('*')) {
        if (italicMatch[1]) parts.push(<span key={key++}>{italicMatch[1]}</span>);
        parts.push(<em key={key++} className="italic text-gray-300">{processInlineMarkdown(italicMatch[3])}</em>);
        remaining = italicMatch[4];
        continue;
      }

      // Code: `text`
      const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/s);
      if (codeMatch) {
        if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
        parts.push(<code key={key++} className="bg-gray-700 px-1 py-0.5 rounded text-terminal-green text-xs font-mono">{codeMatch[2]}</code>);
        remaining = codeMatch[3];
        continue;
      }

      // No more matches, add remaining text
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  lines.forEach((line, index) => {
    // Check for unordered list (*, -, •)
    const ulMatch = line.match(/^[\s]*[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      return;
    }

    // Check for ordered list (1., 2., etc)
    const olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (olMatch) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(olMatch[1]);
      return;
    }

    // Not a list item, flush any pending list
    flushList();

    // Check for headers (### Header)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const className = level <= 2 
        ? 'text-sm sm:text-base font-bold text-white mt-2 mb-1' 
        : 'text-xs sm:text-sm font-semibold text-gray-200 mt-1.5 mb-0.5';
      elements.push(<div key={`h-${index}`} className={className}>{processInlineMarkdown(text)}</div>);
      return;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`br-${index}`} className="h-2" />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${index}`} className="text-xs sm:text-sm">
        {processInlineMarkdown(line)}
      </p>
    );
  });

  // Flush any remaining list
  flushList();

  return <div className="space-y-1">{elements}</div>;
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIChatAssistantProps {
  currentTicker?: string;
  currentData?: any[];
}

const AIChatAssistant: React.FC<AIChatAssistantProps> = ({ currentTicker, currentData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: `Halo! Saya AI Assistant MooCuan 🐮. Tanyakan apa saja tentang saham, analisis teknikal, atau strategi trading.${currentTicker ? ` Saat ini Anda melihat ${currentTicker}.` : ""}`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Quick questions
  const quickQuestions = [
    `Analisis ${currentTicker || "BBCA.JK"} sekarang`,
    "Saham apa yang bagus untuk swing trade?",
    "Jelaskan indikator RSI",
    "Kapan waktu terbaik untuk entry?",
  ];

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build context for AI
      let context = "";

      if (currentTicker && currentData && currentData.length > 0) {
        const lastPrice = currentData[currentData.length - 1];
        context = `User sedang melihat chart ${currentTicker}. Harga terakhir: ${lastPrice.close}, RSI: ${lastPrice.rsi14?.toFixed(2) || "N/A"}, MACD: ${lastPrice.macd?.toFixed(2) || "N/A"}.`;
      }

      const response = await chatApi.send(input.trim(), "chat", context);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          response || "Maaf, saya tidak bisa memproses permintaan saat ini. Coba lagi nanti.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Maaf, terjadi kesalahan. Pastikan API key sudah dikonfigurasi dengan benar.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 
              rounded-full shadow-xl shadow-green-500/50 flex items-center justify-center z-50
              hover:shadow-green-400/70 hover:from-green-300 hover:via-emerald-400 hover:to-teal-400 
              transition-all duration-300 border-2 border-white/20 p-2"
          >
            <img src={LOGO_LG} alt="MooCuan AI Assistant" className="w-full h-full object-contain drop-shadow-lg" />
            <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 rounded-full flex items-center justify-center
              border-2 border-white shadow-lg animate-pulse">
              <Sparkles className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed z-50 bg-terminal-dark border border-gray-700 rounded-2xl shadow-2xl 
              overflow-hidden flex flex-col ${
                isExpanded
                  ? "inset-2 sm:inset-4 md:inset-8"
                  : "bottom-2 right-2 left-2 sm:left-auto sm:bottom-6 sm:right-6 sm:w-[380px] h-[70vh] sm:h-[500px] max-h-[80vh]"
              }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800/50 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-linear-to-br from-terminal-green to-emerald-600 flex items-center justify-center p-1">
                  <img src={LOGO_MD} alt="MooCuan" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-white text-xs sm:text-sm">MooCuan AI</h3>
                  <p className="text-[10px] sm:text-xs text-gray-500">Stock Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 sm:p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {isExpanded ? (
                    <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 sm:p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 sm:gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full shrink-0 flex items-center justify-center ${
                      message.role === "user"
                        ? "bg-blue-500"
                        : "bg-linear-to-br from-terminal-green to-emerald-600"
                    }`}
                  >
                    {message.role === "user" ? (
                      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    ) : (
                      <img src={LOGO_SM} alt="MooCuan" className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 ${
                      message.role === "user"
                        ? "bg-blue-500 text-white rounded-tr-md"
                        : "bg-gray-800 text-gray-200 rounded-tl-md"
                    }`}
                  >
                    {message.role === "user" ? (
                      <p className="text-xs sm:text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      renderMarkdown(message.content)
                    )}
                    <p className="text-[10px] sm:text-xs mt-1 opacity-50">
                      {message.timestamp.toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2 sm:gap-3"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-linear-to-br from-terminal-green to-emerald-600 flex items-center justify-center p-1">
                    <img src={LOGO_MD} alt="MooCuan" className="w-full h-full object-contain" />
                  </div>
                  <div className="bg-gray-800 rounded-2xl rounded-tl-md px-3 sm:px-4 py-2.5 sm:py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-terminal-green animate-spin" />
                      <span className="text-xs sm:text-sm text-gray-400">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Questions */}
            {messages.length <= 2 && (
              <div className="px-3 sm:px-4 pb-2">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1.5 sm:mb-2">Quick questions:</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {quickQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickQuestion(q)}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 sm:p-4 border-t border-gray-700">
              <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask about stocks..."
                  className="flex-1 bg-transparent text-white text-xs sm:text-sm outline-none placeholder-gray-500"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="p-1.5 sm:p-2 bg-terminal-green hover:bg-terminal-green/80 disabled:bg-gray-700 
                    disabled:text-gray-500 text-black rounded-lg transition-colors"
                >
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatAssistant;
