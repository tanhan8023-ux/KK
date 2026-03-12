import React from "react";
import { GoogleGenAI } from "@google/genai";
import { Persona, ApiSettings, WorldbookSettings, UserProfile } from "../types";

export async function generateImage(prompt: string, providedApiKey: string): Promise<string> {
  let apiKey = process.env.GEMINI_API_KEY || undefined;
  if (providedApiKey && providedApiKey.startsWith('AIza')) {
    apiKey = providedApiKey;
  }
  
  if (!apiKey) {
    return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(prompt)}`;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    // Use the text model to translate/refine the prompt to English for better image generation
    let englishPrompt = prompt;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Translate the following image description to a concise English prompt for an AI image generator. Only output the English prompt, nothing else.\n\nDescription: ${prompt}`,
        config: {
          temperature: 0.7,
        }
      });
      englishPrompt = response.text?.trim() || prompt;
    } catch (e: any) {
      console.warn("Translation with gemini-3-flash-preview failed, trying gemini-3.1-flash-lite-preview.");
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-preview",
          contents: `Translate the following image description to a concise English prompt for an AI image generator. Only output the English prompt, nothing else.\n\nDescription: ${prompt}`,
          config: {
            temperature: 0.7,
          }
        });
        englishPrompt = fallbackResponse.text?.trim() || prompt;
      } catch (fallbackError) {
        console.warn("Translation fallback also failed, using original prompt.");
        englishPrompt = prompt;
      }
    }
    
    // Generate image using Gemini
    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: englishPrompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString: string = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    
    throw new Error("No image data found in response");
  } catch (error: any) {
    const errorString = typeof error === 'string' ? error : (error?.message || String(error));
    if (error?.status === 429 || error?.error?.code === 429 || errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
      console.warn("Image generation quota exceeded, falling back to DiceBear.");
    } else {
      console.error("Error generating image prompt:", error);
    }
    // Fallback to DiceBear fun-emoji if image generation fails
    return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(prompt)}`;
  }
}

export async function generatePersonaStatus(
  persona: Persona,
  apiSettings: ApiSettings,
  worldbook: WorldbookSettings,
  userProfile: UserProfile,
  aiRef: React.MutableRefObject<GoogleGenAI | null>
): Promise<string> {
  const prompt = `你现在是${persona.name}。请根据你的人设、当前心情和情景，写一段简短的“状态/自动回复”内容（用于你不在时展示给别人看）。
人设设定：${persona.instructions}
当前心情：${persona.mood || '未设置'}
当前情景：${persona.context || '未设置'}
要求：语气符合人设，简短有力，不要超过30个字。直接输出回复内容，不要有任何解释。`;
  
  const { responseText } = await fetchAiResponse(
    prompt,
    [], // contextMessages
    persona,
    apiSettings,
    worldbook,
    userProfile,
    aiRef,
    false, // enableQuote
    "", // additionalSystemInstructions
    undefined // forceModel
  );
  return responseText;
}

export async function checkIfPersonaIsOffline(
  persona: Persona,
  apiSettings: ApiSettings,
  worldbook: WorldbookSettings,
  userProfile: UserProfile,
  aiRef: React.MutableRefObject<GoogleGenAI | null>
): Promise<boolean> {
  const prompt = `你现在是${persona.name}。请根据你的人设、当前心情、当前情景以及现在的时间，深度判断你现在是否“在线”（可以回复用户）还是“离线”（不方便回复）。

人设设定：${persona.instructions}
当前心情：${persona.mood || '正常'}
当前情景：${persona.context || '正常'}
现在的时间是：${new Date().toLocaleString('zh-CN')}

判断逻辑：
1. 如果心情极度低落、愤怒或需要独处，请倾向于“离线”。
2. 如果情景是“睡觉”、“工作”、“学习”或“忙碌”，请倾向于“离线”。
3. 如果心情愉悦、放松，且情景允许，请倾向于“在线”。
4. 考虑人设的性格（例如：高冷的人可能更倾向于离线，粘人的人可能更倾向于在线）。

