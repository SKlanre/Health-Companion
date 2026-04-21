
import { GoogleGenAI, Type, ThinkingLevel, Modality } from "@google/genai";
import { UserProfile, DailyStats, FoodLogEntry } from "../types";

// Support both AI Studio environment and external deployments like Vercel
const getApiKey = () => {
  return process.env.GEMINI_API_KEY || 
         process.env.API_KEY;
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

// Helper to check if API key is configured
const ensureApiKey = () => {
  if (!apiKey) {
    throw new Error("API key is missing. For Vercel, please provide VITE_GEMINI_API_KEY in Environment Variables and redeploy.");
  }
};

export const suggestWorkout = async (remainingMinutes: number, profile: UserProfile | null) => {
  ensureApiKey();
  const envText = profile ? `They prefer to workout at ${profile.workoutEnvironment}.` : '';
  const goalText = profile ? `The user's goal is to ${profile.goal.replace('_', ' ')} and they have a ${profile.activityLevel.replace('_', ' ')} activity level. They are located in ${profile.location}. ${envText}` : '';
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `The user needs to complete ${remainingMinutes} more minutes of exercise today. ${goalText} Suggest a specific, effective workout activity tailored to their goal, location, and preferred environment (${profile?.workoutEnvironment || 'anywhere'}). 

    Format the response using Markdown:
    - Start with a catchy # Heading
    - Use ## Subheadings for sections
    - Provide 2-3 brief bullet points on the benefits
    - Include a 'Pro-tip' for form in a blockquote or bold text
    - Keep it motivating and punchy.`,
    config: {
      temperature: 0.8,
    },
  });
  return response.text;
};

