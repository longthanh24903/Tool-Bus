import React, { useState } from "react";
import type { Suggestions } from "../types";
import {
  ClipboardCheckIcon,
  ClipboardIcon,
  PhotoIcon,
  SpeakerWaveIcon,
  FilmIcon,
} from "./Icons";

interface PostGenerationSuggestionsProps {
  suggestions: Suggestions;
}

const SuggestionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: string[];
}> = ({ title, icon, items }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-300 shadow-md">
      <h4 className="flex items-center text-base font-semibold text-indigo-500 mb-3">
        {icon}
        <span className="ml-2">{title}</span>
      </h4>
      <ul className="space-y-2 max-h-[500px] overflow-y-auto">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex items-center justify-between bg-white p-3 rounded-md text-sm border-t border-gray-300"
          >
            <span className="text-gray-900 flex-1 pr-2">"{item}"</span>
            <button
              onClick={() => handleCopy(item, index)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Sao chép gợi ý"
            >
              {copiedIndex === index ? (
                <ClipboardCheckIcon className="w-5 h-5 text-green-400" />
              ) : (
                <ClipboardIcon className="w-5 h-5" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const PostGenerationSuggestions: React.FC<
  PostGenerationSuggestionsProps
> = ({ suggestions }) => {
  return (
    <div className="mt-8 pt-6 border-t border-gray-700 fade-in">
      <h3 className="text-2xl font-bold mb-4 text-center text-gray-900">
        Tài nguyên sản xuất
      </h3>
      <p className="text-center text-gray-400 mb-6">
        Đây là một số tài nguyên do AI tạo ra để hỗ trợ sản xuất video của bạn.
      </p>
      <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6">
        <SuggestionCard
          title="Văn bản Thumbnail"
          icon={<PhotoIcon className="w-6 h-6" />}
          items={suggestions.thumbnails}
        />
        <SuggestionCard
          title="Gợi ý giọng đọc (ElevenLabs)"
          icon={<SpeakerWaveIcon className="w-6 h-6" />}
          items={suggestions.voicePrompts}
        />
        <SuggestionCard
          title="Gợi ý hình ảnh (Sora/Imagen)"
          icon={<FilmIcon className="w-6 h-6" />}
          items={suggestions.imagePrompts}
        />
      </div>
      <style jsx>{`
        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