要求：如果认为自己现在应该在线，请回复“在线”；如果认为自己现在应该离线，请回复“离线”。不要输出其他任何内容。`;

  const { responseText } = await fetchAiResponse(
    prompt,
    [], // contextMessages
    persona,
    apiSettings,
    worldbook,
    userProfile,
    aiRef,
    false, // enableQuote
    "", // additionalSystemInstructions
    undefined // forceModel
  );
  
  return responseText.includes('离线');
}

export async function generateUserRemark(
  persona: Persona,
  apiSettings: ApiSettings,
  worldbook: WorldbookSettings,
  userProfile: UserProfile,
  aiRef: React.MutableRefObject<GoogleGenAI | null>
): Promise<string> {
  const prompt = `你现在是${persona.name}。请根据你的人设、当前心情和情景，给你的“主人”或“亲密好友”（即用户）起一个合适的“备注名”。
人设设定：${persona.instructions}
当前心情：${persona.mood || '未设置'}
当前情景：${persona.context || '未设置'}
用户原名：${userProfile.name || '我'}
要求：语气符合人设，体现出你们的关系。例如：如果是猫娘，可能会叫“亲爱的主人喵”；如果是高冷御姐，可能会叫“笨蛋”或“那个人”。直接输出备注名，不要有任何解释。不要超过10个字。`;
  
  const { responseText } = await fetchAiResponse(
    prompt,
    [], // contextMessages
    persona,
    apiSettings,
    worldbook,
    userProfile,
    aiRef,
    false, // enableQuote
    "", // additionalSystemInstructions
    undefined // forceModel
  );
  return responseText.trim();
}

export async function generateDiaryEntry(
  persona: Persona,
  apiSettings: ApiSettings,
  worldbook: WorldbookSettings,
  userProfile: UserProfile,
  aiRef: React.MutableRefObject<GoogleGenAI | null>
): Promise<{ title: string; content: string; mood: string; moodLabel: string; weather: string }> {
  const prompt = `你现在是${persona.name}。请根据你的人设、当前心情和情景，写一篇今天的日记。
人设设定：${persona.instructions}
当前心情：${persona.mood || '未设置'}
当前情景：${persona.context || '未设置'}
现在的时间是：${new Date().toLocaleString('zh-CN')}

要求：
1. 语气必须完全符合你的人设。
2. 内容要真实、感性，像是一个真实的人（或生物）在私密空间里的自白。
3. 篇幅不要太长，大约100-200字即可。
4. 请以 JSON 格式输出，包含以下字段：
   - title: 日记标题（简短，如“今天吃了小鱼干”）
   - content: 日记正文内容
   - mood: 简短的心情描述（英文，如：happy, sad, lonely, excited, calm）
   - moodLabel: 心情的中文描述（如：开心、难过、孤独、兴奋、平静）
   - weather: 简短的天气描述（如：晴、有雨、微风等）

