
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, DailyStats, FoodLogEntry, WorkoutEnvironment } from "../types";

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

// Fallback generators for client-side resilience
function getClientFallbackWorkout(remainingMinutes: number, profile: UserProfile | null, focusArea?: string, environment?: WorkoutEnvironment): string {
  const mins = Math.max(10, remainingMinutes || 20);
  const targetArea = focusArea || 'Full Body';
  const env = environment || profile?.workoutEnvironment || 'home';
  const isGym = env === 'gym';
  const goal = profile?.goal ? String(profile.goal).replace('_', ' ') : 'fitness';

  if (isGym) {
    return `# 🏋️ ${mins}-Minute Gym ${targetArea} Routine

## Overview
- **Goal:** Tailored for your ${goal} journey.
- **Environment:** Gym (Weights, Barbells & Cable Machines)
- **Target Focus:** ${targetArea}
- **Equipment:** Free Weights & Commercial Gym Machines

## Workout Routine (${mins} mins)
1. **Dynamic Warm-Up (3 mins)**
   - Treadmill light incline jog or elliptical — 2 mins
   - Arm circles, rotator cuff band pull-aparts & hip openers — 1 min
   - [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+gym+dynamic+warmup)

2. **Core Training Circuit (14 mins, 3 rounds)**
   - **Dumbbell Goblet Squats or Leg Press:** 10-12 reps
     [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+dumbbell+goblet+squats)
   - **Dumbbell Flat Bench Press or Machine Chest Press:** 10-12 reps
     [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+dumbbell+bench+press)
   - **Lat Pulldown or Seated Cable Row:** 10-12 reps
     [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+lat+pulldown+proper+form)
   - **Dumbbell Overhead Shoulder Press:** 10-12 reps
     [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+dumbbell+shoulder+press)
   - **Hanging Knee Raises or Cable Woodchoppers:** 12-15 reps
     [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+hanging+knee+raises)
   - Rest 60 seconds between rounds.

3. **Cool-Down & Stretch (3 mins)**
   - Chest doorway stretch & hamstring stretch — 90s
   - Foam rolling or light walking — 90s
   - [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+post+workout+stretches)

> **Pro-tip:** Select a resistance where the final 2 reps of each set feel challenging while maintaining pristine posture, controlled eccentric tempo, and steady breathing.`;
  }

  return `# 🏠 ${mins}-Minute Home ${targetArea} Circuit

## Overview
- **Goal:** Tailored for your ${goal} journey.
- **Environment:** Home (Bodyweight / Zero Equipment)
- **Target Focus:** ${targetArea}
- **Equipment:** Bodyweight & Living Room Space

## Workout Routine (${mins} mins)
1. **Dynamic Warm-Up (3 mins)**
   - High knees & arm circles — 45s
   - Torso twists & hip openers — 45s
   - Light jumping jacks — 60s
   - [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+dynamic+warm+up+exercises)

2. **Core Interval Set (14 mins, 3 rounds)**
   - **Bodyweight Squats / Pulse Squats:** 15 reps
     [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+bodyweight+squats)
   - **Push-Ups (Standard, Incline, or Kneeling):** 10-12 reps
     [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+push+ups+proper+form)
   - **Reverse Lunges / Glute Bridges:** 12 reps per side
     [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+reverse+lunges)
   - **Plank Hold with Shoulder Taps:** 45 seconds
     [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+plank+shoulder+taps)
   - **Mountain Climbers:** 30 seconds
     [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+mountain+climbers)
   - Rest 45 seconds between rounds.

3. **Cool-Down & Stretch (3 mins)**
   - Hamstring & quad stretches — 60s
   - Child's pose / deep diaphragm breathing — 60s
   - [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+post+workout+stretches)

> **Pro-tip:** Maintain an engaged core, neutral spine, and steady nasal breathing rhythm throughout each repetition. Hydrate with water right after!`;
}

