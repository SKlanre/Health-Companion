
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, DailyStats, FoodLogEntry } from "../types";

// Support both AI Studio backend server, direct client, and external deployments like Vercel
const getClientApiKey = (): string => {
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv?.VITE_GEMINI_API_KEY) return metaEnv.VITE_GEMINI_API_KEY;
    if (metaEnv?.GEMINI_API_KEY) return metaEnv.GEMINI_API_KEY;
  } catch (e) {
    // Ignore
  }

  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
      if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
      if (process.env.API_KEY) return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore
  }

  return '';
};

let clientAiInstance: GoogleGenAI | null = null;
const getClientAi = (): GoogleGenAI => {
  const key = getClientApiKey();
  if (!key) {
    throw new Error("Gemini API key is not configured. Please ensure GEMINI_API_KEY or VITE_GEMINI_API_KEY is provided in settings.");
  }
  if (!clientAiInstance) {
    clientAiInstance = new GoogleGenAI({ apiKey: key });
  }
  return clientAiInstance;
};

// Safe JSON parser that handles markdown code fences and truncated output
function cleanAndParseJson<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    let clean = text.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    return JSON.parse(clean);
  } catch (err) {
    try {
      const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {
      // fallback
    }
    return fallback;
  }
}

const handleGenAIError = (error: any): never => {
  console.error("Gemini AI Error:", error);
  let message = error?.message || "";
  
  // If the message is a stringified JSON, try to extract the actual message
  try {
    if (message.startsWith('{')) {
      const parsed = JSON.parse(message);
      if (parsed.error && parsed.error.message) {
        message = parsed.error.message;
      }
    }
  } catch (e) {
    // Keep original message if parsing fails
  }

  if (message.includes("Failed to fetch") || error?.name === "TypeError") {
    throw new Error("Unable to reach AI service. Please check your internet connection or try again.");
  }

  // Handle Rate Limits (429)
  if (message.includes("429") || message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
    throw new Error("AI capacity reached (Rate Limit). Please wait a moment and try again.");
  }
  
  // Handle Key issues (401)
  if (message.includes("401") || message.includes("API_KEY_INVALID")) {
    throw new Error("Invalid API Key configuration. Please check your dashboard settings.");
  }

  // Handle Safety blocks
  if (message.includes("SAFETY")) {
    throw new Error("The AI could not process this content due to safety filters. Please try another image or text.");
  }
  
  // Handle 404 Missing Model
  if (message.includes("404") || message.includes("NOT_FOUND")) {
    throw new Error("The AI model requested is currently unavailable. Please try again.");
  }
  
  throw new Error(message || "An unexpected AI error occurred. Please try again later.");
};

// Generic Server-First API fetcher with graceful fallback
async function callServerApi<T>(endpoint: string, body: any): Promise<T | null> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return await res.json();
    }
    
    // If the server explicitly returned an error message
    const errData = await res.json().catch(() => null);
    if (errData && errData.error) {
      console.warn(`Server API ${endpoint} returned error:`, errData.error);
    }
  } catch (err) {
    // Server not available (e.g. static host or network error) -> trigger client fallback
    console.info(`Server route ${endpoint} not available, falling back to direct client AI...`);
  }
  return null;
}