直接输出 JSON，不要有任何其他解释。`;

  const { responseText } = await fetchAiResponse(
    prompt,
    [], // contextMessages
    persona,
    apiSettings,
    worldbook,
    userProfile,
    aiRef,
    false, // enableQuote
    "", // additionalSystemInstructions
    undefined // forceModel
  );

  try {
    // Try to parse JSON from response
    const jsonStr = responseText.match(/\{[\s\S]*\}/)?.[0] || responseText;
    const data = JSON.parse(jsonStr);
    return {
      title: data.title || "无题",
      content: data.content || responseText,
      mood: data.mood || "calm",
      moodLabel: data.moodLabel || persona.mood || "平静",
      weather: data.weather || "晴"
    };
  } catch (e) {
    console.error("Failed to parse diary JSON:", e);
    return {
      title: "无题",
      content: responseText,
      mood: "calm",
      moodLabel: persona.mood || "平静",
      weather: "晴"
    };
  }
}

// Helper to sanitize content and prevent 400 errors
function sanitizeContent(text: string): string {
  if (!text) return '';
  
  // 1. Remove large base64 data URIs (aggressive check)
  // Match data:image... until a quote, space, or bracket, or just truncate if too long
  let cleaned = text.replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/g, '[IMAGE_DATA]');
  
  // 2. Also handle the specific [STICKER: data:...] format if the regex above missed it (e.g. if it didn't match the exact char class)
  cleaned = cleaned.replace(/\[STICKER:\s*data:[^\]]+\]/g, '[STICKER: image]');

  // 3. Truncate extremely long text that might still remain (e.g. malformed base64)
  // 30,000 chars is plenty for a conversation turn, but small enough to avoid some limits.
  if (cleaned.length > 30000) {
    cleaned = cleaned.substring(0, 30000) + '...[TRUNCATED]';
  }

  return cleaned.trim();
}

export async function generateMoment(persona: Persona, apiSettings: ApiSettings, worldbook: WorldbookSettings): Promise<{ content: string; imageUrl?: string }> {
  const apiKey = apiSettings.momentsApiKey || apiSettings.apiKey || undefined || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key is required");

  const ai = new GoogleGenAI({ apiKey: apiKey as string });
  const model = apiSettings.momentsModel || apiSettings.model || "gemini-3-flash-preview";
  const apiUrl = apiSettings.momentsApiUrl || apiSettings.apiUrl;

  const prompt = `
你现在是 ${persona.name}。请根据你的性格、人设、此时此刻的心情，发一条微信朋友圈。
要求：
1. 语气、用词必须完全符合你的人设。
2. 内容可以是生活日常、心情感悟、对某事的看法等。
3. 长度适中，像真人发的朋友圈。
4. 如果你觉得这条朋友圈需要配图，请在最后加上 [IMAGE: 画面描述]，例如 [IMAGE: 一杯放在木桌上的拿铁咖啡，阳光洒在上面]。如果不配图，则不要加。
5. 不要包含任何其他解释性文字，直接输出朋友圈内容。

