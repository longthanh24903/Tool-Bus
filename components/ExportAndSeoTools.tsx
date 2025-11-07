import React, { useState, useCallback } from 'react';
import { generateSeoContent } from '../services/geminiService';
import type { Language, SeoContentType } from '../types';
import { ClipboardCheckIcon, ClipboardIcon, DocumentArrowDownIcon, DocumentTextIcon, TagIcon, ChatBubbleLeftRightIcon } from './Icons';

interface ExportAndSeoToolsProps {
  fullStoryText: string;
  topic: string;
  language: Language;
}

interface SeoResult {
    type: SeoContentType;
    content: string[];
}

const SEO_TOOLS: { type: SeoContentType; label: string; icon: React.ReactNode }[] = [
    { type: 'title', label: 'Tạo Tiêu đề (Titles)', icon: <DocumentTextIcon className="w-6 h-6"/> },
    { type: 'description', label: 'Tạo Mô tả (Description)', icon: <ChatBubbleLeftRightIcon className="w-6 h-6"/> },
    { type: 'hashtags', label: 'Tạo Hashtags', icon: <TagIcon className="w-6 h-6"/> },
];


export const ExportAndSeoTools: React.FC<ExportAndSeoToolsProps> = ({ fullStoryText, topic, language }) => {
    const [seoResults, setSeoResults] = useState<SeoResult[]>([]);
    const [isLoading, setIsLoading] = useState<SeoContentType | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

    const handleGenerateSeo = useCallback(async (type: SeoContentType) => {
        setIsLoading(type);
        setError(null);
        try {
            const results = await generateSeoContent(fullStoryText, topic, language, type);
            setSeoResults(prev => {
                const existing = prev.find(r => r.type === type);
                if (existing) {
                    return prev.map(r => r.type === type ? { ...r, content: results } : r);
                }
                return [...prev, { type, content: results }];
            });
        } catch (err: any) {
            setError(`Failed to generate ${type}: ${err.message}`);
        } finally {
            setIsLoading(null);
        }
    }, [fullStoryText, topic, language]);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(id);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleExport = () => {
        const blob = new Blob([fullStoryText], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const fileName = topic.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        link.download = `${fileName || 'story'}-script.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="mt-8 pt-6 border-t border-gray-700 fade-in">
            <h3 className="text-2xl font-bold mb-4 text-center text-gray-200">Công cụ SEO & Xuất bản</h3>
            <div className="flex justify-center mb-6">
                 <button 
                    onClick={handleExport}
                    className="flex items-center text-sm bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                >
                    <DocumentArrowDownIcon className="w-5 h-5 mr-2"/>
                    Tải về Kịch bản (.txt)
                </button>
            </div>
            
            <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6">
                {SEO_TOOLS.map(tool => {
                    const result = seoResults.find(r => r.type === tool.type);
                    return (
                        <div key={tool.type} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                             <div className="flex items-center justify-between mb-3">
                                <h4 className="flex items-center text-lg font-semibold text-indigo-300">
                                    {tool.icon}
                                    <span className="ml-2">{tool.label}</span>
                                </h4>
                                <button
                                    onClick={() => handleGenerateSeo(tool.type)}
                                    disabled={!!isLoading}
                                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded-md transition-colors disabled:opacity-50"
                                >
                                    {isLoading === tool.type ? 'Đang tạo...' : 'Tạo'}
                                </button>
                            </div>

                            {result && (
                                 <ul className="space-y-2">
                                    {result.content.map((item, index) => (
                                        <li key={index} className="flex items-center justify-between bg-gray-900/50 p-3 rounded-md text-sm">
                                            <span className="text-gray-300 flex-1 pr-2 whitespace-pre-wrap">{item}</span>
                                             <button 
                                                onClick={() => handleCopy(item, `${tool.type}-${index}`)}
                                                className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                                                title="Sao chép"
                                            >
                                                {copiedIndex === `${tool.type}-${index}` ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
            {error && <p className="text-red-400 text-center mt-4 text-sm">{error}</p>}
        </div>
    );
};