export const suggestDailyMeals = async (remainingCalories: number, profile: UserProfile | null, totalDailyGoal: number = 2000) => {
  ensureApiKey();
  const goalText = profile ? `The user's goal is to ${profile.goal.replace('_', ' ')}. They are located in ${profile.location}.` : '';
  const prepText = profile ? `They usually ${profile.mealPrepStyle === 'self' ? 'cook for themselves' : profile.mealPrepStyle === 'others' ? 'have someone cook for them' : 'eat out'}. Their daily food budget is around $${profile.dailyBudget}. They eat fruits ${profile.fruitConsumption}.` : '';
  const today = new Date().toDateString();
  const highCalorieAlert = remainingCalories > 2800 ? "\n\nALERT: The user has a VERY HIGH calorie requirement. You MUST suggest HEAVY, CALORIE-DENSE meals. Standard healthy portions will NOT be enough. Use calorie-dense healthy fats (avocados, nuts, seeds, oils) and larger portions to reach the target." : "";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Today is ${today}. The user has ${remainingCalories} calories remaining today out of a total daily goal of ${totalDailyGoal} kcal. ${goalText} ${prepText} ${highCalorieAlert}
    Suggest a full day's meal plan including Breakfast, Lunch, Dinner, and a Snack. 
    
    CRITICAL CALORIE RULE:
    The SUM of calories for all 4 suggested meals (Breakfast + Lunch + Dinner + Snack) MUST exactly equal ${remainingCalories} kcal. 
    This is non-negotiable. If the user has a high calorie goal (like 3000+ kcal), you MUST suggest large portions, calorie-dense healthy fats (avocados, nuts, olive oil), and hearty grains. Do NOT suggest light meals that don't meet the energy requirement.
    
    Suggested distribution of the REMAINING ${remainingCalories} kcal:
    - Breakfast: ~25% (${Math.round(remainingCalories * 0.25)} kcal)
    - Lunch: ~35% (${Math.round(remainingCalories * 0.35)} kcal)
    - Dinner: ~30% (${Math.round(remainingCalories * 0.30)} kcal)
    - Snack: ~10% (${Math.round(remainingCalories * 0.10)} kcal)
    
    STRICT VARIETY RULES (MANDATORY):
    1. PROTEIN VARIETY: Use a different primary protein source for EVERY meal (e.g., Eggs for breakfast, Chicken for lunch, Fish for dinner, Nuts for snack). NEVER repeat a protein source.
    2. CUISINE VARIETY: Each meal should ideally feel like a different cuisine (e.g., Mediterranean breakfast, Asian-inspired lunch, Mexican-style dinner).
    3. COOKING METHOD: Vary the preparation (e.g., one raw/salad, one roasted, one sautéed). Do NOT use the same method for all.
    4. TEXTURE & COLOR: Ensure a mix of textures (crunchy, soft, fresh) and vibrant colors across the day.
    5. NO REPETITION: Do NOT suggest the same base ingredients (like rice, bread, or potatoes) for more than one meal.
    6. UNIQUE FOR TODAY: Ensure the plan is unique for today (${today}).

    Format the response as a JSON object with keys 'breakfast', 'lunch', 'dinner', and 'snacks'. 
    Each value should be an object with 'content' (Markdown string) and 'calories' (integer):
    - content: Use a # Heading for the meal name, bullet points for key ingredients, and one key benefit in bold.
    - calories: The exact calorie count for this meal.
    
    CRITICAL: The sum of the 'calories' fields MUST be exactly ${remainingCalories}.`,
    config: {
      temperature: 0.7,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          breakfast: { 
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING },
              calories: { type: Type.INTEGER },
            },
            required: ["content", "calories"],
          },
          lunch: { 
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING },
              calories: { type: Type.INTEGER },
            },
            required: ["content", "calories"],
          },
          dinner: { 
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING },
              calories: { type: Type.INTEGER },
            },
            required: ["content", "calories"],
          },
          snacks: { 
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING },
              calories: { type: Type.INTEGER },
            },
            required: ["content", "calories"],
          },
        },
        required: ["breakfast", "lunch", "dinner", "snacks"],
      },
    },
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Failed to parse AI daily meals response", e);
    return null;
  }
};

export const suggestMeal = async (remainingCalories: number, profile: UserProfile | null, mealType: string = 'meal', excludeItems: string[] = [], totalDailyGoal: number = 2000) => {
  ensureApiKey();
  const goalText = profile ? `The user's goal is to ${profile.goal.replace('_', ' ')}. They are located in ${profile.location}.` : '';
  const prepText = profile ? `They usually ${profile.mealPrepStyle === 'self' ? 'cook for themselves' : profile.mealPrepStyle === 'others' ? 'have someone cook for them' : 'eat out'}. Their daily food budget is around ${profile.dailyBudget}. They eat fruits ${profile.fruitConsumption}.` : '';
  const today = new Date().toDateString();
  const excludeText = excludeItems.length > 0 ? `\n\nCRITICAL: Do NOT suggest anything similar to these previous meals: ${excludeItems.join(', ')}.` : '';
  const highCalorieAlert = totalDailyGoal > 2800 ? `\n\nALERT: The user has a HIGH daily calorie goal of ${totalDailyGoal} kcal. This specific ${mealType} should be calorie-dense to help them reach it.` : '';
  
  const targetCalories = mealType === 'breakfast' ? totalDailyGoal * 0.25 :
                        mealType === 'lunch' ? totalDailyGoal * 0.35 :
                        mealType === 'dinner' ? totalDailyGoal * 0.30 :
                        totalDailyGoal * 0.10; // snacks

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Today is ${today}. The user has ${remainingCalories} calories remaining today out of a ${totalDailyGoal} kcal goal. ${highCalorieAlert}
    Suggest a healthy ${mealType} that is EXACTLY ${Math.round(targetCalories)} kcal. 
    ${goalText} ${prepText} 
    
    CRITICAL: 
    1. Ensure the suggestion is unique for today (${today}).
    2. Provide a creative and appetizing option that differs from standard repetitive fitness meals.
    3. Focus on variety in ingredients.${excludeText}
    4. The calorie count MUST be EXACTLY ${Math.round(targetCalories)} kcal. If this is a high number, suggest calorie-dense healthy ingredients and larger portions.

    Format the response as a JSON object:
    - content: Markdown string with # Heading, bullet points, and one key benefit in bold.
    - calories: The exact calorie count (integer).`,
    config: {
      temperature: 0.7,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          calories: { type: Type.INTEGER },
        },
        required: ["content", "calories"],
      },
    },
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Failed to parse AI meal suggestion", e);
    return null;
  }
};

export const generateGoalSteps = async (profile: UserProfile, stats: DailyStats, recentLogs: FoodLogEntry[] = []) => {
  ensureApiKey();
  const prepText = `Meal Prep: ${profile.mealPrepStyle}, Fruit: ${profile.fruitConsumption}, Budget: $${profile.dailyBudget}/day.`;
  const recentFoodContext = recentLogs.length > 0 
    ? `\n\nRecent meals logged by the user include: ${recentLogs.slice(0, 5).map(l => `${l.name} (${l.calories} kcal, notes: ${l.analysis || 'none'})`).join(', ')}.`
    : "";
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `The user is a ${profile.age} year old ${profile.gender} with a goal to ${profile.goal.replace('_', ' ')}. 
    Current stats: Weight: ${profile.weight}lbs, Height: ${profile.height}cm, Activity Level: ${profile.activityLevel.replace('_', ' ')}.
    Location: ${profile.location}.
    Workout Environment: ${profile.workoutEnvironment}.
    ${prepText}${recentFoodContext}
    Today's progress: ${stats.calories}/${stats.caloriesGoal} kcal, ${stats.steps}/${stats.stepsGoal} steps, ${stats.exercise}/${stats.exerciseGoal} min exercise.
    
    Provide 3 actionable, highly specific "Next Steps" or diet advice items. 
    CRITICAL: Analyze the user's recent meals if provided. Look for patterns (e.g., too much soda, too many carbs, lack of protein, not enough fruits). Mention these patterns and advise how to adjust.
    Keep it motivating and punchy.

    Format the response using Markdown:
    - Use a bulleted list with emojis
    - Keep each point brief and punchy
    - Use bold text for emphasis on key actions.`,
    config: {
      temperature: 0.8,
    },
  });
  return response.text;
};

export const generateCheer = async (postContent: string) => {
  ensureApiKey();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `A fitness community member just posted: "${postContent}". Write a short, highly enthusiastic, and personalized supportive comment (max 15 words) that would make them feel like a champion. Use 1 relevant emoji.`,
    config: {
      temperature: 0.9,
    },
  });
  return response.text;
};

export const scanFoodImage = async (base64Data: string, mode: 'quick' | 'deep' = 'quick', additionalDetails?: string) => {
  ensureApiKey();
  const isDeep = mode === 'deep';
  const detailsPrompt = additionalDetails ? `\n\nAdditional user details to consider: "${additionalDetails}"` : "";
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        },
        {
          text: (isDeep 
            ? "Perform a detailed analysis of the food in this image. Consider portion sizes, ingredients, and preparation methods. Estimate calories as accurately as possible. Also provide a brief 1-sentence analysis of the nutritional quality (e.g. 'High in sugar', 'Good protein source'). Return JSON: {'name': string, 'calories': int, 'analysis': string}"
            : "Identify food and estimate calories quickly. Also provide a brief 1-sentence analysis. Return JSON: {'name': string, 'calories': int, 'analysis': string}") + detailsPrompt,
        },
      ],
    },
    config: {
      thinkingConfig: { thinkingLevel: isDeep ? ThinkingLevel.LOW : ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          calories: { type: Type.INTEGER },
          analysis: { type: Type.STRING },
        },
        required: ["name", "calories", "analysis"],
      },
    },
  });

    try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Failed to parse AI food scan response", e);
    return null;
  }
};

export const processVoiceMeal = async (transcription: string, stats: DailyStats, profile: UserProfile | null, foodLog: FoodLogEntry[] = []) => {
  ensureApiKey();
  const goalText = profile ? `The user's goal is to ${profile.goal.replace('_', ' ')}.` : '';
  const recentMeals = foodLog.length > 0 
    ? `Recent meals today: ${foodLog.map(m => `${m.name} (${m.calories} kcal)`).join(', ')}.` 
    : 'No meals logged yet today.';

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `The user said: "${transcription}". 
    Evaluate the user's intent. They might be:
    1. Logging a meal (e.g., "I just had a burger").
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
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING, enum: ["log", "question", "advice"] },
          response: { type: Type.STRING },
          mealName: { type: Type.STRING, nullable: true },
          calories: { type: Type.INTEGER },
          analysis: { type: Type.STRING },
        },
        required: ["intent", "response", "calories", "analysis"],
      },
    },
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Failed to parse AI voice meal response", e);
    return null;
  }
};

export const analyzeBuffet = async (base64Data: string, remainingCalories: number, profile: UserProfile | null) => {
  ensureApiKey();
  const goalText = profile ? `The user's goal is to ${profile.goal.replace('_', ' ')}.` : '';
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        },
        {
          text: `The user is at a buffet and has ${remainingCalories} calories remaining for the day. ${goalText}
          Analyze all available food items in the image and provide advice on what they should pick to stay on track.
          Suggest a specific plate configuration.
          
          Return a JSON object:
          {
            "advice": "Markdown string with advice and specific recommendations",
            "estimatedCalories": number (integer for the suggested plate)
          }`
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          advice: { type: Type.STRING },
          estimatedCalories: { type: Type.INTEGER },
        },
        required: ["advice", "estimatedCalories"],
      },
    },
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Failed to parse AI buffet analysis response", e);
    return null;
  }
};

export const generateSpeech = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say naturally but with a supportive tone: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Kore' is a natural supportive voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Speech generation failed:", error);
    return null;
  }
};
