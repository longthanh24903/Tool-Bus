import React, { useMemo } from "react";
import {
  Input,
  Select,
  Button,
  Switch,
  Space,
  Divider,
  Popconfirm,
  Spin,
} from "antd";
import {
  ThunderboltOutlined,
  ReloadOutlined,
  DeleteOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { LANGUAGE_OPTIONS, PART_OPTIONS } from "../constants";
import type { Language } from "../types";

const { TextArea } = Input;

interface ControlsProps {
  topic: string;
  setTopic: (value: string) => void;
  numParts: number;
  setNumParts: (value: number) => void;
  wordsPerPart: number;
  setWordsPerPart: (value: number) => void;
  language: Language;
  setLanguage: (value: Language) => void;
  enableVoice: boolean;
  setEnableVoice: (value: boolean) => void;
  enableMinimaxVoice: boolean;
  setEnableMinimaxVoice: (value: boolean) => void;
  enableClickbaitIntro: boolean;
  setEnableClickbaitIntro: (value: boolean) => void;
  enableLogicAnalysis: boolean;
  setEnableLogicAnalysis: (value: boolean) => void;
  autoContinue: boolean;
  setAutoContinue: (value: boolean) => void;
  isLoading: boolean;
  isGenerating: boolean;
  isComplete: boolean;
  onGenerate: () => void;
  onReset: () => void;
  currentPart: number;
  totalParts: number;
  isSuggestingTopic: boolean;
  onSuggestTopic: () => void;
  previousTopics: string[];
  onClearHistory: () => void;
  onOpenHistoryModal: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  topic,
  setTopic,
  numParts,
  setNumParts,
  wordsPerPart,
  setWordsPerPart,
  language,
  setLanguage,
  enableVoice,
  setEnableVoice,
  enableMinimaxVoice,
  setEnableMinimaxVoice,
  enableClickbaitIntro,
  setEnableClickbaitIntro,
  enableLogicAnalysis,
  setEnableLogicAnalysis,
  autoContinue,
  setAutoContinue,
  isLoading,
  isGenerating,
  isComplete,
  onGenerate,
  onReset,
  currentPart,
  totalParts,
  isSuggestingTopic,
  onSuggestTopic,
  previousTopics,
  onClearHistory,
  onOpenHistoryModal,
}) => {
  const isGenerationStarted = currentPart > 0;

  const buttonText = useMemo(() => {
    if (isGenerating) {
      return `Đang tạo Phần ${currentPart + 1}...`;
    }
    if (isSuggestingTopic) {
      return "Đang gợi ý...";
    }
    if (isComplete) {
      return "Bắt đầu truyện mới";
    }
    if (isGenerationStarted) {
      return `Tạo Phần ${currentPart + 1} / ${totalParts}`;
    }
    return "Tạo truyện";
  }, [
    isGenerating,
    isSuggestingTopic,
    isComplete,
    isGenerationStarted,
    currentPart,
    totalParts,
  ]);

  const handleButtonClick = () => {
    if (isComplete) {
      onReset();
    } else {
      onGenerate();
    }
  };

  const handleSetEnableVoice = (value: boolean) => {
    setEnableVoice(value);
    if (value) {
      setEnableMinimaxVoice(false);
    }
  };

  const handleSetEnableMinimaxVoice = (value: boolean) => {
    setEnableMinimaxVoice(value);
    if (value) {
      setEnableVoice(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-[#E9E6F8] shadow-[0_1px_6px_rgba(0,0,0,0.06)] sticky top-8">
      <h2 className="text-[24px] font-semibold mb-6 bg-gradient-to-tr from-[#6A3ED9] to-[#7951d4] bg-clip-text text-transparent">
        Cấu hình
      </h2>

      <Space direction="vertical" size="middle" className="w-full">
        {/* Topic Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[14px] font-semibold text-[#1E1E1E] flex items-center gap-1.5">
              <span className="text-[18px]">📝</span>
              <span>Chủ đề / Ý tưởng chính</span>
            </label>
            <Button
              type="link"
              icon={<ThunderboltOutlined />}
              onClick={onSuggestTopic}
              disabled={isLoading || isSuggestingTopic || isGenerationStarted}
              loading={isSuggestingTopic}
              size="small"
              className="text-[#6A3ED9]"
            >
              AI Gợi ý
            </Button>
          </div>

          <TextArea
            rows={5}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ví dụ: Đồng sáng lập đã đánh cắp ý tưởng startup của tôi"
            disabled={isLoading || isGenerationStarted || isSuggestingTopic}
            className="h-auto rounded-xl overflow-hidden border border-[#E2E0EB] px-3 py-2 focus:border-[#7951d4] focus:shadow-[0_0_0_3px_rgba(121,81,212,0.12)]"
          />
        </div>

        {/* Number of Parts and Words */}
        <div>
          <Space className="w-full" size="middle">
            <div className="flex-1">
              <label className="flex items-center gap-1.5 text-[14px] font-semibold text-[#1E1E1E] mb-2">
                <span className="text-[18px]">🎬</span>
                <span>Số phần</span>
              </label>
              <Select
                value={numParts}
                onChange={setNumParts}
                disabled={isLoading || isGenerationStarted}
                className="w-full"
                options={PART_OPTIONS.map((part) => ({
                  label: `${part} Phần`,
                  value: part,
                }))}
              />
            </div>

            <div className="flex-1">
              <label className="flex items-center gap-1.5 text-[14px] font-semibold text-[#1E1E1E] mb-2">
                <span className="text-[18px]">🔢</span>
                <span>Số từ / phần</span>
              </label>
              <Input
                type="number"
                value={wordsPerPart}
                onChange={(e) => setWordsPerPart(Number(e.target.value))}
                disabled={isLoading || isGenerationStarted}
                min={100}
                step={50}
                className="h-10 rounded-xl border border-[#E2E0EB] px-3 focus:border-[#7951d4] focus:shadow-[0_0_0_3px_rgba(121,81,212,0.12)]"
              />
            </div>
          </Space>
        </div>

        {/* Language */}
        <div>
          <label className="flex items-center gap-1.5 text-[14px] font-semibold text-[#1E1E1E] mb-2">
            <span className="text-[18px]">🎯</span>
            <span>Ngôn ngữ</span>
          </label>
          <Select
            value={language}
            onChange={setLanguage}
            disabled={isLoading || isGenerationStarted}
            className="w-full"
            options={LANGUAGE_OPTIONS.map((opt) => ({
              label: opt.label,
              value: opt.value,
            }))}
          />
        </div>

        {/* Toggles */}
        <div>
          <Space direction="vertical" size="middle" className="w-full">
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-[#1E1E1E] font-normal flex items-center gap-1.5">
                <span className="text-[18px]">🔊</span>
                <span>Bật giọng đọc ElevenLabs / SPX</span>
              </span>
              <Switch
                checked={enableVoice}
                onChange={handleSetEnableVoice}
                disabled={isLoading || isGenerationStarted}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[15px] text-[#1E1E1E] font-normal flex items-center gap-1.5">
                <span className="text-[18px]">🔊</span>
                <span>Bật giọng đọc Minimax TTS</span>
              </span>
              <Switch
                checked={enableMinimaxVoice}
                onChange={handleSetEnableMinimaxVoice}
                disabled={isLoading || isGenerationStarted}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[15px] text-[#1E1E1E] font-normal flex items-center gap-1.5">
                <span className="text-[18px]">⚡</span>
                <span>Bật mở đầu 'giật tít'</span>
              </span>
              <Switch
                checked={enableClickbaitIntro}
                onChange={setEnableClickbaitIntro}
                disabled={isLoading || isGenerationStarted}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[15px] text-[#1E1E1E] font-normal flex items-center gap-1.5">
                <span className="text-[18px]">💡</span>
                <span>AI phân tích logic truyện</span>
              </span>
              <Switch
                checked={enableLogicAnalysis}
                onChange={setEnableLogicAnalysis}
                disabled={isLoading || isGenerationStarted}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[15px] text-[#1E1E1E] font-normal flex items-center gap-1.5">
                <span className="text-[18px]">🚀</span>
                <span>Tự động viết tiếp đến hết</span>
              </span>
              <Switch
                checked={autoContinue}
                onChange={setAutoContinue}
                disabled={isLoading || isGenerationStarted}
              />
            </div>
          </Space>
        </div>

        {/* History Button */}
        <div>
          <Button
            icon={<HistoryOutlined />}
            onClick={onOpenHistoryModal}
            disabled={isLoading || isGenerationStarted}
            block
            className={`h-11 rounded-xl border ${
              previousTopics.length > 0
                ? "bg-[#E8E1FB] border-[#A68AF0] text-[#7951d4]"
                : "bg-[#F5F5F7] border-[#E2E0EB] text-[#6b6b6b]"
            }`}
          >
            Lịch sử Chủ đề
            {previousTopics.length > 0 && (
              <span className="ml-2 text-[#7951d4] font-semibold">
                ({previousTopics.length})
              </span>
            )}
          </Button>
        </div>

        <Divider className="my-2" />

        {/* Action Buttons */}
        <Space direction="vertical" size="middle" className="w-ful">
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleButtonClick}
            disabled={isLoading || (!isComplete && topic.trim() === "")}
            loading={isLoading}
            block
            size="large"
            className="h-11 rounded-xl font-semibold text-[16px] border-0
                     bg-gradient-to-r from-[#7951d4] to-[#9c7bff]
                     shadow-[0_4px_10px_rgba(121,81,212,0.25)]
                     hover:brightness-110"
          >
            {buttonText}
          </Button>

          {isGenerationStarted && !isComplete && (
            <Button
              icon={<ReloadOutlined />}
              onClick={onReset}
              disabled={isLoading || isSuggestingTopic}
              block
              className="h-11 rounded-xl"
            >
              Thiết lập lại &amp; Bắt đầu lại
            </Button>
          )}
        </Space>
      </Space>
    </div>
  );
};
