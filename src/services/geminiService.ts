import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeFitnessData(data: any, goals: any) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the following fitness data from an Apple Watch and compare it against the user's goals.
    
    User Goals:
    - Daily Steps: ${goals.steps}
    - Daily Calories: ${goals.calories}
    - Workouts per week: ${goals.workoutsPerWeek}
    
    Fitness Data (Last 30 Days):
    ${JSON.stringify(data.dailyStats)}
    
    Recent Workouts:
    ${JSON.stringify(data.workouts)}
    
    Please provide:
    1. A summary of their progress (are they hitting goals?).
    2. Specific insights on trends (e.g., "You're more active on weekends").
    3. Actionable advice to improve or maintain their fitness.
    4. A "Fitness Score" out of 100 based on their consistency.
    
    Format the response in Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Failed to generate AI analysis. Please try again later.";
  }
}