// 1. SCAN FOOD IMAGE
export const scanFoodImage = async (base64Data: string, mode: 'quick' | 'deep' = 'deep', additionalDetails?: string) => {
  if (!base64Data) {
    throw new Error("No image data provided for food scanning.");
  }

  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data.trim();

  // Try Server API first
  const serverResult = await callServerApi<{ isFood: boolean; name: string; calories: number; analysis: string; wasFallback?: boolean }>(
    '/api/gemini/scan-food',
    { imageBase64: cleanBase64, mode, additionalDetails }
  );

  if (serverResult) {
    return serverResult;
  }

  // Fallback to direct Client SDK if configured
  const detailsPrompt = additionalDetails ? `\n\nAdditional user details or notes: "${additionalDetails}"` : "";
  const promptText = `Examine this photo carefully to determine if it contains consumable food/drinks or a non-food item.

RULES:
1. IF THE IMAGE SHOWS A NON-FOOD OBJECT (e.g. table, chair, human/person, pet, phone, laptop, room, paper, shoe, wall, empty space, hand, floor):
   - Set "isFood": false
   - Set "name": A clean label of the object (e.g., "Wooden Table", "Person", "Office Desk", "Laptop")
   - Set "calories": 0
   - Set "analysis": A friendly, user-friendly message explaining that no food or calories were detected in this photo, and that non-food items like tables or people don't have calories to check for. Suggest taking a picture of a meal or snack!

2. IF THE IMAGE SHOWS PLAIN DRINKING WATER or ice water:
   - Set "isFood": true
   - Set "name": "Plain Water"
   - Set "calories": 0
   - Set "analysis": "Drinking water has 0 calories and is essential for optimal hydration! 💧"

3. IF THE IMAGE SHOWS CONSUMABLE FOOD OR CALORIC DRINKS:
   - Set "isFood": true
   - Set "name": Specific name of the food or meal (e.g., "Grilled Chicken Salad", "Pancit Bihon with Shrimp and Sausage", "Oatmeal with Berries")
   - Set "calories": Estimated integer calorie count based on portion size and ingredients
   - Set "analysis": A brief 1-2 sentence nutritional breakdown highlighting key macros and nutrients.` + detailsPrompt;

  try {
    const key = getClientApiKey();
    if (!key) {
      // If client key is not set and server was unreachable, provide graceful fallback
      return {
        isFood: true,
        name: "Meal Photo Logged",
        calories: 420,
        analysis: "Image captured successfully. You can adjust the calorie count and meal name below.",
        wasFallback: true,
      };
    }

    const ai = getClientAi();
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
        },
      });
    } catch (e) {
      console.warn("Client AI food scan rate-limited or error:", e);
      return {
        isFood: true,
        name: "Meal Photo Logged",
        calories: 420,
        analysis: "AI traffic is currently high. Baseline nutrition estimated (~420 kcal). You can edit details anytime.",
        wasFallback: true,
      };
    }

    const parsed = cleanAndParseJson(response.text, {
      isFood: true,
      name: "Scanned Meal",
      calories: 350,
      analysis: "Estimated food item.",
    });

    return {
      isFood: typeof parsed.isFood === 'boolean' ? parsed.isFood : true,
      name: parsed.name || "Scanned Item",
      calories: typeof parsed.calories === 'number' ? parsed.calories : 0,
      analysis: parsed.analysis || "",
    };
  } catch (err) {
    console.warn("Returning resilient food scan fallback:", err);
    return {
      isFood: true,
      name: "Meal Photo Logged",
      calories: 400,
      analysis: "Photo saved! You can adjust the meal name and calorie count to match your plate.",
      wasFallback: true,
    };
  }
};

// 2. SUGGEST WORKOUT
export const suggestWorkout = async (remainingMinutes: number, profile: UserProfile | null, focusArea?: string) => {
  const serverResult = await callServerApi<{ text: string }>(
    '/api/gemini/suggest-workout',
    { remainingMinutes, profile, focusArea }
  );

  if (serverResult && serverResult.text) {
    return serverResult.text;
  }

  const envText = profile ? `They prefer to workout at ${profile.workoutEnvironment || 'anywhere'}.` : '';
  const goalText = profile ? `The user's goal is to ${profile.goal ? profile.goal.replace('_', ' ') : 'stay fit'} and they have a ${profile.activityLevel ? profile.activityLevel.replace('_', ' ') : 'moderate'} activity level. They are located in ${profile.location || 'Home'}. ${envText}` : '';
  const focusText = focusArea ? `The user wants to FOCUS on: ${focusArea}.` : '';
  
  try {
    const ai = getClientAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `The user needs to complete ${remainingMinutes} more minutes of exercise today. ${goalText} ${focusText}
Suggest a specific, effective workout activity tailored to their goal, location, and preferred environment (${profile?.workoutEnvironment || 'anywhere'}). 
If a focus area is provided, the exercises MUST primarily target that area.

Format the response using Markdown:
- Start with a catchy # Heading
- Use ## Subheadings for sections
- Provide 2-3 brief bullet points on the benefits
- List the exercises clearly.
- CRITICAL: For EVERY exercise suggested, include a link to search for it on YouTube. 
  Format as: [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+[exercise+name])
- Include a 'Pro-tip' for form in a blockquote or bold text
- Keep it motivating and punchy.`,
      config: {
        temperature: 0.8,
      },
    });
    return response.text;
  } catch (err) {
    handleGenAIError(err);
  }
};

