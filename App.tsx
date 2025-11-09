import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Alert, Skeleton, Spin, Button, Empty, notification } from "antd";
import {
  KeyOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { Controls } from "./components/Controls";
import { StoryDisplay } from "./components/StoryDisplay";
import { PostGenerationSuggestions } from "./components/PostGenerationSuggestions";
import { ExportAndSeoTools } from "./components/ExportAndSeoTools";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { HistoryModal } from "./components/HistoryModal";
import { StoryHistoryModal } from "./components/StoryHistoryModal";
import { AutoWriteSettings } from "./components/AutoWriteSettings";
import * as geminiService from "./services/geminiService";
import { apiKeyManager } from "./services/apiKeyManager";
import { autoSaveService } from "./services/autoSaveService";
import { storyHistoryService } from "./services/storyHistoryService";
import type { Language, StoryPart, Suggestions, AutoWriteConfig } from "./types";
import { ImSpinner3 } from "react-icons/im";

const App: React.FC = () => {
  // State for story generation controls
  const [topic, setTopic] = useState<string>("");
  const [numParts, setNumParts] = useState<number>(3);
  const [wordsPerPart, setWordsPerPart] = useState<number>(450);
  const [language, setLanguage] = useState<Language>("Vietnamese");
  const [enableVoice, setEnableVoice] = useState<boolean>(true);
  const [enableMinimaxVoice, setEnableMinimaxVoice] = useState<boolean>(false);
  const [enableClickbaitIntro, setEnableClickbaitIntro] =
    useState<boolean>(true);
  const [enableLogicAnalysis, setEnableLogicAnalysis] = useState<boolean>(true);
  const [autoContinue, setAutoContinue] = useState<boolean>(false);

  // State for generation process and results
  const [storyParts, setStoryParts] = useState<StoryPart[]>([]);
  const [storyOutline, setStoryOutline] = useState<string>("");
  const [currentPart, setCurrentPart] = useState<number>(0);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSuggestingTopic, setIsSuggestingTopic] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [previousTopics, setPreviousTopics] = useState<string[]>([]);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isStoryHistoryModalOpen, setIsStoryHistoryModalOpen] = useState<boolean>(false);
  const [isAutoWriteSettingsOpen, setIsAutoWriteSettingsOpen] = useState<boolean>(false);

  // Auto Write Configuration
  const [autoWriteConfig, setAutoWriteConfig] = useState<AutoWriteConfig>(() => {
    try {
      const stored = localStorage.getItem("autoWriteConfig");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load auto write config:", error);
    }
    return {
      enabled: false,
      autoSuggestTopic: false,
      delayBetweenParts: 2000,
      autoLoop: false,
      maxStories: 0, // 0 = vô hạn
    };
  });

  // Auto Write State
  const [isAutoWriting, setIsAutoWriting] = useState<boolean>(false);
  const [isAutoLooping, setIsAutoLooping] = useState<boolean>(false);
  const [autoWriteProgress, setAutoWriteProgress] = useState<{
    current: number;
    total: number;
    status: string;
    storyNumber?: number; // Số story đã tạo trong auto loop
  }>({ current: 0, total: 0, status: "" });

  useEffect(() => {
    try {
      const storedTopics = localStorage.getItem("storyTopicHistory");
      if (storedTopics) {
        setPreviousTopics(JSON.parse(storedTopics));
      }
    } catch (error) {
      console.error("Failed to load topic history from localStorage:", error);
    }

    // Khởi tạo API key manager khi app khởi động
    apiKeyManager.initialize();
    
    // Khởi tạo auto save service
    autoSaveService.initialize();
  }, []);

  // Lưu auto write config khi thay đổi
  useEffect(() => {
    try {
      localStorage.setItem("autoWriteConfig", JSON.stringify(autoWriteConfig));
    } catch (error) {
      console.error("Failed to save auto write config:", error);
    }
  }, [autoWriteConfig]);

  const addTopicToHistory = useCallback((newTopic: string) => {
    setPreviousTopics((prevTopics) => {
      const updatedTopics = [
        newTopic,
        ...prevTopics.filter((t) => t !== newTopic),
      ].slice(0, 20); // Keep latest 20
      try {
        localStorage.setItem(
          "storyTopicHistory",
          JSON.stringify(updatedTopics)
        );
      } catch (error) {
        console.error("Failed to save topic history to localStorage:", error);
      }
      return updatedTopics;
    });
  }, []);

  const clearTopicHistory = useCallback(() => {
    setPreviousTopics([]);
    try {
      localStorage.removeItem("storyTopicHistory");
      notification.success({
        message: "Đã xóa lịch sử",
        description: "Tất cả chủ đề trong lịch sử đã được xóa.",
        icon: <CheckCircleOutlined style={{ color: "#7951d4" }} />,
        placement: "topRight",
        duration: 3,
      });
    } catch (error) {
      console.error("Failed to clear topic history from localStorage:", error);
      notification.error({
        message: "Lỗi",
        description: "Không thể xóa lịch sử. Vui lòng thử lại.",
        icon: <CloseCircleOutlined />,
        placement: "topRight",
        duration: 3,
      });
    }
  }, []);

  const deleteTopic = useCallback((topicToDelete: string) => {
    setPreviousTopics((prevTopics) => {
      const updatedTopics = prevTopics.filter((t) => t !== topicToDelete);
      try {
        localStorage.setItem(
          "storyTopicHistory",
          JSON.stringify(updatedTopics)
        );
        notification.success({
          message: "Đã xóa chủ đề",
          description: "Chủ đề đã được xóa khỏi lịch sử.",
          icon: <CheckCircleOutlined style={{ color: "#7951d4" }} />,
          placement: "topRight",
          duration: 2,
        });
      } catch (error) {
        console.error("Failed to save topic history to localStorage:", error);
        notification.error({
          message: "Lỗi",
          description: "Không thể xóa chủ đề. Vui lòng thử lại.",
          icon: <CloseCircleOutlined />,
          placement: "topRight",
          duration: 3,
        });
      }
      return updatedTopics;
    });
  }, []);

  const handleSetEnableVoice = useCallback((value: boolean) => {
    setEnableVoice(value);
    if (value) {
      setEnableMinimaxVoice(false);
    }
  }, []);

  const handleSetEnableMinimaxVoice = useCallback((value: boolean) => {
    setEnableMinimaxVoice(value);
    if (value) {
      setEnableVoice(false);
    }
  }, []);

  const isComplete = useMemo(
    () => storyParts.length > 0 && storyParts.length === numParts,
    [storyParts, numParts]
  );
  const isLoading = isGenerating || isSuggestingTopic;

  const fullStoryText = useMemo(
    () =>
      storyParts
        .map((p) => `TIÊU ĐỀ: ${p.title}\n\n${p.body}\n\n${p.endLine}`)
        .join("\n\n---\n\n"),
    [storyParts]
  );

  const handleReset = useCallback(() => {
    setTopic("");
    setStoryParts([]);
    setStoryOutline("");
    setCurrentPart(0);
    setSuggestions(null);
    setError(null);
    setIsGenerating(false);
    setAutoContinue(false);
    setIsAutoWriting(false);
    setIsAutoLooping(false);
    setAutoWriteProgress({ current: 0, total: 0, status: "" });
    notification.info({
      message: "Đã thiết lập lại",
      description:
        "Tất cả dữ liệu đã được xóa. Bạn có thể bắt đầu tạo truyện mới.",
      icon: <InfoCircleOutlined style={{ color: "#7951d4" }} />,
      placement: "topRight",
      duration: 3,
    });
  }, []);

  const handleSuggestTopic = useCallback(async () => {
    setIsSuggestingTopic(true);
    setError(null);
    try {
      const suggestedTopic = await geminiService.analyzeAndSuggestTopic(
        topic,
        language,
        previousTopics
      );
      setTopic(suggestedTopic);
      notification.success({
        message: "Đã gợi ý chủ đề",
        description:
          "Chủ đề mới đã được đề xuất. Bạn có thể chỉnh sửa hoặc sử dụng trực tiếp.",
        icon: <CheckCircleOutlined style={{ color: "#7951d4" }} />,
        placement: "topRight",
        duration: 3,
      });
    } catch (err: any) {
      const errorMsg =
        err.message || "An unknown error occurred while suggesting a topic.";
      setError(errorMsg);
      notification.error({
        message: "Lỗi khi gợi ý chủ đề",
        description: errorMsg,
        icon: <CloseCircleOutlined />,
        placement: "topRight",
        duration: 4,
      });
    } finally {
      setIsSuggestingTopic(false);
    }
  }, [topic, language, previousTopics]);

  const handleGenerate = useCallback(async (topicOverride?: string) => {
    if (isComplete) {
      handleReset();
      return;
    }

    // Sử dụng topicOverride nếu có, nếu không thì dùng topic từ state
    const topicToUse = topicOverride || topic;

    if (!topicToUse || topicToUse.trim() === "") {
      const errorMsg = "Vui lòng nhập chủ đề để bắt đầu.";
      setError(errorMsg);
      notification.warning({
        message: "Thiếu thông tin",
        description: errorMsg,
        icon: <InfoCircleOutlined style={{ color: "#f59e0b" }} />,
        placement: "topRight",
        duration: 3,
      });
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      let currentOutline = storyOutline;
      // Step 1: Generate outline if it doesn't exist
      if (currentPart === 0) {
        const newOutline = await geminiService.generateStoryOutline(
          topicToUse,
          numParts,
          language,
          enableClickbaitIntro,
          enableLogicAnalysis
        );
        setStoryOutline(newOutline);
        currentOutline = newOutline;
      }

      // Step 2: Generate the next part
      const nextPartNumber = currentPart + 1;
      const newPart = await geminiService.generateStoryPart(
        nextPartNumber,
        numParts,
        wordsPerPart,
        topicToUse,
        currentOutline,
        storyParts,
        language,
        enableClickbaitIntro,
        enableLogicAnalysis,
        enableVoice,
        enableMinimaxVoice
      );

      const updatedParts = [...storyParts, newPart];
      setStoryParts(updatedParts);
      setCurrentPart(nextPartNumber);

      // Update auto write progress
      if (isAutoWriting) {
        setAutoWriteProgress((prev) => {
          const maxStories = autoWriteConfig.maxStories || 0;
          const statusText = prev.storyNumber
            ? maxStories > 0
              ? `Story #${prev.storyNumber}/${maxStories} - Đang tạo phần ${nextPartNumber}/${numParts}`
              : `Story #${prev.storyNumber} - Đang tạo phần ${nextPartNumber}/${numParts}`
            : `Đang tạo phần ${nextPartNumber}/${numParts}`;
          
          return {
            current: nextPartNumber,
            total: numParts,
            status: statusText,
            storyNumber: prev.storyNumber,
          };
        });
      }

      // Thông báo khi tạo part thành công
      notification.success({
        message: `Đã tạo Phần ${nextPartNumber}/${numParts}`,
        description: `Phần ${nextPartNumber} của truyện đã được tạo thành công.`,
        icon: <CheckCircleOutlined style={{ color: "#7951d4" }} />,
        placement: "topRight",
        duration: 2,
      });

      // Step 3: If all parts are generated, get suggestions and save topic
      if (nextPartNumber === numParts) {
        const fullText = updatedParts
          .map((p) => `${p.title}\n\n${p.body}\n\n${p.endLine}`)
          .join("\n\n");
        const postGenSuggestions =
          await geminiService.generatePostGenerationSuggestions(
            fullText,
            topicToUse
          );
        setSuggestions(postGenSuggestions);
        addTopicToHistory(topicToUse);

        // Lưu vào lịch sử kịch bản (thay vì tự động tải về)
        // Trong auto loop mode, luôn lưu vào lịch sử
        // Ngoài auto loop mode, chỉ lưu nếu auto save được bật
        const autoSaveConfig = autoSaveService.getConfig();
        const shouldSaveToHistory = isAutoLooping || autoSaveConfig.enabled;
        
        // Lấy storyNumber hiện tại từ state (QUAN TRỌNG: phải lấy đúng)
        let currentStoryNumForSave: number | undefined = undefined;
        if (isAutoLooping) {
          // Ưu tiên lấy từ autoWriteProgress.storyNumber (đã được set trong quá trình generate)
          const stateStoryNum = autoWriteProgress.storyNumber;
          
          if (stateStoryNum && stateStoryNum > 0) {
            currentStoryNumForSave = stateStoryNum;
            console.log(`[Auto Loop] Using storyNumber from state: ${currentStoryNumForSave}`);
          } else {
            // Nếu state không có, thử lấy từ lịch sử (các story gần đây từ auto loop)
            const allHistory = storyHistoryService.getAll();
            const autoLoopStories = allHistory
              .filter(item => item.storyNumber !== undefined && item.storyNumber > 0)
              .sort((a, b) => b.createdAt - a.createdAt); // Sắp xếp theo thời gian tạo (mới nhất trước)
            
            if (autoLoopStories.length > 0) {
              // Lấy storyNumber lớn nhất từ các story gần đây
              const maxStoryNum = Math.max(...autoLoopStories.map(s => s.storyNumber || 0));
              currentStoryNumForSave = maxStoryNum;
              console.log(`[Auto Loop] Found storyNumber from history: ${currentStoryNumForSave}`);
            } else {
              // Nếu không có story nào trong history, có thể là story đầu tiên
              // Nhưng nếu đang trong loop, nên có storyNumber từ state
              // Nếu không có, set = 1 (story đầu tiên)
              currentStoryNumForSave = 1;
              console.log(`[Auto Loop] No history found, assuming first story: ${currentStoryNumForSave}`);
            }
          }
          
          // Đảm bảo currentStoryNumForSave > 0
          if (!currentStoryNumForSave || currentStoryNumForSave === 0) {
            console.warn(`[Auto Loop] ⚠️ Invalid storyNumber (${currentStoryNumForSave}), setting to 1`);
            currentStoryNumForSave = 1;
          }
        }
        
        // Lưu vào lịch sử và lấy storyNumber đã lưu để check
        let savedStoryNumber: number | undefined = undefined;
        if (shouldSaveToHistory) {
          try {
            // Đảm bảo currentStoryNumForSave được set đúng khi đang trong auto loop
            if (isAutoLooping && (!currentStoryNumForSave || currentStoryNumForSave === 0)) {
              console.warn(`[Auto Loop] ⚠️ currentStoryNumForSave is invalid (${currentStoryNumForSave}), attempting to fix...`);
              // Thử lấy từ state
              const stateStoryNum = autoWriteProgress.storyNumber;
              if (stateStoryNum && stateStoryNum > 0) {
                currentStoryNumForSave = stateStoryNum;
                console.log(`[Auto Loop] ✅ Fixed currentStoryNumForSave from state: ${currentStoryNumForSave}`);
              } else {
                // Thử lấy từ history
                const allHistory = storyHistoryService.getAll();
                const autoLoopStories = allHistory.filter(item => item.storyNumber !== undefined && item.storyNumber > 0);
                if (autoLoopStories.length > 0) {
                  const sortedStories = autoLoopStories.sort((a, b) => (b.storyNumber || 0) - (a.storyNumber || 0));
                  currentStoryNumForSave = (sortedStories[0].storyNumber || 0) + 1;
                  console.log(`[Auto Loop] ✅ Fixed currentStoryNumForSave from history: ${currentStoryNumForSave}`);
                } else {
                  currentStoryNumForSave = 1;
                  console.log(`[Auto Loop] ✅ Fixed currentStoryNumForSave to 1 (first story)`);
                }
              }
            }
            
            console.log(`[Auto Loop] 💾 Saving story with storyNumber: ${currentStoryNumForSave}`);
            // Lưu với storyNumber đã xác định
            const savedId = storyHistoryService.save(topicToUse, updatedParts, storyOutline, currentStoryNumForSave);
            
            // Lấy lại storyNumber từ item vừa lưu (để đảm bảo chính xác)
            const savedItem = storyHistoryService.getById(savedId);
            if (savedItem) {
              if (savedItem.storyNumber !== undefined && savedItem.storyNumber > 0) {
                savedStoryNumber = savedItem.storyNumber;
                console.log(`[Auto Loop] ✅ Saved story #${savedStoryNumber} to history (ID: ${savedId.substring(0, 8)}...)`);
              } else {
                savedStoryNumber = currentStoryNumForSave;
                console.warn(`[Auto Loop] ⚠️ Saved item has no storyNumber, using currentStoryNumForSave: ${savedStoryNumber}`);
              }
            } else {
              savedStoryNumber = currentStoryNumForSave;
              console.error(`[Auto Loop] ❌ Cannot find saved item with ID: ${savedId}`);
            }
            
            const historyCount = storyHistoryService.getCount();
            notification.success({
              message: isAutoLooping && savedStoryNumber
                ? `Đã lưu Story #${savedStoryNumber} vào lịch sử`
                : "Đã lưu kịch bản vào lịch sử",
              description: `Tổng cộng: ${historyCount} kịch bản đã lưu. Mở "Lịch sử Kịch bản" để xem và tải về.`,
              icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
              placement: "topRight",
              duration: 4,
            });
          } catch (error: any) {
            console.error("Failed to save to history:", error);
            notification.warning({
              message: "Không thể lưu vào lịch sử",
              description: error.message || "Đã xảy ra lỗi khi lưu vào lịch sử.",
              icon: <InfoCircleOutlined />,
              placement: "topRight",
              duration: 3,
            });
          }
        }

        // Nếu đang trong auto loop mode, tự động bắt đầu story mới
        if (isAutoLooping && autoWriteConfig.autoLoop) {
          const maxStories = autoWriteConfig.maxStories || 0; // 0 = vô hạn
          
          // Xác định storyNumber đã hoàn thành (QUAN TRỌNG: phải chính xác)
          let completedStoryNum: number = 0;
          
          // Ưu tiên 1: Lấy từ savedStoryNumber (vừa lưu vào history - đáng tin cậy nhất)
          if (savedStoryNumber !== undefined && savedStoryNumber > 0) {
            completedStoryNum = savedStoryNumber;
            console.log(`[Auto Loop Check] ✅ Using savedStoryNumber: ${completedStoryNum}`);
          } 
          // Ưu tiên 2: Lấy từ currentStoryNumForSave (đã xác định trước khi lưu)
          else if (currentStoryNumForSave !== undefined && currentStoryNumForSave > 0) {
            completedStoryNum = currentStoryNumForSave;
            console.log(`[Auto Loop Check] ✅ Using currentStoryNumForSave: ${completedStoryNum}`);
          }
          // Ưu tiên 3: Lấy từ autoWriteProgress.storyNumber (state hiện tại)
          else if (autoWriteProgress.storyNumber && autoWriteProgress.storyNumber > 0) {
            completedStoryNum = autoWriteProgress.storyNumber;
            console.log(`[Auto Loop Check] ✅ Using autoWriteProgress.storyNumber: ${completedStoryNum}`);
          }
          // Fallback: Lấy từ lịch sử (story có storyNumber lớn nhất)
          else {
            const allHistory = storyHistoryService.getAll();
            const autoLoopStories = allHistory.filter(item => item.storyNumber !== undefined && item.storyNumber > 0);
            if (autoLoopStories.length > 0) {
              const sortedStories = autoLoopStories.sort((a, b) => (b.storyNumber || 0) - (a.storyNumber || 0));
              completedStoryNum = sortedStories[0].storyNumber || 0;
              console.log(`[Auto Loop Check] ✅ Using storyNumber from history: ${completedStoryNum}`);
            }
          }
          
          // Đảm bảo completedStoryNum > 0
          if (completedStoryNum <= 0) {
            console.error(`[Auto Loop Check] ❌ ERROR: Invalid completedStoryNum (${completedStoryNum}), cannot continue`);
            // Nếu không thể xác định storyNumber, dừng để tránh lỗi
            setIsAutoLooping(false);
            setIsAutoWriting(false);
            setAutoWriteProgress({ current: 0, total: 0, status: "", storyNumber: undefined });
            setAutoContinue(false);
            setIsGenerating(false);
            notification.error({
              message: "Lỗi Auto Loop",
              description: "Không thể xác định số kịch bản đã tạo. Đã dừng auto loop.",
              icon: <CloseCircleOutlined />,
              placement: "topRight",
              duration: 5,
            });
            return;
          }
          
          console.log(`[Auto Loop Check] 📊 Story #${completedStoryNum} completed, maxStories: ${maxStories}`);
          console.log(`[Auto Loop Check] 📊 Debug: savedStoryNumber=${savedStoryNumber}, currentStoryNumForSave=${currentStoryNumForSave}, completedStoryNum=${completedStoryNum}`);
          
          // KIỂM TRA 1: Nếu maxStories > 0 và số story vừa hoàn thành >= maxStories, dừng NGAY
          if (maxStories > 0 && completedStoryNum >= maxStories) {
            console.log(`[Auto Loop] ⛔⛔⛔ STOPPING: ${completedStoryNum} >= ${maxStories} (REACHED MAX STORIES - CHECK 1)`);
            // Đã đạt số kịch bản tối đa, dừng auto loop
            setIsAutoLooping(false);
            setIsAutoWriting(false);
            setAutoWriteProgress({ current: 0, total: 0, status: "", storyNumber: undefined });
            setAutoContinue(false);
            setIsGenerating(false);
            notification.success({
              message: "🎉 Hoàn thành Auto Loop!",
              description: `Đã tạo xong ${maxStories} kịch bản như đã cấu hình.`,
              icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
              placement: "topRight",
              duration: 5,
            });
            return; // DỪNG NGAY, KHÔNG TIẾP TỤC
          }
          
          // Tính storyNumber tiếp theo: story vừa hoàn thành + 1
          const nextStoryNumber = completedStoryNum + 1;
          
          console.log(`[Auto Loop] 📊 Next story would be #${nextStoryNumber}, maxStories: ${maxStories}`);
          
          // KIỂM TRA 2: Nếu story tiếp theo vượt quá maxStories, dừng NGAY (trước khi bắt đầu story mới)
          if (maxStories > 0 && nextStoryNumber > maxStories) {
            console.log(`[Auto Loop] ⛔⛔⛔ STOPPING: ${nextStoryNumber} > ${maxStories} (NEXT STORY EXCEEDS LIMIT - CHECK 2)`);
            setIsAutoLooping(false);
            setIsAutoWriting(false);
            setAutoWriteProgress({ current: 0, total: 0, status: "", storyNumber: undefined });
            setAutoContinue(false);
            setIsGenerating(false);
            notification.success({
              message: "🎉 Hoàn thành Auto Loop!",
              description: `Đã tạo xong ${maxStories} kịch bản như đã cấu hình.`,
              icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
              placement: "topRight",
              duration: 5,
            });
            return; // DỪNG NGAY, KHÔNG TIẾP TỤC
          }
          
          // Đợi một chút trước khi bắt đầu story mới (chỉ khi chưa dừng)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Reset state để bắt đầu story mới
          setStoryParts([]);
          setStoryOutline("");
          setCurrentPart(0);
          setSuggestions(null);
          setError(null);
          
          // Tính số story còn lại
          const remainingStories = maxStories > 0 ? maxStories - nextStoryNumber : -1;
          const statusText = maxStories > 0 
            ? `Story #${nextStoryNumber}/${maxStories} - Đang gợi ý topic...`
            : `Story #${nextStoryNumber} - Đang gợi ý topic...`;
          
          setAutoWriteProgress({
            current: 0,
            total: numParts,
            status: statusText,
            storyNumber: nextStoryNumber,
          });
          
          const notificationDesc = maxStories > 0
            ? `Đang gợi ý chủ đề mới... (Còn ${remainingStories} kịch bản)`
            : "Đang gợi ý chủ đề mới...";
          
          notification.info({
            message: `Đang bắt đầu Story #${nextStoryNumber}${maxStories > 0 ? `/${maxStories}` : ''}`,
            description: notificationDesc,
            icon: <InfoCircleOutlined style={{ color: "#7951d4" }} />,
            placement: "topRight",
            duration: 2,
          });
          
          // Gợi ý topic mới và bắt đầu story mới
          try {
            const newTopic = await geminiService.analyzeAndSuggestTopic(
              "",
              language,
              previousTopics
            );
            setTopic(newTopic);
            
            // Update progress với topic mới (đảm bảo storyNumber được set đúng)
            setAutoWriteProgress({
              current: 0,
              total: numParts,
              status: maxStories > 0
                ? `Story #${nextStoryNumber}/${maxStories} - Đang tạo outline...`
                : `Story #${nextStoryNumber} - Đang tạo outline...`,
              storyNumber: nextStoryNumber,
            });
            
            // Bắt đầu generate story mới
            setAutoContinue(true);
            // Gọi handleGenerate với topic mới
            // Await để đảm bảo nó bắt đầu trước khi return
            // Nhưng không cần đợi nó hoàn thành vì sẽ được xử lý bởi auto continue effect
            setIsGenerating(true); // Set lại isGenerating = true để tiếp tục
            handleGenerate(newTopic);
            
            // Return ngay để không reset auto write state và không hiển thị thông báo hoàn thành
            // handleGenerate sẽ được xử lý async
            return;
          } catch (error: any) {
            console.error("Failed to suggest new topic:", error);
            // Nếu không thể gợi ý topic, dừng auto loop
            setIsAutoLooping(false);
            setIsAutoWriting(false);
            setAutoWriteProgress({ current: 0, total: 0, status: "" });
            setAutoContinue(false);
            setIsGenerating(false);
            notification.error({
              message: "Không thể gợi ý topic mới",
              description: "Đã dừng auto loop.",
              icon: <CloseCircleOutlined />,
              placement: "topRight",
              duration: 4,
            });
            return;
          }
        }

        // Reset auto write state (chỉ khi không trong auto loop)
        setIsAutoWriting(false);
        setAutoWriteProgress({ current: 0, total: 0, status: "" });
        setAutoContinue(false);

        // Thông báo khi hoàn thành tất cả parts
        notification.success({
          message: "🎉 Hoàn thành!",
          description: `Đã tạo xong ${numParts} phần truyện. Bạn có thể xem gợi ý và công cụ SEO bên dưới.`,
          icon: <CheckCircleOutlined style={{ color: "#7951d4" }} />,
          placement: "topRight",
          duration: 5,
        });
      }
    } catch (err: any) {
      const errorMsg = err.message || "An error occurred during generation.";
      setError(errorMsg);
      // Nếu đang trong auto loop, dừng loop khi có lỗi
      if (isAutoLooping) {
        setIsAutoLooping(false);
      }
      setIsAutoWriting(false);
      setAutoWriteProgress({ current: 0, total: 0, status: "" });
      setAutoContinue(false);
      notification.error({
        message: "Lỗi khi tạo truyện",
        description: errorMsg,
        icon: <CloseCircleOutlined />,
        placement: "topRight",
        duration: 5,
      });
    } finally {
      // Chỉ set isGenerating = false nếu không đang trong auto loop mode
      // Hoặc nếu đang trong auto loop nhưng không đang chuyển sang story mới
      if (!isAutoLooping || !autoWriteConfig.autoLoop) {
      setIsGenerating(false);
      }
      // Nếu đang trong auto loop, isGenerating sẽ được set lại = true khi bắt đầu story mới
    }
  }, [
    topic,
    numParts,
    wordsPerPart,
    language,
    enableClickbaitIntro,
    enableLogicAnalysis,
    enableVoice,
    enableMinimaxVoice,
    storyOutline,
    currentPart,
    storyParts,
    isComplete,
    handleReset,
    addTopicToHistory,
    isAutoWriting,
    isAutoLooping,
    autoWriteConfig,
  ]);

  // Stop Auto Loop
  const handleStopAutoLoop = useCallback(() => {
    setIsAutoLooping(false);
    setIsAutoWriting(false);
    setAutoWriteProgress({ current: 0, total: 0, status: "" });
    setAutoContinue(false);
    notification.info({
      message: "Đã dừng Auto Loop",
      description: "Auto loop đã được dừng. Bạn có thể tiếp tục thủ công.",
      icon: <InfoCircleOutlined style={{ color: "#7951d4" }} />,
      placement: "topRight",
      duration: 3,
    });
  }, []);

  // Auto Write Mode: Tự động gợi ý topic và viết tất cả parts
  const handleAutoWrite = useCallback(async (isLoopMode: boolean = false) => {
    if (isAutoWriting || isGenerating) {
      return;
    }

    // Nếu là loop mode, set isAutoLooping
    if (isLoopMode || autoWriteConfig.autoLoop) {
      setIsAutoLooping(true);
    }

    setIsAutoWriting(true);
    // Nếu là loop mode, set storyNumber
    // - Nếu đây là lần đầu (chưa có storyNumber), set = 1
    // - Nếu đã có storyNumber (đang trong loop), giữ nguyên
    let storyNumber: number | undefined = undefined;
    if (isLoopMode || autoWriteConfig.autoLoop) {
      const maxStories = autoWriteConfig.maxStories || 0;
      
      // Xác định storyNumber: ưu tiên từ state, sau đó từ history, cuối cùng là 1
      if (autoWriteProgress.storyNumber && autoWriteProgress.storyNumber > 0) {
        storyNumber = autoWriteProgress.storyNumber;
      } else {
        // Thử lấy từ history (story có storyNumber lớn nhất)
        const allHistory = storyHistoryService.getAll();
        const autoLoopStories = allHistory.filter(item => item.storyNumber !== undefined && item.storyNumber > 0);
        if (autoLoopStories.length > 0) {
          const sortedStories = autoLoopStories.sort((a, b) => (b.storyNumber || 0) - (a.storyNumber || 0));
          const lastStoryNum = sortedStories[0].storyNumber || 0;
          storyNumber = lastStoryNum + 1; // Story tiếp theo
          console.log(`[Auto Write] Found last story #${lastStoryNum} in history, starting story #${storyNumber}`);
        } else {
          // Lần đầu tiên, bắt đầu từ 1
          storyNumber = 1;
          console.log(`[Auto Write] First story, starting from #1`);
        }
      }
      
      // ✅ KIỂM TRA QUAN TRỌNG: Nếu storyNumber vượt quá maxStories, dừng NGAY
      if (maxStories > 0 && storyNumber > maxStories) {
        console.log(`[Auto Write] ⛔⛔⛔ STOPPING: storyNumber ${storyNumber} > maxStories ${maxStories} (BEFORE STARTING NEW STORY)`);
        setIsAutoLooping(false);
        setIsAutoWriting(false);
        setAutoWriteProgress({ current: 0, total: 0, status: "", storyNumber: undefined });
        setAutoContinue(false);
        setIsGenerating(false);
        notification.success({
          message: "🎉 Hoàn thành Auto Loop!",
          description: `Đã tạo xong ${maxStories} kịch bản như đã cấu hình.`,
          icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
          placement: "topRight",
          duration: 5,
        });
        return; // DỪNG NGAY, KHÔNG BẮT ĐẦU STORY MỚI
      }
      
      // ✅ KIỂM TRA 2: Nếu storyNumber = maxStories, đây là story cuối cùng
      if (maxStories > 0 && storyNumber === maxStories) {
        console.log(`[Auto Write] 📌 This is the last story: #${storyNumber}/${maxStories}`);
      }
    }
    
    setAutoWriteProgress({
      current: 0,
      total: numParts,
      status: storyNumber
        ? `Story #${storyNumber}${autoWriteConfig.maxStories && autoWriteConfig.maxStories > 0 ? `/${autoWriteConfig.maxStories}` : ''} - Đang khởi tạo...`
        : "Đang khởi tạo...",
      storyNumber: storyNumber,
    });
    setError(null);

    try {
      // Step 1: Auto suggest topic 
      // - Luôn tự động gợi ý nếu auto suggest topic được bật
      // - Luôn tự động gợi ý nếu auto loop mode được bật (vì cần topic mới cho mỗi story)
      let currentTopic = topic.trim();
      const shouldAutoSuggest = 
        autoWriteConfig.autoSuggestTopic || 
        isLoopMode || 
        autoWriteConfig.autoLoop ||
        (autoWriteConfig.enabled && !currentTopic); // Nếu auto write enabled và topic trống, tự động gợi ý
      
      if (shouldAutoSuggest && !currentTopic) {
        const maxStoriesForSuggest = autoWriteConfig.maxStories || 0;
        const suggestStatusText = isLoopMode && storyNumber
          ? maxStoriesForSuggest > 0
            ? `Story #${storyNumber}/${maxStoriesForSuggest} - Đang gợi ý topic...`
            : `Story #${storyNumber} - Đang gợi ý topic...`
          : "Đang gợi ý topic...";
        
        setAutoWriteProgress({
          current: 0,
          total: numParts,
          status: suggestStatusText,
          storyNumber: isLoopMode ? storyNumber : undefined,
        });
        setIsSuggestingTopic(true);
        try {
          const suggestedTopic = await geminiService.analyzeAndSuggestTopic(
            "",
            language,
            previousTopics
          );
          currentTopic = suggestedTopic.trim();
          setTopic(currentTopic);
          const maxStoriesForNotification = autoWriteConfig.maxStories || 0;
          const notificationMessage = isLoopMode && storyNumber
            ? maxStoriesForNotification > 0
              ? `Story #${storyNumber}/${maxStoriesForNotification} - Đã gợi ý topic`
              : `Story #${storyNumber} - Đã gợi ý topic`
            : "Đã gợi ý topic";
          
          notification.info({
            message: notificationMessage,
            description: `Topic: "${currentTopic}"`,
            icon: <InfoCircleOutlined style={{ color: "#7951d4" }} />,
            placement: "topRight",
            duration: 2,
          });
        } catch (error: any) {
          console.error("Failed to suggest topic:", error);
          // Trong loop mode, nếu không thể gợi ý topic, dừng loop
          if (isLoopMode || autoWriteConfig.autoLoop) {
            setIsAutoLooping(false);
            setIsAutoWriting(false);
            setAutoWriteProgress({ current: 0, total: 0, status: "" });
            setIsSuggestingTopic(false);
            notification.error({
              message: "Không thể gợi ý topic",
              description: "Đã dừng auto loop.",
              icon: <CloseCircleOutlined />,
              placement: "topRight",
              duration: 4,
            });
            return;
          } else {
            notification.warning({
              message: "Không thể gợi ý topic",
              description: "Vui lòng nhập topic thủ công.",
              icon: <InfoCircleOutlined />,
              placement: "topRight",
              duration: 4,
            });
            setIsAutoWriting(false);
            setAutoWriteProgress({ current: 0, total: 0, status: "" });
            setIsSuggestingTopic(false);
            return;
          }
        } finally {
          setIsSuggestingTopic(false);
        }
      }

      if (!currentTopic) {
        setIsAutoWriting(false);
        setIsAutoLooping(false);
        setAutoWriteProgress({ current: 0, total: 0, status: "" });
        notification.warning({
          message: "Topic không thể trống",
          description: "Vui lòng nhập topic hoặc bật auto suggest topic.",
          icon: <InfoCircleOutlined />,
          placement: "topRight",
          duration: 4,
        });
        return;
      }

      // Step 2: Reset và bắt đầu generate từ đầu
      setStoryParts([]);
      setStoryOutline("");
      setCurrentPart(0);
      setSuggestions(null);
      setError(null);

      // Step 3: Enable auto continue để tự động viết tất cả parts
      setAutoContinue(true);

      // Step 4: Bắt đầu generate part đầu tiên với topic đã được đảm bảo
      const maxStoriesForProgress = autoWriteConfig.maxStories || 0;
      const progressStatusText = isLoopMode && storyNumber
        ? maxStoriesForProgress > 0
          ? `Story #${storyNumber}/${maxStoriesForProgress} - Đang tạo outline và part 1...`
          : `Story #${storyNumber} - Đang tạo outline và part 1...`
        : "Đang tạo outline và part 1...";
      
      setAutoWriteProgress({
        current: 0,
        total: numParts,
        status: progressStatusText,
        storyNumber: storyNumber,
      });
      await handleGenerate(currentTopic);
      
    } catch (error: any) {
      const errorMsg = error.message || "An error occurred during auto write.";
      setError(errorMsg);
      setIsAutoWriting(false);
      setIsAutoLooping(false);
      setAutoWriteProgress({ current: 0, total: 0, status: "" });
      setAutoContinue(false);
      notification.error({
        message: "Lỗi khi tự động viết",
        description: errorMsg,
        icon: <CloseCircleOutlined />,
        placement: "topRight",
        duration: 5,
      });
    }
  }, [
    topic,
    numParts,
    language,
    previousTopics,
    autoWriteConfig,
    isAutoWriting,
    isGenerating,
    handleGenerate,
    autoWriteProgress.storyNumber,
  ]);

  // Auto Continue Effect: Tự động viết tiếp khi auto continue được bật
  useEffect(() => {
    // Don't run if the story is complete, a generation is already in progress, or auto-continue is off
    if (isComplete || isGenerating || !autoContinue) {
      if (isComplete && autoContinue) {
        // Tắt auto continue khi hoàn thành
        setAutoContinue(false);
      }
      return;
    }

    // Delay giữa các parts nếu đang auto writing
    const delay = isAutoWriting && autoWriteConfig.enabled 
      ? autoWriteConfig.delayBetweenParts 
      : 1000; // Default delay 1s for manual auto continue

    // If auto-continue is on and the story has started, generate the next part
    // Điều kiện: đã có ít nhất 1 part, chưa đủ số part, và số parts hiện tại bằng currentPart (đảm bảo part vừa được tạo xong)
    if (currentPart > 0 && currentPart < numParts && storyParts.length === currentPart) {
      const timer = setTimeout(() => {
        // Sử dụng topic từ state (đã được update trong handleAutoWrite)
      handleGenerate();
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [
    storyParts,
    autoContinue,
    isGenerating,
    isComplete,
    currentPart,
    numParts,
    handleGenerate,
    isAutoWriting,
    autoWriteConfig.enabled,
    autoWriteConfig.delayBetweenParts,
  ]);


  return (
    <div
      style={{
        backgroundColor: "#F9F9FB",
        backgroundImage:
          "radial-gradient(at 0% 0%, rgba(121, 81, 212, 0.05) 0%, transparent 50%), radial-gradient(at 100% 100%, rgba(166, 138, 240, 0.05) 0%, transparent 50%)",
        color: "#1a1a1a",
        minHeight: "100vh",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 16px" }}>
        <header
          style={{
            textAlign: "center",
            marginBottom: 48,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              display: "flex",
              gap: 8,
            }}
          >
            <Button
              icon={<SettingOutlined />}
              onClick={() => setIsAutoWriteSettingsOpen(true)}
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "#E5E5E5",
                color: "#7951d4",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
              }}
            >
              <span className="hidden sm:inline">Auto Write</span>
            </Button>
            <Button
              icon={<KeyOutlined />}
              onClick={() => setIsApiKeyModalOpen(true)}
              style={{
              backgroundColor: "#FFFFFF",
              borderColor: "#E5E5E5",
              color: "#7951d4",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            }}
          >
            <span className="hidden sm:inline">API Keys</span>
          </Button>
            <Button
              icon={<FileTextOutlined />}
              onClick={() => setIsStoryHistoryModalOpen(true)}
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "#E5E5E5",
                color: "#7951d4",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
              }}
            >
              <span className="hidden sm:inline">Kịch bản ({storyHistoryService.getCount()})</span>
            </Button>
          </div>
          <h1
            style={{
              fontSize: "3rem",
              fontWeight: 800,
              background:
                "linear-gradient(135deg, #6A3ED9 0%, #7951d4 50%, #A68AF0 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginBottom: 8,
            }}
          >
            Viral Story Script Generator
          </h1>
          <p
            style={{
              color: "#4a4a4a",
              marginTop: 8,
              fontSize: "1.125rem",
              fontWeight: 400,
            }}
          >
            Tạo kịch bản viral theo phong cách "Business Betrayal" với sức mạnh
            của AI.
          </p>
        </header>

        <main
          className="grid gap-6"
          style={{
            gridTemplateColumns: "minmax(280px, 30%) 1fr",
          }}
        >
          <style>{`
                        @media (max-width: 1024px) {
                            main.grid {
                                grid-template-columns: 1fr !important;
                            }
                        }
                    `}</style>
          <aside>
            <Controls
              topic={topic}
              setTopic={setTopic}
              numParts={numParts}
              setNumParts={setNumParts}
              wordsPerPart={wordsPerPart}
              setWordsPerPart={setWordsPerPart}
              language={language}
              setLanguage={setLanguage}
              enableVoice={enableVoice}
              setEnableVoice={handleSetEnableVoice}
              enableMinimaxVoice={enableMinimaxVoice}
              setEnableMinimaxVoice={handleSetEnableMinimaxVoice}
              enableClickbaitIntro={enableClickbaitIntro}
              setEnableClickbaitIntro={setEnableClickbaitIntro}
              enableLogicAnalysis={enableLogicAnalysis}
              setEnableLogicAnalysis={setEnableLogicAnalysis}
              autoContinue={autoContinue}
              setAutoContinue={setAutoContinue}
              isLoading={isLoading}
              isGenerating={isGenerating}
              isComplete={isComplete}
              onGenerate={() => {
                // Nếu auto write mode enabled, sử dụng handleAutoWrite
                if (autoWriteConfig.enabled && currentPart === 0) {
                  // Nếu auto loop được bật, bắt đầu loop mode
                  handleAutoWrite(autoWriteConfig.autoLoop);
                } else {
                  handleGenerate();
                }
              }}
              isAutoLooping={isAutoLooping}
              onStopAutoLoop={handleStopAutoLoop}
              onReset={handleReset}
              currentPart={currentPart}
              totalParts={numParts}
              isSuggestingTopic={isSuggestingTopic}
              onSuggestTopic={handleSuggestTopic}
              previousTopics={previousTopics}
              onClearHistory={clearTopicHistory}
              onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
              autoWriteConfig={autoWriteConfig}
              isAutoWriting={isAutoWriting}
              autoWriteProgress={autoWriteProgress}
            />
          </aside>

          <section>
            {error && (
              <Alert
                message="Lỗi!"
                description={error}
                type="error"
                showIcon
                closable
                onClose={() => setError(null)}
                style={{ marginBottom: 24 }}
              />
            )}

            {storyParts.length === 0 && !isLoading && (
              <Empty
                image={
                  <BookOutlined style={{ fontSize: 64, color: "#A68AF0" }} />
                }
                imageStyle={{ height: 96 }}
                description={
                  <div>
                    <h3
                      style={{
                        fontSize: "20px",
                        fontWeight: 500,
                        color: "#4C3D8F",
                        marginBottom: 8,
                      }}
                    >
                      Câu chuyện của bạn đang chờ...
                    </h3>
                    <p style={{ color: "#6b6b6b", lineHeight: 1.6 }}>
                      Sử dụng bảng điều khiển bên trái để cấu hình và tạo phần
                      đầu tiên cho kịch bản của bạn.
                    </p>
                  </div>
                }
                style={{
                  padding: "48px 24px",
                  backgroundColor: "#FFFFFF",
                  borderRadius: 16,
                  border: "1px solid #E8E1FB",
                  boxShadow: "0 1px 6px rgba(0, 0, 0, 0.06)",
                }}
              />
            )}

            {/* Auto Write Progress */}
            {isAutoWriting && autoWriteProgress.total > 0 && (
              <Alert
                message={
                  isAutoLooping
                    ? `🔄 Auto Loop Mode - Story #${autoWriteProgress.storyNumber || 1}${
                        autoWriteConfig.maxStories && autoWriteConfig.maxStories > 0
                          ? `/${autoWriteConfig.maxStories}`
                          : ''
                      }`
                    : "🤖 Auto Write Mode"
                }
                description={
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      {autoWriteProgress.status || "Đang xử lý..."}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          backgroundColor: "#f0f0f0",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${
                              (autoWriteProgress.current / autoWriteProgress.total) * 100
                            }%`,
                            height: "100%",
                            backgroundColor: isAutoLooping ? "#FFA940" : "#7951d4",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, color: "#8c8c8c" }}>
                        {autoWriteProgress.current}/{autoWriteProgress.total}
                      </span>
                    </div>
                    {isAutoLooping && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#8c8c8c" }}>
                        {autoWriteConfig.maxStories && autoWriteConfig.maxStories > 0 ? (
                          <>
                            Đã tạo: {autoWriteProgress.storyNumber || 0}/{autoWriteConfig.maxStories} kịch bản.
                            {" "}Nhấn "Dừng Auto Loop" để dừng bất cứ lúc nào.
                          </>
                        ) : (
                          <>
                            ⚠️ Đang tự động tạo nhiều stories (vô hạn). Nhấn "Dừng Auto Loop" để dừng.
                          </>
                        )}
                      </div>
                    )}
                  </div>
                }
                type={isAutoLooping ? "warning" : "info"}
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}

            {(storyParts.length > 0 || isLoading) && (
              <Spin
                indicator={
                  (
                    <ImSpinner3
                      className="animate-spin !ml-4"
                      style={{ fontSize: 24, color: "#7951d4" }}
                    />
                  ) as React.ReactNode
                }
                spinning={isLoading}
                tip={
                  isAutoWriting && autoWriteProgress.status
                    ? autoWriteProgress.status
                    : "Đang tạo nội dung..."
                }
                style={{
                  backgroundColor: "#FFFFFF",
                  padding: "24px 32px",
                  borderRadius: 16,
                  border: "1px solid #E9E6F8",
                  boxShadow: "0 1px 6px rgba(0, 0, 0, 0.06)",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    padding: "24px 32px",
                    borderRadius: 16,
                    border: "1px solid #E9E6F8",
                    boxShadow: "0 1px 6px rgba(0, 0, 0, 0.06)",
                  }}
                >
                  {isLoading && storyParts.length === 0 ? (
                    <Skeleton active paragraph={{ rows: 8 }} />
                  ) : (
                    <>
                      <StoryDisplay
                        storyParts={storyParts}
                        totalParts={numParts}
                      />

                      {isComplete && suggestions && (
                        <>
                          <PostGenerationSuggestions
                            suggestions={suggestions}
                          />
                          <ExportAndSeoTools
                            fullStoryText={fullStoryText}
                            topic={topic}
                            language={language}
                          />
                        </>
                      )}
                    </>
                  )}
                </div>
              </Spin>
            )}
          </section>
        </main>
      </div>

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        previousTopics={previousTopics}
        onSelectTopic={setTopic}
        onClearHistory={clearTopicHistory}
        onDeleteTopic={deleteTopic}
        isLoading={isLoading}
      />

      <AutoWriteSettings
        isOpen={isAutoWriteSettingsOpen}
        onClose={() => setIsAutoWriteSettingsOpen(false)}
        autoWriteConfig={autoWriteConfig}
        onAutoWriteConfigChange={setAutoWriteConfig}
      />

      <StoryHistoryModal
        isOpen={isStoryHistoryModalOpen}
        onClose={() => setIsStoryHistoryModalOpen(false)}
      />
    </div>
  );
};

export default App;