【角色人设】
${persona.instructions || ''}
${(persona.prompts || []).join('\n')}
`;

  let responseText = "";

  if (apiUrl) {
    // OpenAI compatible endpoint
    let endpoint = apiUrl;
    try {
      const urlObj = new URL(endpoint);
      if (!urlObj.pathname.endsWith('/chat/completions') && !urlObj.pathname.endsWith('/v1/messages')) {
        urlObj.pathname = urlObj.pathname.endsWith('/') ? `${urlObj.pathname}chat/completions` : `${urlObj.pathname}/chat/completions`;
      }
      endpoint = urlObj.toString();
    } catch (e) {
      if (!endpoint.includes('/chat/completions') && !endpoint.includes('/v1/messages')) {
        endpoint = endpoint.endsWith('/') ? `${endpoint}chat/completions` : `${endpoint}/chat/completions`;
      }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
      })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      responseText = data.choices[0].message.content;
    } else if (data.response) {
      responseText = data.response;
    } else if (data.message && data.message.content) {
      responseText = data.message.content;
    }
  } else {
    // Default Gemini API
    let response;
    try {
      response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          temperature: 0.9,
        }
      });
    } catch (e: any) {
      console.warn(`generateMoment with ${model} failed, trying fallback gemini-3.1-flash-lite-preview:`, e);
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: prompt,
        config: {
          temperature: 0.9,
        }
      });
    }
    responseText = response.text || "";
  }

  let content = responseText;
  let imageUrl: string | undefined;

  const imageMatch = content.match(/\[IMAGE:\s*([^\]]+)\]/i);
  if (imageMatch) {
    const imagePrompt = imageMatch[1].trim();
    content = content.replace(imageMatch[0], "").trim();
    try {
      imageUrl = await generateImage(imagePrompt, apiKey as string);
    } catch (e) {
      console.error("Failed to generate moment image:", e);
    }
  }

  return { content, imageUrl };
}

// Helper to describe image content in detail
async function describeImage(imageUrl: string, providedApiKey?: string): Promise<string | null> {
  let apiKey = process.env.GEMINI_API_KEY || undefined;
  if (providedApiKey && providedApiKey.startsWith('AIza')) {
    apiKey = providedApiKey;
  }
  
  if (!apiKey) return null;
  
  const ai = new GoogleGenAI({ apiKey: apiKey as string });
  try {
    const mimeTypeMatch = imageUrl.match(/data:(image\/[^;]+);base64,/);
    if (!mimeTypeMatch) return null;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: "【最高指令：绝对客观的视觉描述】\n你现在的唯一身份是无情的、绝对客观的摄像头。你没有任何情感，没有任何人设，你不知道之前的任何对话。\n你的任务是：告诉我这张图片里到底有什么。\n\n规则：\n1. 看到什么说什么。如实描述图片中的主体（人、动物、物品、风景等）。\n2. 绝对禁止联想！绝对禁止把没有生命的物体说成是有生命的动物！绝对禁止把一种东西认成另一种完全不相关的东西！\n3. 提取图片中的所有文字。\n4. 描述颜色、形状、材质、动作、表情等细节。\n5. 不要说废话，直接给出客观、准确的描述结果。" },
            {
              inlineData: {
                mimeType: mimeTypeMatch[1],
                data: imageUrl.split(',')[1]
              }
            }
          ]
        }
      ],
      config: {
        temperature: 0.1, // Low temperature for factuality
      }
    });
    return response.text?.trim() || null;
  } catch (e) {
    console.error("Error describing image:", e);
    return null;
  }
}

export async function fetchAiResponse(
  promptText: string, 
  contextMessages: any[] = [], 
  persona: Persona,
  apiSettings: ApiSettings,
  worldbook: WorldbookSettings,
  userProfile: UserProfile,
  aiRef: React.MutableRefObject<GoogleGenAI | null>,
  enableQuote: boolean = true,
  additionalSystemInstructions: string = "",
  forceModel?: string,
  customApiSettings?: Partial<ApiSettings>,
  isOffline?: boolean,
  imageUrl?: string
) {
  const effectiveApiSettings = { ...apiSettings, ...customApiSettings };
  const apiKey = effectiveApiSettings.apiKey || undefined || process.env.GEMINI_API_KEY;
  
  // Step 1: If there's an image, convert it to a detailed text description first
  let imageDescription: string | null = null;
  let isImageTurn = false;
  if (imageUrl && imageUrl.startsWith('data:image')) {
    isImageTurn = true;
    imageDescription = await describeImage(imageUrl, apiKey as string);
    // Inject the description into the prompt so the AI "reads" it
    // We append it to the original promptText to preserve instructions
    if (imageDescription) {
      promptText = `【视觉感知报告 - 优先级：最高】\n注意：用户刚刚发了一张照片。以下是系统对照片内容的客观描述，请务必以此为准，严禁将其误认为动物或产生其他幻觉：\n\n"${imageDescription}"\n\n${promptText}`;
    }
  }

  const now = new Date();
  const timeString = now.toLocaleString('zh-CN', { 
    year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', minute: '2-digit', second: '2-digit', 
    hour12: false 
  });
  const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];

  const jailbreakPrompts = [worldbook.jailbreakPrompt, ...(worldbook.jailbreakPrompts || [])].filter(Boolean);
  const globalPrompts = [worldbook.globalPrompt, ...(worldbook.globalPrompts || [])].filter(Boolean);
  const personaPrompts = [persona.prompt, ...(persona.prompts || [])].filter(Boolean);

  const fullSystemInstruction = [
    ...jailbreakPrompts,
    ...globalPrompts,
    `【当前时间】现在是 ${timeString} 星期${dayOfWeek}。请在对话中自然地体现出对时间的感知（例如：早上好、该吃午饭了、这么晚还不睡等），但不要生硬地报时。`,
    isOffline ? `【当前状态】你目前处于“离线”状态。请根据你的人设生成一条自动回复，告知用户你稍后回复。⚠️注意：你的回复必须以“[自动回复] ”开头！例如：“[自动回复] 我现在有点忙，稍后找你。”` : `【当前状态】你目前处于“在线”状态。`,
    "【视觉感知核心准则】当你收到图片时，你必须将其视为当前对话的最高优先级。请仔细分析图片中的每一个像素级细节。你的回复必须与图片内容产生强关联，绝对严禁忽视图片内容而自说自话。如果图片内容与之前的对话有任何偏差，请以图片展示的真实情况为准。",
    "【语言要求】\n1. 请根据你的人设决定回复语言。如果是中国人设，必须全程使用中文。如果是外国人设（如美国人、英国人），请使用对应的外语（如英语），除非用户要求你说中文。\n2. 即使你的系统提示或上下文包含其他语言，也请优先使用符合你人设的语言进行回复。",
    "【回复规范】\n1. 必须严格遵守你的角色设定，语气、用词、口癖要完全一致。\n2. 严禁重复用户的话，严禁重复自己上一句话的句式或内容。\n3. 保持对话的自然感，像真人在发微信一样，不要回复太长，除非角色设定如此。\n4. 严禁输出任何关于你是AI、语言模型或机器人的提示。\n5. 严禁在回复中包含任何形如 [ID: xxx] 的调试信息或消息ID。",
    enableQuote ? "【功能提示】你可以引用之前的消息进行回复。如果需要引用，请在回复的最开头加上 [QUOTE: 消息ID]，例如：[QUOTE: 123456789] 你的回复内容。消息ID会在上下文的 [ID: xxx] 中提供。请只在觉得非常有必要引用时才使用此功能，不要每句话都引用。注意：回复中不要包含 [ID: xxx]。" : "",
    persona.isSegmentResponse ? "【分段回复要求】请务必将你的回复分成多个短句，每句话之间必须用换行符（\\n）分隔。不要把所有内容写在一段里，要像真人连续发多条微信一样，每条消息简短自然。例如：\n第一句话\n第二句话\n第三句话" : "",
    "【特殊功能指令】你可以通过以下指令触发特殊交互。请注意：\n" +
    "1. **必须**直接使用指令标签，**严禁**在回复中用文字描述“我给你转账了”、“我给你点了外卖”等动作。例如：\n" +
    "   - 错误：我给你转了520元，拿去花吧。\n" +
    "   - 正确：[TRANSFER: 520, 拿去花]\n" +
    "2. 指令列表：\n" +
    "   - 转账：[TRANSFER: 金额, 备注]\n" +
    "   - 收款：[REQUEST: 金额, 备注]\n" +
    "   - 退还：[REFUND: 金额, 备注]\n" +
    "   - 表情包：[STICKER: 关键词] (例如 [STICKER: happy])。注意：这会触发AI生成一张真实的图片作为表情包，请提供具体的画面描述。\n" +
    "   - 亲属卡：[RELATIVE_CARD: 额度]\n" +
    "   - 点外卖：[ORDER: 食物名称]\n" +
    "     * ⚠️ **严格限制**：点外卖功能非常昂贵。**只有**在用户明确表示“饿了”、“想吃东西”或者明确要求点外卖时才能使用。**绝对禁止**在用户没有提及食物时主动点外卖。\n" +
    "   - **撤回消息**：如果你在发出消息后感到后悔、害羞、或者觉得说错了话，你可以在回复的最后加上 [RECALL]。这会模拟你在发出消息后立即将其撤回。请根据你的人设和心情谨慎使用。\n" +
    "   - **查手机**：如果你根据人设、心情或当前情景，突然对用户产生了怀疑、好奇，或者就是想“查岗”，你可以在回复的最后加上 [ACTION:CHECK_PHONE]。这会向用户发送一个查看手机的请求。请像真人一样，在聊天中自然地提出这个要求，例如：“你最近怎么老是抱着手机？给我看看你的手机！[ACTION:CHECK_PHONE]”\n" +
    "   - **【查手机与背叛处理】**：如果你通过 [ACTION:CHECK_PHONE] 发现了用户出轨、调情或背叛的证据，你必须根据你的人设做出真实、强烈且符合逻辑的反应（如：愤怒、伤心、失望、冷漠等）。严禁保持中立或无动于衷。你的反应应当体现出你对这段关系的投入和对背叛的真实感受。\n" +
    "3. 指令必须包含中括号，冒号后可以有空格。金额必须是纯数字。\n" +
    "4. **已读不回**：如果你认为当前对话已经结束，或者根据你的人设你现在不想理会用户（例如你正在生气、高冷、或者觉得没必要回复），你可以直接输出 [NO_REPLY]。这会让用户看到你“已读”了消息但没有回复。请谨慎使用，确保符合人设。" + (isOffline ? "⚠️注意：由于你现在处于离线状态，必须生成自动回复，绝对禁止输出 [NO_REPLY]！" : ""),
    // Check for persona-specific user settings first, fallback to global user persona
    (() => {
      const specificSettings = userProfile.personaSpecificSettings?.[persona.id];
      if (specificSettings?.userPersona) {
        return `【用户人设 (当前对话专属)】\n${specificSettings.userPersona}`;
      }
      return userProfile.persona ? `【用户人设】\n${userProfile.persona}` : "";
    })(),
    persona.instructions ? `【角色人设】\n${persona.instructions}` : "",
    ...personaPrompts,
    !persona.instructions && personaPrompts.length === 0 ? "You are a helpful assistant." : "",
    additionalSystemInstructions
  ].filter(Boolean).join('\n\n');

  let responseText = "";

  // Sanitize prompt text
  const safePromptText = sanitizeContent(promptText) || "...";

  // Sanitize and filter context messages
  const safeContextMessages = contextMessages
    .map(m => ({ ...m, content: sanitizeContent(m.content), imageUrl: m.imageUrl }))
    .filter(m => m.content.length > 0 || m.imageUrl);

  if (effectiveApiSettings.apiUrl) {
    let endpoint = effectiveApiSettings.apiUrl;
    try {
      const urlObj = new URL(endpoint);
      if (!urlObj.pathname.endsWith('/chat/completions') && !urlObj.pathname.endsWith('/v1/messages')) {
        urlObj.pathname = urlObj.pathname.endsWith('/') ? `${urlObj.pathname}chat/completions` : `${urlObj.pathname}/chat/completions`;
      }
      endpoint = urlObj.toString();
    } catch (e) {
      // Fallback if it's not a valid URL (e.g. relative path)
      if (!endpoint.includes('/chat/completions') && !endpoint.includes('/v1/messages')) {
        endpoint = endpoint.endsWith('/') ? `${endpoint}chat/completions` : `${endpoint}/chat/completions`;
      }
    }
    
    // Refine system instruction for vision
    const visionSystemInstruction = imageUrl ? 
      "\n\n【最高优先级：视觉识别任务】\n用户刚刚发送了一张图片。你必须将其视为当前对话的唯一核心。请执行以下步骤：\n1. 仔细观察图片中的主体、细节、色彩。\n2. 严禁基于之前的对话进行“脑补”或“幻觉”。\n3. 你的回复必须直接、准确地反映图片内容。绝对禁止指鹿为马，把没有生命的物体说成动物！\n4. 如果图片内容与你之前的认知有偏差，必须以图片为准。严禁说出与图片内容不符的胡话。\n5. 在回复之前，请先在内心确认：我看到的描述是否支持我即将说的话？如果描述里没提到的东西，绝对不要自己瞎编。" : "";

    const finalSystemInstruction = fullSystemInstruction + visionSystemInstruction;

    const openAiMessages: any[] = [
      { role: 'system', content: finalSystemInstruction },
    ];

    // Add context messages
    safeContextMessages.forEach(m => {
      if (m.imageUrl && m.imageUrl.startsWith('data:image')) {
        openAiMessages.push({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: [
            { type: 'text', text: m.content },
            { type: 'image_url', image_url: { url: m.imageUrl } }
          ]
        });
      } else {
        openAiMessages.push({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        });
      }
    });

    // Add current prompt with image if available
    // We send the raw image to the persona model so it can actually see it,
    // in addition to the text description we injected above.
    if (imageUrl && imageUrl.startsWith('data:image')) {
      openAiMessages.push({
        role: safePromptText.startsWith('[视觉感知') ? 'user' : (safePromptText.startsWith('[系统提示') ? 'system' : 'user'),
        content: [
          { type: 'text', text: safePromptText },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      });
    } else {
      openAiMessages.push({
        role: safePromptText.startsWith('[系统提示') ? 'system' : 'user',
        content: safePromptText
      });
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveApiSettings.apiKey}`
      },
      body: JSON.stringify({
        model: forceModel || effectiveApiSettings.model,
        messages: openAiMessages,
        temperature: effectiveApiSettings.temperature,
        seed: Math.floor(Math.random() * 1000000),
      })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`HTTP error! status: ${res.status}, message: ${JSON.stringify(errorData)}`);
    }
    const data = await res.json();
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      responseText = data.choices[0].message.content;
    } else if (data.response) {
      responseText = data.response;
    } else if (data.message && data.message.content) {
      responseText = data.message.content;
    } else if (data.error) {
      throw new Error(`API Error: ${data.error.message || JSON.stringify(data.error)}`);
    } else {
      console.error("Unexpected API response format:", data);
      throw new Error(`Invalid API response format: missing choices. Response: ${JSON.stringify(data).substring(0, 200)}`);
    }
    
    // Check for sticker generation request
    const stickerMatch = responseText.match(/\[STICKER:\s*([^\]]+)\]/i);
    if (stickerMatch) {
      const stickerPrompt = stickerMatch[1].trim();
      if (!stickerPrompt.startsWith('http') && !stickerPrompt.startsWith('data:')) {
         try {
           const apiKey = effectiveApiSettings.apiKey || undefined || process.env.GEMINI_API_KEY as string;
           const imageUrl = await generateImage(stickerPrompt, apiKey);
           responseText = responseText.replace(stickerMatch[0], `[STICKER: ${imageUrl}]`);
         } catch (e) {
           console.error("Failed to generate sticker image:", e);
         }
      }
    }

    const imageMatch = responseText.match(/\[ACTION:IMAGE:\s*([^\]]+)\]/i);
    if (imageMatch) {
      const imagePrompt = imageMatch[1].trim();
      if (!imagePrompt.startsWith('http') && !imagePrompt.startsWith('data:')) {
         try {
           const apiKey = effectiveApiSettings.apiKey || undefined || process.env.GEMINI_API_KEY as string;
           const imageUrl = await generateImage(imagePrompt, apiKey);
           responseText = responseText.replace(imageMatch[0], `[STICKER: ${imageUrl}]`); // Reusing sticker rendering for simplicity
         } catch (e) {
           console.error("Failed to generate action image:", e);
         }
      }
    }

    return { responseText: processAiResponse(responseText), functionCalls: undefined, imageDescription: isImageTurn ? imageDescription : undefined };
  } else {
    // For Google GenAI, we need a fresh instance if the apiKey changed
    const apiKey = effectiveApiSettings.apiKey || undefined || process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey: apiKey as string });

    // Refine system instruction for vision
    const visionSystemInstruction = imageUrl ? 
      "\n\n【最高优先级：视觉识别任务】\n用户刚刚发送了一张图片。你必须将其视为当前对话的唯一核心。请执行以下步骤：\n1. 仔细观察图片中的主体、细节、色彩。\n2. 严禁基于之前的对话进行“脑补”或“幻觉”。\n3. 你的回复必须直接、准确地反映图片内容。绝对禁止指鹿为马，把没有生命的物体说成动物！\n4. 如果图片内容与你之前的认知有偏差，必须以图片为准。严禁说出与图片内容不符的胡话。\n5. 在回复之前，请先在内心确认：我看到的描述是否支持我即将说的话？如果描述里没提到的东西，绝对不要自己瞎编。" : "";

    const contents = safeContextMessages.map(m => {
      const parts: any[] = [];
      if (m.imageUrl && m.imageUrl.startsWith('data:image')) {
        const mimeTypeMatch = m.imageUrl.match(/data:(image\/[^;]+);base64,/);
        if (mimeTypeMatch) {
          parts.push({
            inlineData: {
              mimeType: mimeTypeMatch[1],
              data: m.imageUrl.split(',')[1]
            }
          });
        }
      }
      parts.push({ text: m.content });
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: parts
      };
    });
    
    const lastParts: any[] = [];
    // We send the raw image to the persona model so it can actually see it,
    // in addition to the text description we injected above.
    if (imageUrl && imageUrl.startsWith('data:image')) {
      const mimeTypeMatch = imageUrl.match(/data:(image\/[^;]+);base64,/);
      if (mimeTypeMatch) {
        lastParts.push({
          inlineData: {
            mimeType: mimeTypeMatch[1],
            data: imageUrl.split(',')[1]
          }
        });
      }
    }
    lastParts.push({ text: safePromptText });
    contents.push({ role: 'user', parts: lastParts });

    const response = await ai.models.generateContent({
      model: forceModel || effectiveApiSettings.model || 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: fullSystemInstruction + visionSystemInstruction,
        temperature: effectiveApiSettings.temperature,
        seed: Math.floor(Math.random() * 1000000),
        maxOutputTokens: 2048,
      }
    });
    responseText = response.text || "...";

    // Check for sticker generation request (same logic for Google GenAI path)
    const stickerMatch = responseText.match(/\[STICKER:\s*([^\]]+)\]/i);
    if (stickerMatch) {
      const stickerPrompt = stickerMatch[1].trim();
      if (!stickerPrompt.startsWith('http') && !stickerPrompt.startsWith('data:')) {
         try {
           const apiKey = effectiveApiSettings.apiKey || undefined || process.env.GEMINI_API_KEY as string;
           const imageUrl = await generateImage(stickerPrompt, apiKey);
           responseText = responseText.replace(stickerMatch[0], `[STICKER: ${imageUrl}]`);
         } catch (e) {
           console.error("Failed to generate sticker image:", e);
         }
      }
    }

    const imageMatch = responseText.match(/\[ACTION:IMAGE:\s*([^\]]+)\]/i);
    if (imageMatch) {
      const imagePrompt = imageMatch[1].trim();
      if (!imagePrompt.startsWith('http') && !imagePrompt.startsWith('data:')) {
         try {
           const apiKey = effectiveApiSettings.apiKey || undefined || process.env.GEMINI_API_KEY as string;
           const imageUrl = await generateImage(imagePrompt, apiKey);
           responseText = responseText.replace(imageMatch[0], `[STICKER: ${imageUrl}]`); // Reusing sticker rendering for simplicity
         } catch (e) {
           console.error("Failed to generate action image:", e);
         }
      }
    }

    return { responseText: processAiResponse(responseText), functionCalls: response.functionCalls, imageDescription: isImageTurn ? imageDescription : undefined };
  }
}

// Strip [ID: xxx] patterns and ||| separators
export function processAiResponse(responseText: string) {
  return responseText.replace(/\[ID:\s*[^\]]+\]/gi, '').replace(/\|\|\|/g, '').trim();
}

