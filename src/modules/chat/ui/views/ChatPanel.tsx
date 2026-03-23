"use client";

import { useState, useRef, useEffect } from 'react';
import { Send, User, Database, AlertCircle, Loader2 } from 'lucide-react';

type Message = {
    id: string;
    role: 'user' | 'agent';
    text: string;
    isGuardrail?: boolean;
    cypher?: string;
};

export default function ChatPanel({
    setHighlightIds
}: {
    setHighlightIds: (ids: string[]) => void;
}) {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'agent', text: 'Hi! I can help you analyze the Order to Cash process.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userText = input.trim();
        setInput('');
        setHighlightIds([]); // clear previous

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: userText
        };

        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userText })
            });

            if (!res.ok) throw new Error("API error");

            const data = await res.json();

            // UNIVERSAL ID EXTRACTION (robust)
            const ids: string[] = [];

            if (data.data) {
                data.data.forEach((item: any) => {
                    Object.values(item).forEach((val: any) => {

                        if (val?.id !== undefined) {
                            ids.push(String(val.id));
                        }

                        else if (typeof val === 'string' || typeof val === 'number') {
                            ids.push(String(val));
                        }

                        else if (typeof val === 'object' && val !== null) {
                            Object.values(val).forEach((v: any) => {
                                if (typeof v === 'string' || typeof v === 'number') {
                                    ids.push(String(v));
                                }
                            });
                        }
                    });
                });
            }

            setHighlightIds(ids);

            const agentMsg: Message = {
                id: Date.now().toString(),
                role: 'agent',
                text: data.text || 'Sorry, I encountered an error.',
                isGuardrail: data.type === 'guardrail',
                cypher: data.cypherUsed
            };

            setMessages(prev => [...prev, agentMsg]);

        } catch (error) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'agent',
                text: 'Failed to connect to the server.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white shadow-lg w-full">

            <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-sm text-[#37352f]">Chat with Graph</h2>
                <p className="text-xs text-gray-400">Order to Cash</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                        <div className={`flex items-center gap-2 mb-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`p-1.5 rounded-full ${msg.role === 'user' ? 'bg-gray-200 text-gray-600' : 'bg-[#37352f] text-white'}`}>
                                {msg.role === 'user' ? <User size={14} /> : <Database size={14} />}
                            </div>
                            <span className="text-xs font-semibold text-gray-700">
                                {msg.role === 'user' ? 'You' : 'Dodge AI'}
                            </span>
                        </div>

                        <div className={`max-w-[85%] text-sm ${msg.role === 'user'
                            ? 'bg-[#37352f] text-white px-4 py-2 rounded-2xl rounded-tr-sm'
                            : 'bg-gray-100 text-[#37352f] px-4 py-2 rounded-2xl rounded-tl-sm'
                            }`}>
                            {msg.isGuardrail && <AlertCircle size={16} className="inline mr-2 text-red-500" />}
                            {msg.text}

                            {msg.cypher && (
                                <div className="mt-2 p-2 bg-gray-50 border rounded text-[10px] font-mono text-gray-500">
                                    <span className="font-bold">Cypher:</span> {msg.cypher}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Analyzing graph data...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t bg-gray-50">
                <div className="flex gap-2 bg-white border rounded-lg p-1">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Analyze anything..."
                        className="flex-1 px-3 py-2 outline-none text-sm"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading}
                        className="p-2 bg-gray-400 text-white rounded-md hover:bg-[#37352f]"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}