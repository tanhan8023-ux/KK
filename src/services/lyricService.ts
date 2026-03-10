import { GoogleGenAI } from "@google/genai";
import { ApiSettings } from "../types";

export const lyricService = {
  async extractLyrics(title: string, artist: string, apiSettings: ApiSettings): Promise<string> {
    if (!apiSettings.apiKey) return "[00:00.00] 请先配置 API Key 以提取歌词";

    try {
      const ai = new GoogleGenAI({ apiKey: apiSettings.apiKey });
      const response = await ai.models.generateContent({
        model: apiSettings.model || "gemini-3-flash-preview",
        contents: `你是一个歌词提取专家。请为歌曲《${title}》 (歌手: ${artist}) 提取或生成带有时间戳的 LRC 格式歌词。
        
        要求：
        1. 必须是 LRC 格式，例如 [00:12.34] 歌词内容。
        2. 如果找不到原版歌词，请根据歌曲意境创作一段。
        3. 只返回歌词文本，不要有任何其他解释。
        4. 尽量包含前奏 [00:00.00] 准备中...`,
      });

      return response.text || "[00:00.00] 歌词提取失败";
    } catch (error) {
      console.error("Lyric extraction error:", error);
      return "[00:00.00] 歌词提取出错，请稍后再试";
    }
  }
};