function getClientFallbackDailyMeals(remainingCalories: number) {
  const total = Math.max(1200, remainingCalories || 2000);
  const bCals = Math.round(total * 0.25);
  const lCals = Math.round(total * 0.35);
  const dCals = Math.round(total * 0.30);
  const sCals = Math.max(50, total - (bCals + lCals + dCals));

  return {
    breakfast: {
      content: `# Power Protein Oatmeal Bowl\n- 1/2 cup rolled oats cooked with unsweetened almond milk\n- 1 scoop vanilla whey or plant protein\n- 1 tbsp chia seeds & handful of fresh blueberries\n\n**Key Benefit:** Sustained morning energy and complex carbohydrates to fuel your day.`,
      calories: bCals,
    },
    lunch: {
      content: `# Mediterranean Grilled Chicken Bowl\n- 5 oz tender grilled chicken breast or seasoned tofu\n- 1/2 cup cooked quinoa with cucumber and cherry tomatoes\n- Light olive oil and lemon vinaigrette\n\n**Key Benefit:** Lean muscle synthesis combined with polyphenol-rich vegetables.`,
      calories: lCals,
    },
    dinner: {
      content: `# Pan-Seared Salmon & Roasted Sweet Potato\n- 5 oz wild salmon filet with sea salt and black pepper\n- 1 medium roasted sweet potato\n- Steamed broccoli florets with garlic\n\n**Key Benefit:** Anti-inflammatory omega-3 fatty acids that support joint health and overnight recovery.`,
      calories: dCals,
    },
    snacks: {
      content: `# Greek Yogurt & Raw Almonds\n- 3/4 cup non-fat plain Greek yogurt\n- 12-15 raw almonds and a touch of cinnamon\n\n**Key Benefit:** Slow-digesting casein protein that curbs evening sugar cravings.`,
      calories: sCals,
    },
  };
}

function getClientFallbackSingleMeal(remainingCalories: number, mealType: string, totalDailyGoal: number = 2000) {
  const type = (mealType || 'lunch').toLowerCase();
  let target = Math.round(totalDailyGoal * 0.3);
  if (type === 'breakfast') target = Math.round(totalDailyGoal * 0.25);
  if (type === 'lunch') target = Math.round(totalDailyGoal * 0.35);
  if (type === 'dinner') target = Math.round(totalDailyGoal * 0.30);
  if (type === 'snack') target = Math.round(totalDailyGoal * 0.10);
  if (remainingCalories && remainingCalories > 100) {
    target = Math.min(target, remainingCalories);
  }

  const mealPresets: Record<string, { title: string; bullets: string[]; benefit: string }> = {
    breakfast: {
      title: 'Avocado & Scrambled Egg Toast',
      bullets: ['2 organic eggs scrambled in a non-stick pan', '1 slice toasted whole grain artisan sourdough', '1/4 sliced ripe avocado with a dash of sea salt and pepper'],
      benefit: 'High in choline, clean protein, and monounsaturated healthy fats.',
    },
    lunch: {
      title: 'Lemon Herb Grilled Chicken Salad',
      bullets: ['5 oz grilled chicken breast strips', 'Mixed leafy greens, cucumbers, and cherry tomatoes', '1 tbsp extra virgin olive oil vinaigrette'],
      benefit: 'Low glycemic, fiber-rich lunch that eliminates mid-day fatigue.',
    },
    dinner: {
      title: 'Herb-Crusted Cod with Asparagus & Rice',
      bullets: ['6 oz baked white fish or cod fillet', '1/2 cup jasmine or brown rice', 'Steamed asparagus spears with lemon zest'],
      benefit: 'Lean, easily digestible protein ideal for high sleep quality.',
    },
    snack: {
      title: 'Crisp Apple & Natural Almond Butter',
      bullets: ['1 crisp gala apple sliced', '1.5 tbsp creamy natural almond butter'],
      benefit: 'Balanced natural fiber and steady energy release.',
    },
  };

  const selected = mealPresets[type] || mealPresets.lunch;
  return {
    content: `# ${selected.title}\n${selected.bullets.map((b) => `- ${b}`).join('\n')}\n\n**Key Benefit:** ${selected.benefit}`,
    calories: target,
  };
}

