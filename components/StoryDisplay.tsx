import React, { useState } from 'react';
import type { StoryPart } from '../types';
import { ClipboardCheckIcon, ClipboardIcon } from './Icons';

interface StoryDisplayProps {
  storyParts: StoryPart[];
  totalParts: number;
}

export const StoryDisplay: React.FC<StoryDisplayProps> = ({ storyParts, totalParts }) => {
  const [copied, setCopied] = useState(false);

  if (storyParts.length === 0) {
    return null;
  }

  const handleCopy = () => {
    const fullText = storyParts.map(part => 
      `TIÊU ĐỀ: ${part.title}\n\n${part.body}\n\n${part.endLine}`
    ).join('\n\n---\n\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fade-in">
        <div className="flex justify-between items-center mb-6">
            <div className="bg-indigo-500/20 text-indigo-300 text-sm font-semibold px-4 py-1 rounded-full">
                Đã tạo {storyParts.length} trên {totalParts} phần
            </div>
            <button 
                onClick={handleCopy}
                className="flex items-center text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-3 rounded-md transition-colors"
                title="Sao chép toàn bộ truyện"
            >
                {copied ? (
                    <>
                        <ClipboardCheckIcon className="w-5 h-5 mr-2 text-green-400"/>
                        Đã chép!
                    </>
                ) : (
                    <>
                        <ClipboardIcon className="w-5 h-5 mr-2"/>
                        Sao chép Toàn bộ
                    </>
                )}
            </button>
        </div>
        <div className="space-y-8">
            {storyParts.map((part, index) => (
                <div key={index} className="fade-in-part">
                    {index > 0 && <hr className="border-t-2 border-dashed border-gray-700 my-8" />}
                    <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-400 mb-4">
                        {part.title}
                    </h3>
                    <div className="prose prose-invert max-w-none text-gray-300 text-lg leading-relaxed space-y-4">
                        <p className="whitespace-pre-wrap font-serif">
                        {part.body}
                        </p>
                        <p className="font-semibold italic text-indigo-300/80 border-l-4 border-indigo-500 pl-4 py-2">
                        {part.endLine}
                        </p>
                    </div>
                </div>
            ))}
        </div>

      <style jsx>{`
        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        .fade-in-part {
          animation: fadeIn 0.5s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .prose {
            font-size: 1.125rem;
            line-height: 1.75;
        }
      `}</style>
    </div>
  );
};
