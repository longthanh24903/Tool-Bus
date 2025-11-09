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
    
    try {
        // Kiểm tra nested error structure (GoogleGenAI SDK có thể trả về error.error)
        const errorObj = error.error || error;
        const errorResponse = errorObj.response || error.response || errorObj;
        
        // Lấy các giá trị từ nhiều level (kiểm tra cả nested structure)
        const errorMessage = (
            errorResponse?.error?.message || 
            errorObj?.message || 
            error?.message || 
            errorResponse?.message || 
            ''
        ).toLowerCase();
        
        const errorCode = (
            errorResponse?.error?.code || 
            errorObj?.code || 
            error?.code || 
            errorResponse?.code ||
            errorObj?.statusCode ||
            error?.statusCode ||
            ''
        );
        
        const errorStatus = (
            errorResponse?.error?.status || 
            errorObj?.status || 
            error?.status || 
            errorResponse?.status || 
            ''
        ).toLowerCase();
        
        // Serialize to string để check patterns
        const errorString = JSON.stringify(error).toLowerCase();
        
        // Log error để debug
        console.log('[Quota Error Check]', {
            code: errorCode,
            status: errorStatus,
            message: errorMessage.substring(0, 100),
            hasErrorNested: !!error.error,
            hasResponseError: !!errorResponse?.error,
            errorStructure: {
                error: !!error.error,
                errorError: !!error.error?.error,
                errorResponse: !!error.response,
            }
        });
        
        // Kiểm tra error code trực tiếp (429, 403) - kiểm tra cả number và string
        // Kiểm tra nhiều cách khác nhau vì error structure có thể khác nhau
        // Đặc biệt kiểm tra error.error.code và error.error.status (cấu trúc từ API response)
        const code429 = (
            errorCode === 429 || 
            errorCode === '429' || 
            String(errorCode) === '429' ||
            String(errorCode).includes('429') ||
            errorResponse?.error?.code === 429 ||
            errorObj?.code === 429 ||
            error?.code === 429 ||
            error?.error?.code === 429 ||
            errorObj?.error?.code === 429 ||
            // Kiểm tra trong errorString (JSON serialized)
            errorString.includes('"code":429') ||
            errorString.includes('"code": 429')
        );
        
        const statusExhausted = (
            errorStatus === 'resource_exhausted' ||
            errorStatus === 'RESOURCE_EXHAUSTED' ||
            errorStatus.includes('resource_exhausted') ||
            errorResponse?.error?.status === 'RESOURCE_EXHAUSTED' ||
            errorObj?.status === 'RESOURCE_EXHAUSTED' ||
            error?.status === 'RESOURCE_EXHAUSTED' ||
            error?.error?.status === 'RESOURCE_EXHAUSTED' ||
            errorObj?.error?.status === 'RESOURCE_EXHAUSTED' ||
            // Kiểm tra trong errorString
            errorString.includes('resource_exhausted') ||
            errorString.includes('RESOURCE_EXHAUSTED')
        );
        
        if (code429 || statusExhausted) {
            console.log('[Quota Error Check] ✅ Detected quota error by code/status:', { 
                code: errorCode, 
                status: errorStatus,
                code429,
                statusExhausted,
                errorObjCode: errorObj?.code,
                errorResponseCode: errorResponse?.error?.code,
                errorErrorCode: error?.error?.code,
            });
            return true;
        }
        
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
            'limit exceeded',
            'exceeded your current quota',
            'free_tier_requests',
            'generativelanguage.googleapis.com',
            'resource_exhausted',
            'RESOURCE_EXHAUSTED'
        ];
        
        const isQuota = quotaPatterns.some(pattern => 
            errorMessage.includes(pattern) || 
            errorString.includes(pattern) ||
            String(errorCode).includes(pattern) ||
            errorStatus.includes(pattern)
        );
        
        if (isQuota) {
            console.log('[Quota Error Check] ✅ Detected quota error by pattern matching');
        } else {
            console.log('[Quota Error Check] ❌ Not a quota error');
        }
        
        return isQuota;
    } catch (e) {
        console.error('[Quota Error Check] Error checking quota error:', e);
        // Nếu có lỗi khi check, return false để không block
        return false;
    }
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
    // Lấy số lượng keys available để set maxRetries
    const allKeys = apiKeyManager.getAllKeys();
    const availableKeysCount = allKeys.filter(k => !k.isExhausted).length;
    const maxRetries = Math.max(availableKeysCount, allKeys.length, 3); // Đảm bảo ít nhất thử 3 lần
    let lastError: any = null;
    const usedKeys = new Set<string>(); // Track các keys đã thử trong request này
    
    console.log(`[API Key Rotation] Starting with ${availableKeysCount} available keys out of ${allKeys.length} total keys`);
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Lấy API key hiện tại (sẽ tự động skip các key đã exhausted)
            const currentApiKey = apiKeyManager.getCurrentKey();
            
            if (!currentApiKey) {
                throw new Error('Không có API key nào khả dụng. Vui lòng thêm API key mới.');
            }
            
            // Nếu key này đã được thử trong request này, mark exhausted và rotate
            if (usedKeys.has(currentApiKey)) {
                console.warn(`[API Key Rotation] Key already tried in this request: ${currentApiKey.substring(0, 10)}...`);
                apiKeyManager.markCurrentKeyExhausted('Key already tried in this request');
                
                // Thử lấy key mới
                const nextKey = apiKeyManager.getCurrentKey();
                if (!nextKey || usedKeys.has(nextKey)) {
                    // Không còn key nào khả dụng
                    throw new Error('Đã thử tất cả các API keys. Không còn key nào khả dụng.');
                }
                continue; // Continue với key mới
            }
            
            usedKeys.add(currentApiKey);
            console.log(`[API Key Rotation] Attempt ${attempt + 1}/${maxRetries}, using key: ${currentApiKey.substring(0, 10)}...`);
            
            const ai = new GoogleGenAI({ apiKey: currentApiKey });
            
            // Thử với primary model trước
            try {
                const response = await ai.models.generateContent({
                    ...params,
                    model: primaryModel,
                });
                console.log(`[API Key Rotation] Success with key: ${currentApiKey.substring(0, 10)}...`);
                return response;
            } catch (primaryError: any) {
                // Log error đầy đủ để debug - log toàn bộ error object
                console.error(`[API Key Rotation] Primary model error - FULL ERROR OBJECT:`, primaryError);
                console.error(`[API Key Rotation] Primary model error - STRUCTURE:`, {
                    message: primaryError?.message,
                    code: primaryError?.code,
                    status: primaryError?.status,
                    error: primaryError?.error,
                    errorCode: primaryError?.error?.code,
                    errorStatus: primaryError?.error?.status,
                    errorMessage: primaryError?.error?.message,
                    response: primaryError?.response,
                    statusCode: primaryError?.statusCode,
                    // Log cả JSON string để xem cấu trúc
                    errorString: JSON.stringify(primaryError).substring(0, 500),
                });
                
                // Kiểm tra xem có phải lỗi quota không - GỌI TRƯỚC KHI XỬ LÝ
                let isQuota = isQuotaError(primaryError);
                console.log(`[API Key Rotation] ⚠️ Is quota error (first check): ${isQuota}`);
                
                // Nếu không phát hiện được, thử parse error string và kiểm tra lại
                // Đây là fallback để đảm bảo không bỏ sót lỗi quota
                if (!isQuota) {
                    try {
                        const errorStr = JSON.stringify(primaryError).toLowerCase();
                        // Kiểm tra các pattern trong error string
                        if (
                            errorStr.includes('429') || 
                            errorStr.includes('resource_exhausted') || 
                            errorStr.includes('quota exceeded') ||
                            errorStr.includes('exceeded your current quota') ||
                            errorStr.includes('free_tier_requests') ||
                            errorStr.includes('generativelanguage.googleapis.com')
                        ) {
                            console.warn(`[API Key Rotation] ⚠️ Detected quota error in error string, forcing isQuota = true`);
                            isQuota = true; // Force là quota error
                        }
                    } catch (e) {
                        console.error('[API Key Rotation] Error parsing error string:', e);
                    }
                }
                
                console.log(`[API Key Rotation] ⚠️ Final isQuota check: ${isQuota}`);
                
                // Nếu lỗi là quota error, đánh dấu key hiện tại và thử key khác
                if (isQuota) {
                    const errorMsg = primaryError.message || primaryError.error?.message || primaryError.error?.error?.message || 'Quota exhausted';
                    console.warn(`[API Key Rotation] ⚠️ Key exhausted: ${currentApiKey.substring(0, 10)}..., error: ${errorMsg.substring(0, 100)}`);
                    console.warn(`[API Key Rotation] Marking key as exhausted and rotating...`);
                    
                    // Đánh dấu key hiện tại là exhausted (truyền key cụ thể để đảm bảo mark đúng)
                    apiKeyManager.markKeyExhausted(currentApiKey, errorMsg);
                    
                    // Đợi một chút trước khi rotate (để đảm bảo state được update)
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Kiểm tra xem còn key nào available không
                    const hasAvailable = apiKeyManager.hasAvailableKey();
                    const allKeys = apiKeyManager.getAllKeys();
                    const availableKeys = allKeys.filter(k => !k.isExhausted);
                    console.log(`[API Key Rotation] Has available keys: ${hasAvailable}, available count: ${availableKeys.length}/${allKeys.length}`);
                    
                    // Nếu còn key khác, thử lại
                    if (hasAvailable && attempt < maxRetries - 1) {
                        console.log(`[API Key Rotation] ✅ Rotating to next key (attempt ${attempt + 1}/${maxRetries})...`);
                        // Reset usedKeys để cho phép thử key mới
                        usedKeys.clear();
                        continue; // Continue loop để thử key tiếp theo
                    }
                    
                    // Nếu tất cả keys đã exhausted, chuyển sang flash model với key cuối cùng
                    console.warn(`[API Key Rotation] ⚠️ All keys exhausted. Trying Flash model with last key.`);
                    try {
                        const lastKey = apiKeyManager.getCurrentKey();
                        if (lastKey) {
                            console.log(`[API Key Rotation] Trying Flash model with key: ${lastKey.substring(0, 10)}...`);
                            const flashAi = new GoogleGenAI({ apiKey: lastKey });
                            const response = await flashAi.models.generateContent({
                                ...params,
                                model: fallbackModel,
                            });
                            console.log(`[API Key Rotation] ✅ Flash model succeeded`);
                            return response;
                        }
                    } catch (flashError: any) {
                        console.error(`[API Key Rotation] ❌ Flash model also failed:`, flashError);
                        throw new Error(`Tất cả API keys đã hết quota và không thể sử dụng Flash model: ${flashError.message}`);
                    }
                }
                
                // Nếu không phải lỗi quota, thử fallback model với key hiện tại
                console.warn(
                    `Primary model '${primaryModel}' failed. Retrying with fallback '${fallbackModel}'.`,
                    primaryError
                );
                try {
                    const response = await ai.models.generateContent({
                        ...params,
                        model: fallbackModel,
                    });
                    return response;
                } catch (fallbackError: any) {
                    console.error(`[API Key Rotation] Fallback model error:`, fallbackError);
                    
                    // Nếu fallback model cũng lỗi và là quota error, đánh dấu key
                    if (isQuotaError(fallbackError)) {
                        const errorMsg = fallbackError.message || fallbackError.error?.message || fallbackError.error?.error?.message || 'Quota exhausted';
                        console.warn(`[API Key Rotation] ⚠️ Fallback model also exhausted key: ${currentApiKey.substring(0, 10)}...`);
                        apiKeyManager.markKeyExhausted(currentApiKey, errorMsg);
                        
                        // Đợi một chút trước khi rotate
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        if (apiKeyManager.hasAvailableKey() && attempt < maxRetries - 1) {
                            console.log(`[API Key Rotation] ✅ Rotating to next key after fallback error...`);
                            // Reset usedKeys để cho phép thử key mới
                            usedKeys.clear();
                            continue;
                        }
                    }
                    // Nếu không phải quota error hoặc không còn key, throw error
                    throw fallbackError;
                }
            }
        } catch (error: any) {
            lastError = error;
            console.error(`[API Key Rotation] Outer catch error:`, error);
            
            // Kiểm tra xem có phải lỗi quota không
            const isQuota = isQuotaError(error);
            console.log(`[API Key Rotation] Outer catch - Is quota error: ${isQuota}`);
            
            // Nếu lỗi là quota error, đánh dấu và thử key khác
            if (isQuota) {
                // Tìm key đã được thử (key cuối cùng trong usedKeys)
                const triedKey = usedKeys.size > 0 ? Array.from(usedKeys)[usedKeys.size - 1] : null;
                const currentKey = triedKey || apiKeyManager.getCurrentKey();
                
                if (currentKey) {
                    const errorMsg = error.message || error.error?.message || error.error?.error?.message || 'Quota exhausted';
                    console.warn(`[API Key Rotation] ⚠️ Key exhausted in outer catch: ${currentKey.substring(0, 10)}..., error: ${errorMsg.substring(0, 100)}`);
                    apiKeyManager.markKeyExhausted(currentKey, errorMsg);
                }
                
                // Đợi một chút trước khi rotate
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Kiểm tra xem còn key nào available không
                const hasAvailable = apiKeyManager.hasAvailableKey();
                const allKeys = apiKeyManager.getAllKeys();
                const availableKeys = allKeys.filter(k => !k.isExhausted);
                console.log(`[API Key Rotation] Has available keys after error: ${hasAvailable}, available count: ${availableKeys.length}/${allKeys.length}`);
                
                // Nếu còn key khác, thử lại
                if (hasAvailable && attempt < maxRetries - 1) {
                    console.log(`[API Key Rotation] ✅ Rotating to next key (attempt ${attempt + 1}/${maxRetries})...`);
                    // Reset usedKeys để cho phép thử key mới
                    usedKeys.clear();
                    continue;
                }
                
                // Nếu tất cả keys đã exhausted, throw error
                if (apiKeyManager.areAllKeysExhausted()) {
                    console.error(`[API Key Rotation] ❌ All keys exhausted. Cannot continue.`);
                    throw new Error(`Tất cả API keys đã hết quota/pro. Vui lòng thêm API key mới hoặc đợi quota reset.`);
                }
            }
            
            // Nếu không phải lỗi quota hoặc đã hết lần thử, throw error
            if (attempt === maxRetries - 1) {
                console.error(`[API Key Rotation] ❌ Max retries reached. Throwing error.`);
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
