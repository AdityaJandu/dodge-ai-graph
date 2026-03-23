"use client";

import dynamic from 'next/dynamic';

import { useEffect, useState } from 'react';

const GraphViewer = dynamic(() => import('@/modules/graph/ui/views/GraphViewer'), { ssr: false });
const ChatPanel = dynamic(() => import('@/modules/chat/ui/views/ChatPanel'), { ssr: false });

export default function Home() {
  const [highlightIds, setHighlightIds] = useState<string[]>([]);

  useEffect(() => {
    const handler = (e: any) => {
      setHighlightIds(e.detail);
    };

    window.addEventListener("highlightNodes", handler);
    return () => window.removeEventListener("highlightNodes", handler);
  }, []);

  return (
    <main className="flex h-screen w-full bg-[#fffefc] text-[#37352f] font-sans">

      <div className="w-2/3 h-full border-r border-gray-200 relative">
        <GraphViewer highlightIds={highlightIds} />
      </div>

      <div className="w-1/3 h-full">
        <ChatPanel setHighlightIds={setHighlightIds} />
      </div>
    </main>
  );
}