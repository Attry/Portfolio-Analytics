import { GoogleGenAI } from "@google/genai";
import { Trade } from '../types';

export const analyzePortfolio = async (trades: Trade[], query: string): Promise<string> => {
    // Check if API key is missing (for demo purposes)
    if (!process.env.API_KEY) {
        return "I can analyze your portfolio, but I need a valid API Key to connect to Gemini. Currently running in demo mode.";
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const tradeContext = JSON.stringify(trades.slice(0, 50)); // Limit context size

    const prompt = `
    You are a financial analyst assistant. Here is a JSON list of my recent trades:
    ${tradeContext}

    Please answer the following question based on this data:
    "${query}"

    Keep the answer concise, professional, and data-driven.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "I couldn't generate an analysis at this time.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Sorry, I encountered an error while analyzing your data.";
    }
};