function getClientFallbackVoiceMeal(transcription: string) {
  const text = (transcription || '').toLowerCase();
  const calMatch = text.match(/(\d+)\s*(?:calories|calorie|cals|cal|kcal)/i);
  let calories = calMatch ? parseInt(calMatch[1], 10) : 0;

  const isQuestion = text.includes('?') || text.startsWith('how') || text.startsWith('what') || text.startsWith('should') || text.startsWith('can i');

  if (isQuestion) {
    return {
      intent: 'advice' as const,
      response: 'To reach your fitness goals, focus on balancing lean protein, complex carbs, and lots of vegetables. Prioritize hydration and consistent sleep to support recovery!',
      mealName: null,
      calories: 0,
      analysis: 'Nutrition guidance provided.',
    };
  }

  if (!calories) {
    if (text.includes('salad')) calories = 250;
    else if (text.includes('egg') || text.includes('toast')) calories = 300;
    else if (text.includes('chicken') || text.includes('rice')) calories = 450;
    else if (text.includes('burger') || text.includes('pizza')) calories = 650;
    else if (text.includes('shake') || text.includes('smoothie')) calories = 280;
    else calories = 400;
  }

  let mealName = transcription.trim();
  if (mealName.length > 50) mealName = mealName.slice(0, 47) + '...';

  return {
    intent: 'log' as const,
    response: `Logged "${mealName}" (~${calories} kcal). Keep up the great logging habit!`,
    mealName: mealName || 'Logged Meal',
    calories,
    analysis: 'Estimated from note. Tap to adjust details anytime.',
  };
}

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
      // If client key is not set and server was unreachable, prompt for manual calorie entry
      return {
        isFood: true,
        name: additionalDetails ? `Meal (${additionalDetails.slice(0, 30)})` : "Meal Photo Logged",
        calories: 0,
        analysis: "AI scanning backend is currently unreachable. Please tap to enter the meal name and calorie estimate manually.",
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
        name: additionalDetails ? `Meal (${additionalDetails.slice(0, 30)})` : "Meal Photo Logged",
        calories: 0,
        analysis: "AI scan could not complete automatically. Please enter your meal name and calories manually.",
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
      name: additionalDetails ? `Meal (${additionalDetails.slice(0, 30)})` : "Meal Photo Logged",
      calories: 0,
      analysis: "Photo saved. Please tap to enter your meal name and calorie estimate.",
      wasFallback: true,
    };
  }
};

// 2. SUGGEST WORKOUT
export const suggestWorkout = async (
  remainingMinutes: number, 
  profile: UserProfile | null, 
  focusArea?: string,
  environment?: WorkoutEnvironment
) => {
  const activeEnv = (environment || profile?.workoutEnvironment || 'home').toLowerCase() as WorkoutEnvironment;
  const isGym = activeEnv === 'gym';
  const targetArea = focusArea || 'Full Body';

  const serverResult = await callServerApi<{ text: string }>(
    '/api/gemini/suggest-workout',
    { remainingMinutes, profile, focusArea: targetArea, environment: activeEnv }
  );

  if (serverResult && serverResult.text) {
    return serverResult.text;
  }

  const envInstructions = isGym
    ? `WORKOUT LOCATION: GYM. Recommend exercises utilizing commercial gym equipment (dumbbells, barbells, cable machines, benches, weight machines) with recommended sets and reps.`
    : `WORKOUT LOCATION: HOME. Strictly recommend exercises that can be performed at home with bodyweight, calisthenics, or minimal household items. DO NOT suggest gym machines or heavy barbells.`;

  const goalText = profile 
    ? `The user's goal is to ${profile.goal ? profile.goal.replace('_', ' ') : 'stay fit'} and they have a ${profile.activityLevel ? profile.activityLevel.replace('_', ' ') : 'moderate'} activity level. Location: ${profile.location || 'Home'}.`
    : '';
  
  try {
    const ai = getClientAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `The user needs a ${remainingMinutes || 20}-minute ${targetArea} workout.
${goalText}
${envInstructions}
Target Muscle Focus: ${targetArea}

Tailor the volume, intensity, and exercise selection strictly to their goal (${profile?.goal || 'fitness'}) and the ${isGym ? 'GYM' : 'HOME'} environment.

Format the response using Markdown:
- Start with an inspiring # Heading (e.g. # 🏋️ ${remainingMinutes || 20}-Min Gym ${targetArea} Session or # 🏠 ${remainingMinutes || 20}-Min Home ${targetArea} Circuit)
- Use ## Subheadings for sections
- ## Overview: 2-3 brief bullet points on the benefits and equipment
- ## Workout Routine (${remainingMinutes || 20} mins):
  Warm-up, Core workout with reps/sets, and Cool-down.
- CRITICAL: For EVERY exercise suggested, include a link to search for it on YouTube:
  [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+[exercise+name])
- Include a bold > **Pro-tip:** for form and safety in ${activeEnv}.
- Keep it motivating and punchy.`,
      config: {
        temperature: 0.8,
      },
    });
    return response.text || getClientFallbackWorkout(remainingMinutes, profile, targetArea, activeEnv);
  } catch (err) {
    console.warn("Client suggestWorkout fallback:", err);
    return getClientFallbackWorkout(remainingMinutes, profile, targetArea, activeEnv);
  }
};

