import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Alert, Skeleton, Spin, Button, Empty, notification } from "antd";
import {
  KeyOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { Controls } from "./components/Controls";
import { StoryDisplay } from "./components/StoryDisplay";
import { PostGenerationSuggestions } from "./components/PostGenerationSuggestions";
import { ExportAndSeoTools } from "./components/ExportAndSeoTools";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { HistoryModal } from "./components/HistoryModal";
import * as geminiService from "./services/geminiService";
import { apiKeyManager } from "./services/apiKeyManager";
import type { Language, StoryPart, Suggestions } from "./types";
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
  }, []);

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

  const handleGenerate = useCallback(async () => {
    if (isComplete) {
      handleReset();
      return;
    }

    if (topic.trim() === "") {
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
          topic,
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
        topic,
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
            topic
          );
        setSuggestions(postGenSuggestions);
        addTopicToHistory(topic);

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
      notification.error({
        message: "Lỗi khi tạo truyện",
        description: errorMsg,
        icon: <CloseCircleOutlined />,
        placement: "topRight",
        duration: 5,
      });
    } finally {
      setIsGenerating(false);
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
  ]);

  useEffect(() => {
    // Don't run if the story is complete, a generation is already in progress, or auto-continue is off
    if (isComplete || isGenerating || !autoContinue) {
      return;
    }

    // If auto-continue is on and the story has started, generate the next part
    if (currentPart > 0 && currentPart < numParts) {
      handleGenerate();
    }
  }, [
    storyParts,
    autoContinue,
    isGenerating,
    isComplete,
    currentPart,
    numParts,
    handleGenerate,
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
          <Button
            icon={<KeyOutlined />}
            onClick={() => setIsApiKeyModalOpen(true)}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              backgroundColor: "#FFFFFF",
              borderColor: "#E5E5E5",
              color: "#7951d4",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            }}
          >
            <span className="hidden sm:inline">API Keys</span>
          </Button>
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
              onGenerate={handleGenerate}
              onReset={handleReset}
              currentPart={currentPart}
              totalParts={numParts}
              isSuggestingTopic={isSuggestingTopic}
              onSuggestTopic={handleSuggestTopic}
              previousTopics={previousTopics}
              onClearHistory={clearTopicHistory}
              onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
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
                tip="Đang tạo nội dung..."
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
    </div>
  );
};

export default App;
