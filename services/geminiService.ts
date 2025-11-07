import { GoogleGenAI, Type, GenerateContentResponse, GenerateContentParameters } from "@google/genai";
import type { StoryPart, Language, Suggestions, SeoContentType } from '../types';
import { apiKeyManager } from './apiKeyManager';

const primaryModel = 'gemini-2.5-pro';
const fallbackModel = 'gemini-2.5-flash';

// Helper function to robustly extract JSON from a string that might be wrapped in markdown.
function extractJsonFromText(text: string): string {
    const jsonMatch = text.match(/```(json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[2]) {
        return jsonMatch[2].trim();
    }
    return text.trim();
}

/**
 * Kiểm tra xem lỗi có phải là lỗi quota/pro không
 */
function isQuotaError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code || error.status || '';
    const errorString = String(error).toLowerCase();
    
    // Các pattern phổ biến cho lỗi quota/pro
    const quotaPatterns = [
        'quota',
        'rate limit',
        'resource exhausted',
        '429',
        'insufficient quota',
        'billing',
        'payment required',
        '403',
        'permission denied',
        'api key not valid',
        'invalid api key',
        'api key expired',
        'quota exceeded',
        'quota limit',
        'usage limit',
        'limit exceeded'
    ];
    
    return quotaPatterns.some(pattern => 
        errorMessage.includes(pattern) || 
        errorString.includes(pattern) ||
        String(errorCode).includes(pattern)
    );
}

/**
 * Tạo instance GoogleGenAI với API key hiện tại
 */
function createAiInstance(): GoogleGenAI {
    apiKeyManager.initialize();
    const apiKey = apiKeyManager.getCurrentKey();
    
    if (!apiKey) {
        throw new Error('Không có API key nào được cấu hình. Vui lòng thêm API key trong cài đặt.');
    }
    
    return new GoogleGenAI({ apiKey });
}

/**
 * Helper function to try the primary model and fallback to a secondary one on error.
 * Tự động xoay API key khi gặp lỗi quota/pro.
 */
async function generateWithFallback(params: Omit<GenerateContentParameters, 'model'>): Promise<GenerateContentResponse> {
    const maxRetries = 3; // Số lần thử tối đa với các API keys khác nhau
    let lastError: any = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const ai = createAiInstance();
            
            // Thử với primary model trước
            try {
                const response = await ai.models.generateContent({
                    ...params,
                    model: primaryModel,
                });
                return response;
            } catch (primaryError: any) {
                // Nếu lỗi là quota error, đánh dấu key hiện tại và thử key khác
                if (isQuotaError(primaryError)) {
                    console.warn(`API key hiện tại hết quota/pro. Đang thử API key khác...`, primaryError);
                    apiKeyManager.markCurrentKeyExhausted(primaryError.message || 'Quota exhausted');
                    
                    // Nếu còn key khác, thử lại
                    if (apiKeyManager.hasAvailableKey() && attempt < maxRetries - 1) {
                        continue;
                    }
                    
                    // Nếu tất cả keys đã exhausted, chuyển sang flash model
                    console.warn(`Tất cả API keys đã hết quota/pro. Chuyển sang model Flash.`);
                    const response = await ai.models.generateContent({
                        ...params,
                        model: fallbackModel,
                    });
                    return response;
                }
                
                // Nếu không phải lỗi quota, thử fallback model
                console.warn(
                    `Primary model '${primaryModel}' failed. Retrying with fallback '${fallbackModel}'.`,
                    primaryError
                );
                const response = await ai.models.generateContent({
                    ...params,
                    model: fallbackModel,
                });
                return response;
            }
        } catch (error: any) {
            lastError = error;
            
            // Nếu lỗi là quota error, đánh dấu và thử key khác
            if (isQuotaError(error)) {
                console.warn(`API key hiện tại hết quota/pro. Đang thử API key khác...`, error);
                apiKeyManager.markCurrentKeyExhausted(error.message || 'Quota exhausted');
                
                // Nếu còn key khác, thử lại
                if (apiKeyManager.hasAvailableKey() && attempt < maxRetries - 1) {
                    continue;
                }
                
                // Nếu tất cả keys đã exhausted, chuyển sang flash model với key cuối cùng
                if (apiKeyManager.areAllKeysExhausted()) {
                    console.warn(`Tất cả API keys đã hết quota/pro. Chuyển sang model Flash.`);
                    try {
                        const ai = createAiInstance();
                        const response = await ai.models.generateContent({
                            ...params,
                            model: fallbackModel,
                        });
                        return response;
                    } catch (flashError: any) {
                        throw new Error(`Tất cả API keys đã hết quota và không thể sử dụng Flash model: ${flashError.message}`);
                    }
                }
            }
            
            // Nếu không phải lỗi quota hoặc đã hết lần thử, throw error
            if (attempt === maxRetries - 1) {
                throw error;
            }
        }
    }
    
    // Nếu đến đây nghĩa là đã hết lần thử
    throw lastError || new Error('Không thể tạo nội dung sau nhiều lần thử.');
}

const storyPartSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "The title of this part of the story, e.g., 'The Meeting That Changed Everything'. Should be cinematic and engaging."
    },
    body: {
      type: Type.STRING,
      description: "The main narrative content of this story part, around 450-500 words. It should be written in a cinematic, first-person style, focusing on conflict, betrayal, and business lessons."
    },
    endLine: {
      type: Type.STRING,
      description: "A short, impactful cliffhanger or a reflective thought to lead into the next part of the story."
    },
  },
  required: ['title', 'body', 'endLine'],
};

export async function analyzeAndSuggestTopic(
    currentTopic: string,
    language: Language,
    previousTopics: string[]
): Promise<string> {
    const prompt = `
    You are a viral YouTube content strategist specializing in the "Business Betrayal" and "Startup Drama" niche. Your goal is to identify and craft topics with the highest potential for views and engagement.
    The target audience is interested in stories of conflict, high stakes, and valuable lessons.
    The desired output language is ${language}.

    **Task:**

    ${
      currentTopic.trim() !== ''
        ? `Analyze the following topic idea: "${currentTopic}"
           - Evaluate its viral potential. Is it dramatic enough? Is the conflict clear?
           - If the topic is strong, refine it to be even more compelling and click-worthy.
           - If the topic is weak, briefly explain why and provide a new, much stronger topic suggestion that has high viral potential.`
        : `Generate a new, original topic idea for a "Business Betrayal" story. The topic must be highly engaging, contain clear conflict, and have significant viral potential.`
    }

    ${previousTopics.length > 0 ? `
    **CRITICAL REQUIREMENT: Avoid Repetition**
    Do NOT generate a topic that is the same as or substantively similar to any of the following previously used topics. Create something new and original.
    Previously Used Topics:
    - "${previousTopics.join('"\n- "')}"
    ` : ''}

    **Response:**
    Respond ONLY with the final, suggested topic text. Do not include your analysis or any other explanations. Just the topic itself.
    `;

    const response = await generateWithFallback({
        contents: prompt
    });

    return response.text.trim();
}


export async function generateStoryOutline(
  topic: string,
  numParts: number,
  language: Language,
  clickbait: boolean,
  logic: boolean
): Promise<string> {
    const prompt = `
    Based on the topic "${topic}", create a high-level story outline for a ${numParts}-part YouTube script in the "Business Betrayal" genre.
    The story must be told from a first-person perspective ("I").
    The outline should include:
    1. A strong hook or inciting incident.
    2. Rising action detailing the growing conflict or suspicion.
    3. A clear climax where the betrayal is revealed.
    4. Falling action showing the immediate aftermath and consequences.
    5. A resolution where the narrator finds a new path or learns a crucial business lesson.

    ${logic ? 'Ensure the plot points are logical and the character motivations are believable for a business/startup context.' : ''}
    The target language for the story is ${language}.
    Provide the outline as a concise, easy-to-follow list of key events for each part. Do not write the full story.
    `;
    
    const response = await generateWithFallback({
      contents: prompt
    });
    
    return response.text;
}

export async function generateStoryPart(
  partNumber: number,
  totalParts: number,
  wordsPerPart: number,
  topic: string,
  outline: string,
  previousParts: StoryPart[],
  language: Language,
  clickbait: boolean,
  logic: boolean,
  enableVoice: boolean,
  enableMinimaxVoice: boolean
): Promise<StoryPart> {
    const isFirstPart = partNumber === 1;
    
    const previousPartsText = previousParts
        .map((p, i) => `--- PREVIOUS PART ${i + 1} ---\nTITLE: ${p.title}\nSTORY: ${p.body}\nEND: ${p.endLine}\n--- END PART ${i+1} ---`)
        .join('\n\n');

    const prompt = `
    You are a master storyteller for a YouTube channel focused on "Business Betrayal / Startup Drama". Your task is to write Part ${partNumber} of a ${totalParts}-part script.

    **Overall Topic:** ${topic}
    **Story Outline:**
    ${outline}

    ${!isFirstPart ? `**Story So Far (Previous Parts):**\n${previousPartsText}` : ''}

    **Your Task:**
    Write ONLY Part ${partNumber}. Follow the outline for this part.
    - **Narration:** Use first-person ("I").
    - **Style:** Cinematic, documentary-like, with emotional depth and business realism. The tone should be serious and reflective.
    - **Language:** ${language}.
    - **Continuity:** ${logic ? 'Ensure perfect continuity with the characters, events, and tone from the previous parts. The story must be consistent and logical.' : 'Continue the story from the previous part.'}
    ${isFirstPart && clickbait ? '- **Opening:** Start with a powerful, "clickbait" style hook to grab the viewer\'s attention immediately.' : ''}
    ${enableVoice ? `- **Voice Pacing & Intonation (for TTS):** To enhance the audio narration, craft the script for a natural, human-like delivery.
        - **Punctuation is Key:** Use punctuation to guide the TTS voice. Employ ellipses (...) for dramatic pauses or trailing thoughts. Use em-dashes (—) for interruptions or shifts in thought. This is crucial for a realistic performance.
        - **ElevenLabs Tags:** Strategically insert ElevenLabs-compatible tags. Use tags like \`[pause]\`, \`[hesitates]\` for rhythm. Use \`[sad]\`, \`[nervous]\`, \`[frustrated]\` for emotion. Use \`[whispers]\`, \`[quietly]\` for delivery style. Use \`[sighs]\` or \`[gulps]\` for reactions.
        - **Example:** "I couldn't believe it... [pause] He just— [hesitates] he took everything. [sighs]"
        - These tags and punctuation should be embedded directly within the "body" and "endLine" fields to maximize impact.` : ''}
    ${enableMinimaxVoice ? `- **Minimax TTS Optimization:** To ensure the best possible audio output from the Minimax TTS engine, format the text for a natural, human-like narration.
        - **Pacing via Punctuation:** Use punctuation meticulously. Commas, periods, and especially ellipses (...) are vital for creating natural pauses and controlling the speaking rhythm.
        - **Pacing via Line Breaks:** Use line breaks (new paragraphs, creating empty lines between text) to create longer, more significant pauses, just as a real narrator would. This helps build suspense and emotion.
        - **Convey Emotion through Structure:** Convey emotion through sentence structure and punctuation. Short, choppy sentences can show panic, while longer, flowing sentences can show reflection.
        - **Example of proper formatting:**
          "Tôi đã tin tưởng anh ta...
          
          Hoàn toàn tin tưởng.
          
          Và cuối cùng... anh ta lấy đi tất cả."
        - **CRITICAL RULE:** Do NOT use any bracketed tags like [buồn bã] or [thở dài]. Rely ONLY on punctuation and line break formatting to guide the TTS voice's performance.` : ''}
    - **Length:** The body of the story should be approximately ${wordsPerPart} words.
    - **Ending:** Conclude this part with a strong cliffhanger or a thoughtful reflection that makes the viewer eager for the next part.
    - **Format:** Respond ONLY with a JSON object that matches the required schema. Do not add any extra text or markdown formatting around the JSON.
    `;

    const response = await generateWithFallback({
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: storyPartSchema,
        }
    });

    try {
        // FIX: Extract JSON from text to handle potential markdown wrappers from the API.
        const jsonText = extractJsonFromText(response.text);
        if (!jsonText) {
            throw new Error("AI returned an empty response.");
        }
        const parsed = JSON.parse(jsonText);
        return parsed as StoryPart;
    } catch (e) {
        console.error("Failed to parse Gemini response:", response.text, e);
        throw new Error("AI trả về định dạng không hợp lệ. Vui lòng thử lại.");
    }
}


const suggestionsSchema = {
    type: Type.OBJECT,
    properties: {
        thumbnails: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of 3-5 short, punchy text ideas for a YouTube thumbnail (3-5 words max each)."
        },
        voicePrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of 3 descriptive prompts for an ElevenLabs AI voice, detailing the desired tone, gender, and emotion for the narration."
        },
        imagePrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of 3-5 descriptive prompts for an image generation AI (like Sora or Imagen) to create visuals for the video."
        }
    },
    required: ['thumbnails', 'voicePrompts', 'imagePrompts']
};


export async function generatePostGenerationSuggestions(
  fullStoryText: string,
  topic: string
): Promise<Suggestions> {
  const prompt = `
    Based on the following YouTube script about business betrayal (topic: "${topic}"), generate some production assets.
    
    **Full Script:**
    ---
    ${fullStoryText.substring(0, 4000)}...
    ---

    Provide a JSON object with three keys:
    1.  "thumbnails": An array of 3 to 5 short, punchy text ideas for a YouTube thumbnail. (e.g., "He Stole Everything", "$2M Gone Overnight").
    2.  "voicePrompts": An array of 3 descriptive prompts for an ElevenLabs AI voice suitable for this story. (e.g., "A deep, calm, male narrative voice, conveying a sense of reflection and regret.", "A slightly weathered, mid-40s female voice, speaking with gravitas and authority.").
    3.  "imagePrompts": An array of 3 to 5 descriptive prompts for an image generation AI like Sora or Imagen to create illustrative visuals. (e.g., "cinematic shot, two co-founders arguing in a dimly lit, modern office at night, tension visible", "a single person working late, illuminated only by a computer screen, silhouette").

    Respond ONLY with the JSON object.
    `;

  const response = await generateWithFallback({
    contents: prompt,
    config: {
        responseMimeType: 'application/json',
        responseSchema: suggestionsSchema,
    }
  });

   try {
        // FIX: Extract JSON from text to handle potential markdown wrappers from the API.
        const jsonText = extractJsonFromText(response.text);
        if (!jsonText) {
            throw new Error("AI returned an empty response.");
        }
        const parsed = JSON.parse(jsonText);
        return parsed as Suggestions;
    } catch (e) {
        console.error("Failed to parse suggestions response:", response.text, e);
        throw new Error("AI trả về định dạng gợi ý không hợp lệ.");
    }
}


export async function generateSeoContent(
  fullStoryText: string,
  topic: string,
  language: Language,
  type: SeoContentType
): Promise<string[]> {
    let taskDescription = '';
    let schema: any;

    switch (type) {
        case 'title':
            taskDescription = 'Generate an array of 5 viral, clickbait, and SEO-optimized YouTube video titles. The titles should be intriguing and reflect the core conflict of the story.';
            schema = {
                type: Type.OBJECT,
                properties: {
                    results: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ['results']
            };
            break;
        case 'description':
            taskDescription = 'Write a single, compelling, 250-word YouTube video description. It should summarize the story\'s hook, introduce the conflict, and include relevant keywords for search. End with a call to action (like, subscribe, comment).';
            schema = {
                type: Type.OBJECT,
                properties: {
                    result: {
                        type: Type.STRING
                    }
                },
                required: ['result']
            };
            break;
        case 'hashtags':
            taskDescription = 'Generate an array of 15 relevant YouTube hashtags. Include a mix of broad and specific tags related to business, startups, betrayal, storytelling, and the specific themes in the script.';
             schema = {
                type: Type.OBJECT,
                properties: {
                    results: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ['results']
            };
            break;
    }

    const prompt = `
    You are a YouTube SEO expert specializing in the "Business Drama" niche.
    Your task is to generate SEO content for a video based on the provided script.
    The target language is ${language}.
    
    **Original Topic:** "${topic}"

    **Full Script Summary:**
    ---
    ${fullStoryText.substring(0, 3000)}...
    ---

    **Your Specific Task:**
    ${taskDescription}

    Respond ONLY with a JSON object matching the required schema. Do not add any extra text or markdown.
    `;

    const response = await generateWithFallback({
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
        }
    });

    try {
        // FIX: Extract JSON from text to handle potential markdown wrappers from the API.
        const jsonText = extractJsonFromText(response.text);
        if (!jsonText) {
            throw new Error("AI returned an empty response.");
        }
        const parsed = JSON.parse(jsonText);
        if (type === 'description') {
            return [parsed.result];
        }
        return parsed.results;
    } catch (e) {
        console.error(`Failed to parse SEO content for ${type}:`, response.text, e);
        throw new Error(`AI trả về định dạng SEO (${type}) không hợp lệ.`);
    }
}