// 3. RECOMMEND FOCUS AREA
export const recommendFocusArea = async (profile: UserProfile | null, stats: DailyStats, foodHistory: FoodLogEntry[]) => {
  if (!profile) return { area: "Full Body", reason: "Let's keep it moving with a total body session." };

  const serverResult = await callServerApi<{ area: string; reason: string }>(
    '/api/gemini/recommend-focus-area',
    { profile, stats, foodHistory }
  );
  if (serverResult && serverResult.area) {
    return serverResult;
  }
  
  const goalText = `Goal: ${profile.goal ? profile.goal.replace('_', ' ') : 'fitness'}. Weight: ${profile.weight}lbs. History: ${foodHistory.length} meals logged.`;
  
  try {
    const ai = getClientAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
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
    console.warn("Focus area recommendation fallback", err);
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
      model: 'gemini-3.1-flash-lite',
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

    return cleanAndParseJson(response.text, getClientFallbackDailyMeals(remainingCalories));
  } catch (err) {
    console.warn("Client suggestDailyMeals fallback:", err);
    return getClientFallbackDailyMeals(remainingCalories);
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
      model: 'gemini-3.1-flash-lite',
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

    return cleanAndParseJson(response.text, getClientFallbackSingleMeal(remainingCalories, mealType, totalDailyGoal));
  } catch (err) {
    console.warn("Client suggestMeal fallback:", err);
    return getClientFallbackSingleMeal(remainingCalories, mealType, totalDailyGoal);
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
      model: 'gemini-3.1-flash-lite',
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
    console.warn("Client goal steps fallback:", err);
    return `### 🎯 Your Top 3 Next Steps Today\n\n1. **Hydration First 💧**\nDrink a large glass of water now to sustain your energy.\n\n2. **Active Move 🏃‍♂️**\nHit a 15-minute brisk walk or quick bodyweight set.\n\n3. **Balanced Fuel 🥗**\nFocus your next meal on high-protein, fibrous whole foods!`;
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
      model: 'gemini-3.1-flash-lite',
      contents: `A fitness community member just posted: "${postContent}". Write a short, highly enthusiastic, and personalized supportive comment (max 15 words) that would make them feel like a champion. Use 1 relevant emoji.`,
      config: {
        temperature: 0.9,
      },
    });
    return response.text || "Keep up the fantastic momentum, you're crushing your fitness goals! 🔥";
  } catch (err) {
    console.warn("Client cheer fallback:", err);
    return "Keep up the fantastic momentum, you're crushing your fitness goals! 🔥";
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
      model: 'gemini-3.1-flash-lite',
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

    return cleanAndParseJson(response.text, getClientFallbackVoiceMeal(transcription));
  } catch (err) {
    console.warn("Client voice meal fallback:", err);
    return getClientFallbackVoiceMeal(transcription);
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
      model: 'gemini-3.1-flash-lite',
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
      advice: "Scan completed. Fill half your plate with colorful veggies and choose lean grilled proteins!",
      estimatedCalories: Math.min(500, remainingCalories),
      isFood: true,
    });
  } catch (err) {
    console.warn("Client buffet scan fallback:", err);
    return {
      advice: "Scan completed. Focus on lean protein options (chicken, fish, eggs, tofu) and fresh fiber-rich vegetables to stay within your calorie limit!",
      estimatedCalories: Math.min(500, remainingCalories),
      isFood: true,
    };
  }
};