// 3. RECOMMEND FOCUS AREA
export const recommendFocusArea = async (profile: UserProfile | null, stats: DailyStats, foodHistory: FoodLogEntry[]) => {
  if (!profile) return { area: "Full Body", reason: "Let's keep it moving with a total body session." };
  
  const goalText = `Goal: ${profile.goal ? profile.goal.replace('_', ' ') : 'fitness'}. Weight: ${profile.weight}lbs. History: ${foodHistory.length} meals logged.`;
  
  try {
    const ai = getClientAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `Based on the following data:
${goalText}
Current Day Progress: ${stats.calories}/${stats.caloriesGoal} kcal, ${stats.exercise}/${stats.exerciseGoal} mins exercise.

Recommend ONE primary body area or exercise type the user should focus on today. 
Options include: Cardio, Legs, Biceps, Triceps, Back, Chest, Shoulders, Core (Abs), or Full Body.

Provide a 1-sentence justification.

Format your response as a JSON object:
{
  "area": "Cardio | Legs | Biceps | Triceps | Back | Chest | Shoulders | Core | Full Body",
  "reason": "Brief justification"
}`,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });
    
    return cleanAndParseJson(response.text, { area: "Full Body", reason: "Total body workout for overall fitness!" });
  } catch (err) {
    console.error("Focus area recommendation fallback", err);
    return { area: "Full Body", reason: "Let's keep it moving with a total body session." };
  }
};

// 4. SUGGEST DAILY MEALS
export const suggestDailyMeals = async (remainingCalories: number, profile: UserProfile | null, totalDailyGoal: number = 2000) => {
  const serverResult = await callServerApi<any>(
    '/api/gemini/suggest-daily-meals',
    { remainingCalories, profile, totalDailyGoal }
  );

  if (serverResult) {
    return serverResult;
  }

  const goalText = profile ? `The user's goal is to ${profile.goal ? profile.goal.replace('_', ' ') : 'stay fit'}. Location: ${profile.location || 'Global'}.` : '';
  const prepText = profile ? `They usually ${profile.mealPrepStyle === 'self' ? 'cook for themselves' : profile.mealPrepStyle === 'others' ? 'have someone cook for them' : 'eat out'}. Daily budget: $${profile.dailyBudget || 20}. Fruit consumption: ${profile.fruitConsumption || 'daily'}.` : '';
  const today = new Date().toDateString();

  try {
    const ai = getClientAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `Today is ${today}. The user has ${remainingCalories} calories remaining today out of a total daily goal of ${totalDailyGoal} kcal. ${goalText} ${prepText}
Suggest a full day's meal plan including Breakfast, Lunch, Dinner, and a Snack. 

CRITICAL CALORIE RULE:
The SUM of calories for all 4 suggested meals (Breakfast + Lunch + Dinner + Snack) MUST closely equal ${remainingCalories} kcal.

Format the response as a JSON object with keys 'breakfast', 'lunch', 'dinner', and 'snacks'. 
Each value should be an object with 'content' (Markdown string) and 'calories' (integer):
- content: Use a # Heading for the meal name, bullet points for key ingredients, and one key benefit in bold.
- calories: The exact calorie count for this meal.`,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });

    return cleanAndParseJson(response.text, null);
  } catch (err) {
    handleGenAIError(err);
  }
};

