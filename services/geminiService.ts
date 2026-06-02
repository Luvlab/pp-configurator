import { GoogleGenAI, Type } from "@google/genai";
import { CustomPartRequest } from "../types";

const initGenAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeCustomRequest = async (
  userDescription: string,
  projectType: string
): Promise<CustomPartRequest | null> => {
  const ai = initGenAI();
  if (!ai) return null;

  const prompt = `
    The user is requesting a custom part for a ${projectType} design project.
    Analyze the request: "${userDescription}".
    Provide a feasibility assessment, estimated cost range (single number average), and suggested materials.
    Also provide a polite response to the user.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            feasibility: { type: Type.STRING, enum: ["high", "medium", "low"] },
            estimatedCost: { type: Type.NUMBER },
            aiResponse: { type: Type.STRING },
            suggestedMaterials: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["feasibility", "estimatedCost", "aiResponse", "suggestedMaterials"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return null;
    
    return JSON.parse(jsonText) as CustomPartRequest;

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      description: userDescription,
      aiResponse: "Sorry, we couldn't process your request at this moment. Please try again.",
      feasibility: "medium",
      estimatedCost: 0
    };
  }
};
