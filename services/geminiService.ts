
import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

export const analyzeWarehouseData = async (transactions: Transaction[]) => {
  // Always use { apiKey: process.env.API_KEY } as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const summary = transactions.map(t => 
    `${t.date} | ${t.type} | 機台: ${t.machineNumber || '未標註'} | 料件: ${t.materialName}(#${t.materialNumber}) | 數量: ${t.quantity} | 金額: ${t.total}`
  ).join('\n');

  const prompt = `
    你是一位專業的倉儲數據分析專家。請根據以下本月的倉儲結算數據進行分析，數據包含日期、類別、機台編號及零件資訊：
    
    ${summary}

    請提供以下見解：
    1. 機台零件損耗趨勢：分析是否有特定機台領用零件頻率異常偏高。
    2. 料件消耗與庫存建議：觀察特定料號的領用頻率，給予下月採購策略。
    3. 成本結構與優化：針對「進貨」、「用料」與「建置」的比例進行合理性分析。
    
    請使用專業口吻並以 Markdown 格式輸出。
  `;

  try {
    // Upgraded model to gemini-3-pro-preview for complex reasoning and analysis tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    // Use .text property directly as per guidelines
    return response.text;
  } catch (error) {
    console.error("AI Analysis error:", error);
    return "分析失敗，請確認 API Key 與網路連線。";
  }
};