// 5. SUGGEST SINGLE MEAL
export const suggestMeal = async (remainingCalories: number, profile: UserProfile | null, mealType: string = 'meal', excludeItems: string[] = [], totalDailyGoal: number = 2000) => {
  const serverResult = await callServerApi<any>(
    '/api/gemini/suggest-meal',
    { remainingCalories, profile, mealType, excludeItems, totalDailyGoal }
  );

  if (serverResult) {
    return serverResult;
  }

  const goalText = profile ? `The user's goal is to ${profile.goal ? profile.goal.replace('_', ' ') : 'stay fit'}.` : '';
  const today = new Date().toDateString();
  const excludeText = excludeItems.length > 0 ? `\n\nCRITICAL: Do NOT suggest anything similar to these previous meals: ${excludeItems.join(', ')}.` : '';
  
  const targetCalories = mealType === 'breakfast' ? totalDailyGoal * 0.25 :
                        mealType === 'lunch' ? totalDailyGoal * 0.35 :
                        mealType === 'dinner' ? totalDailyGoal * 0.30 :
                        totalDailyGoal * 0.10;

  try {
    const ai = getClientAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `Today is ${today}. The user has ${remainingCalories} calories remaining today out of a ${totalDailyGoal} kcal goal.
Suggest a healthy ${mealType} that is around ${Math.round(targetCalories)} kcal. 
${goalText} 
${excludeText}

Format the response as a JSON object:
- content: Markdown string with # Heading, bullet points, and one key benefit in bold.
- calories: The exact calorie count (integer).`,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });

    return cleanAndParseJson(response.text, null);
  } catch (err) {
    handleGenAIError(err);
  }
};

// 6. GENERATE GOAL STEPS
export const generateGoalSteps = async (profile: UserProfile, stats: DailyStats, recentLogs: FoodLogEntry[] = []) => {
  const serverResult = await callServerApi<{ text: string }>(
    '/api/gemini/goal-steps',
    { profile, stats, recentLogs }
  );

  if (serverResult && serverResult.text) {
    return serverResult.text;
  }

  const prepText = `Meal Prep: ${profile.mealPrepStyle || 'standard'}, Fruit: ${profile.fruitConsumption || 'daily'}, Budget: $${profile.dailyBudget || 20}/day.`;
  const recentFoodContext = recentLogs.length > 0 
    ? `\n\nRecent meals logged by the user include: ${recentLogs.slice(0, 5).map(l => `${l.name} (${l.calories} kcal, notes: ${l.analysis || 'none'})`).join(', ')}.`
    : "";
  
  try {
    const ai = getClientAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `The user is a ${profile.age} year old ${profile.gender} with a goal to ${profile.goal ? profile.goal.replace('_', ' ') : 'stay fit'}. 
Current stats: Weight: ${profile.weight}lbs, Height: ${profile.height}cm, Activity Level: ${profile.activityLevel ? profile.activityLevel.replace('_', ' ') : 'moderate'}.
Location: ${profile.location || 'Global'}.
Workout Environment: ${profile.workoutEnvironment || 'anywhere'}.
${prepText}${recentFoodContext}
Today's progress: ${stats.calories}/${stats.caloriesGoal} kcal, ${stats.steps}/${stats.stepsGoal} steps, ${stats.exercise}/${stats.exerciseGoal} min exercise.

Provide 3 actionable, highly specific "Next Steps" or diet advice items. 
Format using Markdown: bulleted list with emojis, bold text for key actions.`,
      config: {
        temperature: 0.8,
      },
    });
    return response.text;
  } catch (err) {
    handleGenAIError(err);
  }
};

// 7. GENERATE CHEER
export const generateCheer = async (postContent: string) => {
  const serverResult = await callServerApi<{ text: string }>(
    '/api/gemini/cheer',
    { postContent }
  );

  if (serverResult && serverResult.text) {
    return serverResult.text;
  }

  try {
    const ai = getClientAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `A fitness community member just posted: "${postContent}". Write a short, highly enthusiastic, and personalized supportive comment (max 15 words) that would make them feel like a champion. Use 1 relevant emoji.`,
      config: {
        temperature: 0.9,
      },
    });
    return response.text;
  } catch (err) {
    handleGenAIError(err);
  }
};

// 8. VOICE & TEXT MEAL PROCESSING
export const processVoiceMeal = async (transcription: string, stats: DailyStats, profile: UserProfile | null, foodLog: FoodLogEntry[] = []) => {
  const serverResult = await callServerApi<{
    intent: 'log' | 'question' | 'advice';
    response: string;
    mealName: string | null;
    calories: number;
    analysis: string;
  }>(
    '/api/gemini/voice-meal',
    { transcription, stats, profile, foodLog }
  );

  if (serverResult) {
    return serverResult;
  }

  const goalText = profile ? `The user's goal is to ${profile.goal ? profile.goal.replace('_', ' ') : 'stay fit'}.` : '';
  const recentMeals = foodLog.length > 0 
    ? `Recent meals today: ${foodLog.map(m => `${m.name} (${m.calories} kcal)`).join(', ')}.` 
    : 'No meals logged yet today.';

  try {
    const ai = getClientAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `The user said: "${transcription}". 
Evaluate the user's intent. They might be:
1. Logging a meal (e.g., "I just had a burger and fries").
2. Asking a question or seeking advice (e.g., "Is this healthy?", "What should I eat for dinner?").
3. Expressing a concern or pattern (e.g., "I've been eating too many carbs lately").

User profile: ${goalText}
Current day context: ${stats.calories}/${stats.caloriesGoal} kcal consumed.
${recentMeals}

Provide a helpful, conversational, and PROACTIVE response. 
- If they are logging a meal: Extract the info AND give a brief, supportive comment or tip related to their goal.
- If they are asking a question: Answer it thoroughly and intelligently based on their personal data and history.
- If they express a concern: Analyze their recent history (if provided) and offer constructive feedback.

CRITICAL: ALWAYS provide a conversational response in the "response" field. Do not leave it empty.

Return a JSON object:
{
  "intent": "log" | "question" | "advice",
  "response": "Conversational reply to the user (Markdown)",
  "mealName": "string (summary of items, only if logging, null otherwise)",
  "calories": number (integer, only if logging, 0 otherwise)",
  "analysis": "string (brief summary/tags for the log or key takeaway)"
}`,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });

    return cleanAndParseJson(response.text, {
      intent: "advice",
      response: "Got your message! How can I help you stay on track with your fitness goals today?",
      mealName: null,
      calories: 0,
      analysis: "Voice note received.",
    });
  } catch (err) {
    handleGenAIError(err);
  }
};

// 9. BUFFET SCAN
export const analyzeBuffet = async (base64Data: string, remainingCalories: number, profile: UserProfile | null) => {
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data.trim();

  const serverResult = await callServerApi<{
    advice: string;
    estimatedCalories: number;
    isFood?: boolean;
  }>(
    '/api/gemini/buffet',
    { imageBase64: cleanBase64, remainingCalories, profile }
  );

  if (serverResult) {
    return serverResult;
  }

  const goalText = profile ? `The user's goal is to ${profile.goal ? profile.goal.replace('_', ' ') : 'stay healthy'}.` : '';

  try {
    const ai = getClientAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: `The user is examining food and has ${remainingCalories} calories remaining for the day. ${goalText}
Analyze all available food items in the image and provide advice on what they should pick to stay on track.
Suggest a specific plate configuration.

Return a JSON object:
{
  "advice": "Markdown string with advice and specific recommendations",
  "estimatedCalories": number (integer for the suggested plate),
  "isFood": boolean (true if food items are visible, false if non-food item)
}`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    return cleanAndParseJson(response.text, {
      advice: "Scan completed. Pick lean proteins and plenty of fresh vegetables!",
      estimatedCalories: Math.min(500, remainingCalories),
      isFood: true,
    });
  } catch (err) {
    handleGenAIError(err);
  }
};
