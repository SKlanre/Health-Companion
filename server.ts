import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { getCurrencyForLocation, getCurrencyPromptGuidance } from './src/lib/currencies.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gemini Client initialization helper
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets or Vercel Environment Variables.');
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Recommended valid Gemini models: gemini-3.1-flash-lite (fresh quota) -> gemini-flash-latest (gemini-3.8-flash)
const AI_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];

// Multi-model retry and backoff helper
async function generateContentWithRetryAndFallback(
  ai: GoogleGenAI,
  models: string[],
  requestConfig: any,
  maxRetriesPerModel: number = 1
) {
  let lastError: any = null;
  for (const model of models) {
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...requestConfig,
          model,
        });
        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '').toLowerCase();
        const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('rate limit') || msg.includes('too many requests');
        const isTransient = msg.includes('503') || msg.includes('unavailable') || msg.includes('overloaded') || msg.includes('fetch') || msg.includes('network');

        console.warn(`[Gemini API] Model '${model}' attempt ${attempt + 1} failed: ${err?.message}`);

        // If it's a 429 quota exhaustion on this model, retrying the same model will fail.
        // Immediately try the next model in the fallback list!
        if (isRateLimit) {
          break;
        }

        if (isTransient && attempt < maxRetriesPerModel) {
          const delay = (attempt + 1) * 800 + Math.random() * 400;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        break; // Try next model in fallback list
      }
    }
  }
  throw lastError;
}

// JSON cleaner & parser for AI output
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

// Smart offline & quota fallback generators
function generateFallbackWorkout(remainingMinutes: number, profile: any, focusArea?: string, environment?: string): string {
  const mins = Math.max(10, remainingMinutes || 20);
  const targetArea = focusArea || 'Full Body';
  const env = (environment || profile?.workoutEnvironment || 'home').toLowerCase();
  const isGym = env === 'gym';
  const goal = profile?.goal ? String(profile.goal).replace('_', ' ') : 'fitness';

  if (isGym) {
    return `# 🏋️ ${mins}-Minute Gym ${targetArea} Routine

## Overview
- **Goal:** Targeted ${goal} conditioning.
- **Environment:** Gym (Barbells, Dumbbells & Cable Stations)
- **Target Area:** ${targetArea}
- **Equipment:** Free Weights & Machines

## Workout Routine (${mins} mins)
1. **Dynamic Warm-Up (3 mins)**
   - Treadmill light jog or elliptical — 2 mins
   - Arm circles, rotator cuff band work & hip openers — 1 min
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

3. **Cool-Down & Recovery (3 mins)**
   - Chest doorway stretch & hamstring stretch — 90s
   - Foam rolling or light walking — 90s
   - [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+post+workout+stretches)

> **Pro-tip:** Select a resistance where the final 2 reps of each set feel challenging while maintaining pristine posture, controlled eccentric tempo, and steady breathing.`;
  }

  return `# 🏠 ${mins}-Minute Home ${targetArea} Circuit

## Overview
- **Goal:** Customized for your ${goal} target.
- **Environment:** Home (Bodyweight / No Equipment Needed)
- **Target Area:** ${targetArea}
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

3. **Cool-Down & Recovery (3 mins)**
   - Hamstring & quad stretches — 60s
   - Child's pose / deep diaphragm breathing — 60s
   - [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+post+workout+stretches)

> **Pro-tip:** Maintain an engaged core, neutral spine, and steady nasal breathing rhythm throughout each repetition. Hydrate with water right after!`;
}

function generateFallbackFocusArea(profile: any, stats: any): { area: string; reason: string } {
  const goal = profile?.goal || 'maintain';
  if (goal === 'gain_muscle') {
    return { area: "Chest", reason: "Targeting chest and upper body strength to support your muscle-building progress today." };
  } else if (goal === 'lose_weight') {
    return { area: "Cardio", reason: "Elevate calorie burn and metabolic rate with focused cardiovascular conditioning today." };
  }
  return { area: "Full Body", reason: "A balanced full-body conditioning session to keep momentum high and feel energized." };
}

function generateFallbackDailyMeals(remainingCalories: number, profile: any) {
  const total = Math.max(1200, remainingCalories || 2000);
  const bCals = Math.round(total * 0.25);
  const lCals = Math.round(total * 0.35);
  const dCals = Math.round(total * 0.30);
  const sCals = Math.max(50, total - (bCals + lCals + dCals));

  const currency = getCurrencyForLocation(profile?.location || '', profile?.currency);

  // Country-specific meal presets with authentic regional ingredients and local currency costs
  if (currency.code === 'NGN') {
    return {
      breakfast: {
        content: `# Boiled Yam & Garden Egg Stew\n- 3 slices boiled white yam\n- Scrambled egg and garden egg stew with onions, tomatoes, and peppers\n- Est. cost: ~${currency.symbol}1,500\n\n**Key Benefit:** Sustained complex carbohydrates paired with choline and clean protein for a focused morning.`,
        calories: bCals,
      },
      lunch: {
        content: `# Smoky Jollof Rice with Grilled Chicken & Dodo\n- Savory long-grain jollof rice cooked in rich pepper-tomato broth\n- 1 spiced grilled chicken breast\n- Steamed cabbage and baked sweet plantain\n- Est. cost: ~${currency.symbol}2,500\n\n**Key Benefit:** High-protein muscle recovery paired with vibrant lycopene and complex energy.`,
        calories: lCals,
      },
      dinner: {
        content: `# Fresh Catfish Pepper Soup with Unripe Plantain\n- Simmered fresh catfish in aromatic uziza and uda pepper broth\n- 1 sliced boiled green plantain\n- Est. cost: ~${currency.symbol}2,000\n\n**Key Benefit:** Anti-inflammatory native herbs and omega-3 fatty acids that promote light digestion before sleep.`,
        calories: dCals,
      },
      snacks: {
        content: `# Roasted Plantain (Boli) with Crunchy Groundnuts\n- Half portion roasted ripe plantain\n- Handful of unsalted roasted Nigerian groundnuts\n- Est. cost: ~${currency.symbol}500\n\n**Key Benefit:** Healthy plant fats and dietary fiber that stabilize late afternoon blood sugar.`,
        calories: sCals,
      },
    };
  }

  if (currency.code === 'GHS') {
    return {
      breakfast: {
        content: `# Hausa Koko with Koose & Boiled Egg\n- Warm spiced millet porridge (Hausa koko) with ginger and cloves\n- 3 crispy bean cakes (koose) and 1 hard-boiled egg\n- Est. cost: ~${currency.symbol}20\n\n**Key Benefit:** Probiotic gut support and sustained low-glycemic morning energy from whole millet.`,
        calories: bCals,
      },
      lunch: {
        content: `# Ghanaian Jollof with Grilled Tilapia & Shito\n- Fragrant Ghanaian jollof rice simmered in savory tomato-onion sauce\n- Half grilled fresh tilapia with lime and herbs\n- Dash of authentic shito and fresh cucumber salad\n- Est. cost: ~${currency.symbol}45\n\n**Key Benefit:** High-grade lean marine protein rich in phosphorus and omega-3 fatty acids.`,
        calories: lCals,
      },
      dinner: {
        content: `# Kontomire Stew with Boiled Yam & Sweet Plantain\n- Nutrient-dense cocoyam leaf (kontomire) stew with agushie melon seeds and smoked fish\n- Boiled yam and ripe plantain cubes\n- Est. cost: ~${currency.symbol}30\n\n**Key Benefit:** Exceptional plant-based iron, folate, and magnesium for cellular restoration.`,
        calories: dCals,
      },
      snacks: {
        content: `# Spicy Baked Kelewele with Roasted Peanuts\n- Ginger and cayenne spiced ripe plantain bites\n- Small handful of crunchy roasted peanuts\n- Est. cost: ~${currency.symbol}10\n\n**Key Benefit:** Potassium and heart-healthy monounsaturated fats that satisfy cravings.`,
        calories: sCals,
      },
    };
  }

  if (currency.code === 'GBP') {
    return {
      breakfast: {
        content: `# Scottish Porridge with Blueberries & Honey\n- 1/2 cup rolled jumbo Scottish oats in semi-skimmed or oat milk\n- 1 scoop whey or hemp protein, fresh blueberries, and raw honey\n- Est. cost: ~${currency.symbol}2.50\n\n**Key Benefit:** Heart-healthy beta-glucan fiber and steady slow-release glucose.`,
        calories: bCals,
      },
      lunch: {
        content: `# Jacket Potato with Tuna Sweetcorn & Herb Salad\n- 1 medium crisp-skinned baked potato\n- Skipjack tuna flakes with sweetcorn and light Greek yogurt dressing\n- Mixed baby greens and cucumber\n- Est. cost: ~${currency.symbol}4.50\n\n**Key Benefit:** Lean bioavailable protein with potassium and gut-friendly prebiotic fiber.`,
        calories: lCals,
      },
      dinner: {
        content: `# Pan-Roasted Salmon with Crushed New Potatoes\n- 5 oz pan-seared salmon fillet with sea salt and black pepper\n- Steamed baby new potatoes with dill\n- Steamed tenderstem broccoli and garden peas\n- Est. cost: ~${currency.symbol}6.50\n\n**Key Benefit:** Essential EPA/DHA fatty acids supporting joint mobility and overnight recovery.`,
        calories: dCals,
      },
      snacks: {
        content: `# Crisp English Apple with Cheddar or Almonds\n- 1 sliced Cox or Gala apple\n- Small wedge of mature cheddar or a handful of raw almonds\n- Est. cost: ~${currency.symbol}1.50\n\n**Key Benefit:** Pectin fiber and slow-digesting healthy fats that curb evening snacking.`,
        calories: sCals,
      },
    };
  }

  if (currency.code === 'EUR') {
    return {
      breakfast: {
        content: `# Mediterranean Herb & Feta Frittata\n- 2 organic eggs whisked with baby spinach, cherry tomatoes, and crumbled feta\n- 1 slice toasted artisan sourdough drizzled with extra virgin olive oil\n- Est. cost: ~${currency.symbol}3.00\n\n**Key Benefit:** High choline, vitamin K, and polyphenol antioxidants for clear mental focus.`,
        calories: bCals,
      },
      lunch: {
        content: `# Pan-Seared Chicken Paillard with Quinoa Tabbouleh\n- Tender grilled chicken breast with lemon and rosemary\n- 1/2 cup quinoa salad with flat-leaf parsley, cucumber, and tomatoes\n- Est. cost: ~${currency.symbol}6.50\n\n**Key Benefit:** Complete essential amino acids and anti-inflammatory phytonutrients.`,
        calories: lCals,
      },
      dinner: {
        content: `# Baked Cod Fillet with Roasted Provençal Vegetables\n- Fresh white cod fillet baked with oregano, garlic, and capers\n- Roasted courgettes, bell peppers, and baby potatoes\n- Est. cost: ~${currency.symbol}8.00\n\n**Key Benefit:** Light, easily digestible lean protein that promotes deep, restful sleep.`,
        calories: dCals,
      },
      snacks: {
        content: `# Greek Yogurt with Walnuts & Thyme Honey\n- 3/4 cup authentic strained Greek yogurt\n- Handful of walnut halves and a drizzle of local honey\n- Est. cost: ~${currency.symbol}2.00\n\n**Key Benefit:** Slow-release casein protein and plant omega-3 ALA.`,
        calories: sCals,
      },
    };
  }

  // Default (US / Global)
  return {
    breakfast: {
      content: `# Power Protein Oatmeal Bowl\n- 1/2 cup rolled oats cooked with almond milk\n- 1 scoop vanilla whey or plant protein\n- 1 tbsp chia seeds & fresh berries\n- Est. cost: ~${currency.symbol}3.50\n\n**Key Benefit:** Sustained morning energy and complex carbohydrates to kickstart your metabolism.`,
      calories: bCals,
    },
    lunch: {
      content: `# Grilled Chicken & Quinoa Harvest Bowl\n- 5 oz tender grilled chicken breast (or pan-seared tofu)\n- 1/2 cup fluffy quinoa\n- Steamed broccoli, roasted bell peppers, and avocado drizzle\n- Est. cost: ~${currency.symbol}7.50\n\n**Key Benefit:** High-protein muscle support combined with micronutrient-rich fiber.`,
      calories: lCals,
    },
    dinner: {
      content: `# Pan-Seared Salmon with Sweet Potato\n- 5 oz omega-rich wild salmon filet\n- 1 medium roasted sweet potato with olive oil\n- Large side of sautéed garlic spinach\n- Est. cost: ~${currency.symbol}9.00\n\n**Key Benefit:** Healthy omega-3 fats and slow-digesting complex carbs for nighttime muscle repair.`,
      calories: dCals,
    },
    snacks: {
      content: `# Greek Yogurt & Almond Energy Crunch\n- 3/4 cup plain non-fat Greek yogurt\n- Handful of raw almonds and a touch of honey\n- Est. cost: ~${currency.symbol}2.00\n\n**Key Benefit:** High casein protein to curb sweet cravings and keep you full.`,
      calories: sCals,
    },
  };
}

function generateFallbackSingleMeal(remainingCalories: number, mealType: string, totalDailyGoal: number = 2000, profile: any = null) {
  const type = (mealType || 'lunch').toLowerCase();
  let target = Math.round(totalDailyGoal * 0.3);
  if (type === 'breakfast') target = Math.round(totalDailyGoal * 0.25);
  if (type === 'lunch') target = Math.round(totalDailyGoal * 0.35);
  if (type === 'dinner') target = Math.round(totalDailyGoal * 0.30);
  if (type === 'snack') target = Math.round(totalDailyGoal * 0.10);
  if (remainingCalories && remainingCalories > 100) {
    target = Math.min(target, remainingCalories);
  }

  const currency = getCurrencyForLocation(profile?.location || '', profile?.currency);

  // Regional single meal recommendations
  if (currency.code === 'NGN') {
    const presets: Record<string, { title: string; bullets: string[]; benefit: string; cost: string }> = {
      breakfast: {
        title: 'Boiled Yam & Egg Sauce with Garden Eggs',
        bullets: ['3 slices tender boiled white yam', 'Scrambled eggs simmered with chopped tomatoes, onions, and garden eggs', 'Light touch of healthy vegetable oil'],
        benefit: 'Rich complex carbohydrates and clean protein for sustained focus.',
        cost: `~${currency.symbol}1,500`,
      },
      lunch: {
        title: 'Authentic Smoky Jollof Rice with Grilled Chicken',
        bullets: ['Long-grain parboiled rice cooked in savory tomato-pepper paste', '1 seasoned grilled chicken quarter', 'Side of steamed cabbage, carrots, and baked plantain'],
        benefit: 'Optimal protein-to-carb ratio for midday physical stamina and recovery.',
        cost: `~${currency.symbol}2,500`,
      },
      dinner: {
        title: 'Light Fresh Fish Pepper Soup with Plantain',
        bullets: ['Fresh simmered catfish in aromatic uziza and uda pepper broth', '1 boiled unripe green plantain sliced'],
        benefit: 'Digestive-friendly anti-inflammatory native broth and sleep-promoting omega-3s.',
        cost: `~${currency.symbol}2,000`,
      },
      snack: {
        title: 'Roasted Boli with Crunchy Groundnuts',
        bullets: ['Half piece roasted ripe plantain', 'Small handful of roasted unsalted groundnuts'],
        benefit: 'Heart-healthy unsaturated fats and slow-burning natural fiber.',
        cost: `~${currency.symbol}500`,
      },
    };
    const s = presets[type] || presets.lunch;
    return {
      content: `# ${s.title}\n${s.bullets.map((b) => `- ${b}`).join('\n')}\n- Est. cost: ${s.cost}\n\n**Key Benefit:** ${s.benefit}`,
      calories: target,
    };
  }

  if (currency.code === 'GHS') {
    const presets: Record<string, { title: string; bullets: string[]; benefit: string; cost: string }> = {
      breakfast: {
        title: 'Spiced Hausa Koko with Koose & Hard-Boiled Egg',
        bullets: ['Warm spiced millet porridge (Hausa koko)', '3 golden bean cakes (koose) or 1 hard-boiled egg'],
        benefit: 'Natural probiotics and gut-soothing spices that awaken digestion.',
        cost: `~${currency.symbol}20`,
      },
      lunch: {
        title: 'Ghanaian Jollof Rice with Grilled Tilapia & Shito',
        bullets: ['Spiced tomato-onion rice', 'Fresh seasoned grilled tilapia with lemon', 'Side salad and a touch of black pepper shito'],
        benefit: 'High-quality lean marine protein and essential trace minerals.',
        cost: `~${currency.symbol}45`,
      },
      dinner: {
        title: 'Kontomire Stew with Boiled Yam & Sweet Plantain',
        bullets: ['Steamed cocoyam leaves stew with agushie melon seeds and smoked salmon', 'Boiled yam cubes'],
        benefit: 'Supercharged with dietary iron, calcium, and restorative folate.',
        cost: `~${currency.symbol}30`,
      },
      snack: {
        title: 'Kelewele with Roasted Peanuts',
        bullets: ['Ginger and chili seasoned baked plantain cubes', 'Handful of roasted peanuts'],
        benefit: 'Quick potassium reload with heart-healthy monounsaturated fats.',
        cost: `~${currency.symbol}10`,
      },
    };
    const s = presets[type] || presets.lunch;
    return {
      content: `# ${s.title}\n${s.bullets.map((b) => `- ${b}`).join('\n')}\n- Est. cost: ${s.cost}\n\n**Key Benefit:** ${s.benefit}`,
      calories: target,
    };
  }

  const mealPresets: Record<string, { title: string; bullets: string[]; benefit: string; cost: string }> = {
    breakfast: {
      title: 'Avocado & Scrambled Egg Toast',
      bullets: ['2 organic eggs scrambled with a splash of milk', '1 slice toasted whole grain sourdough', '1/4 ripe avocado seasoned with sea salt and chili flakes'],
      benefit: 'Packed with choline, essential amino acids, and heart-healthy unsaturated fats.',
      cost: `~${currency.symbol}3.50`,
    },
    lunch: {
      title: 'Mediterranean Herb Chicken & Greens',
      bullets: ['Grilled lemon-herb chicken breast strips', 'Mixed greens, cucumber, cherry tomatoes, and Kalamata olives', 'Light drizzle of extra virgin olive oil and balsamic vinegar'],
      benefit: 'Clean lean protein paired with vibrant micronutrients and polyphenol antioxidants.',
      cost: `~${currency.symbol}7.50`,
    },
    dinner: {
      title: 'Pan-Seared Salmon with Sweet Potato & Veggies',
      bullets: ['5 oz wild salmon or cod fillet seared with sea salt and herbs', 'Roasted zucchini, sweet bell peppers, and asparagus', 'Small baked golden sweet potato'],
      benefit: 'Iron-rich, protein-dense dinner supporting overnight recovery without heavy digestion.',
      cost: `~${currency.symbol}9.00`,
    },
    snack: {
      title: 'Apple Slices with Natural Peanut Butter',
      bullets: ['1 crisp apple sliced', '1.5 tbsp creamy natural peanut or almond butter'],
      benefit: 'Balanced fiber and healthy fats that stabilize blood sugar.',
      cost: `~${currency.symbol}2.00`,
    },
  };

  const selected = mealPresets[type] || mealPresets.lunch;
  return {
    content: `# ${selected.title}\n${selected.bullets.map((b) => `- ${b}`).join('\n')}\n- Est. cost: ${selected.cost}\n\n**Key Benefit:** ${selected.benefit}`,
    calories: target,
  };
}

function generateFallbackGoalSteps(profile: any, stats: any): string {
  const calsLeft = Math.max(0, (stats?.caloriesGoal || 2000) - (stats?.calories || 0));
  const stepsLeft = Math.max(0, (stats?.stepsGoal || 10000) - (stats?.steps || 0));

  return `### 🎯 Your Top 3 Next Steps Today

1. **Hydration First 💧**
   Drink a large 16oz glass of water right now to optimize metabolic rate and curb false hunger cues.

2. **Step Gap Close 🚶‍♂️**
   You have **${stepsLeft.toLocaleString()} steps** remaining to hit your target. A 15-20 minute brisk stroll will easily bank 2,000+ steps!

3. **Fuel Smartly 🥗**
   With **${calsLeft} kcal** left for the day, focus your next meal around lean protein (chicken, fish, eggs, or tofu) and leafy greens to stay satisfied.`;
}

function generateFallbackVoiceMeal(transcription: string) {
  const text = (transcription || '').toLowerCase();

  // Check if transcription contains explicit calories like "350 calories" or "500 cal"
  const calMatch = text.match(/(\d+)\s*(?:calories|calorie|cals|cal|kcal)/i);
  let calories = calMatch ? parseInt(calMatch[1], 10) : 0;

  // Check if user is asking a question or seeking advice
  const isQuestion = text.includes('?') || text.startsWith('how') || text.startsWith('what') || text.startsWith('should') || text.startsWith('can i') || text.startsWith('is this');

  if (isQuestion) {
    return {
      intent: 'advice',
      response: 'To support your fitness goals, prioritize nutrient-dense whole foods: high-protein options (eggs, chicken, fish, tofu), complex carbohydrates (quinoa, sweet potatoes, oats), and plenty of colorful vegetables. Keep hydration consistent throughout the day!',
      mealName: null,
      calories: 0,
      analysis: 'Nutrition guidance provided.',
    };
  }

  // Common food keyword estimates
  if (!calories) {
    if (text.includes('salad')) calories = 250;
    else if (text.includes('egg') || text.includes('toast')) calories = 300;
    else if (text.includes('chicken') || text.includes('rice')) calories = 450;
    else if (text.includes('burger') || text.includes('pizza') || text.includes('fries')) calories = 650;
    else if (text.includes('shake') || text.includes('smoothie')) calories = 280;
    else if (text.includes('oatmeal') || text.includes('oats')) calories = 320;
    else calories = 400;
  }

  // Extract a sensible meal name from user speech
  let mealName = transcription.trim();
  if (mealName.length > 50) {
    mealName = mealName.slice(0, 47) + '...';
  }

  return {
    intent: 'log',
    response: `Logged "${mealName}" (~${calories} kcal). Keeping your meals tracked helps you stay on course with your fitness targets!`,
    mealName: mealName || 'Logged Meal',
    calories,
    analysis: 'Estimated from voice note. Tap to adjust details anytime.',
  };
}

export const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==========================================
// GEMINI AI SERVER ENDPOINTS
// ==========================================

  // 1. Scan Food Photo
  app.post('/api/gemini/scan-food', async (req, res) => {
    try {
      const { imageBase64, mode = 'deep', additionalDetails = '' } = req.body;
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'imageBase64 string is required' });
      }

      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64.trim();
      const ai = getGeminiClient();
      const detailsPrompt = additionalDetails ? `\n\nAdditional user notes: "${additionalDetails}"` : '';

      const prompt = `Examine this photo carefully to determine if it contains consumable food/drinks or a non-food item.

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
   - Set "name": Specific name of the food or meal (e.g., "Pancit Bihon with Shrimp and Sausage", "Grilled Chicken Salad", "Fried Eggs and Toast")
   - Set "calories": Estimated integer calorie count based on portion size, visible oils, carbs, protein, and ingredients
   - Set "analysis": A brief 1-2 sentence nutritional breakdown highlighting protein, carbs, fats, and calorie density.${detailsPrompt}`;

      let response;
      try {
        response = await generateContentWithRetryAndFallback(
          ai,
          AI_MODELS,
          {
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: cleanBase64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  isFood: { type: Type.BOOLEAN },
                  name: { type: Type.STRING },
                  calories: { type: Type.INTEGER },
                  analysis: { type: Type.STRING },
                },
                required: ['isFood', 'name', 'calories', 'analysis'],
              },
            },
          }
        );
      } catch (err3) {
        console.warn('Gemini vision models exhausted or rate-limited, returning resilient food estimate fallback:', err3);
        return res.json({
          isFood: true,
          name: additionalDetails ? `Meal (${additionalDetails.slice(0, 25)})` : 'Meal Photo Logged',
          calories: 0,
          analysis: 'AI vision scan is momentarily under high demand. Please enter or adjust your calories manually.',
          wasFallback: true,
        });
      }

      const parsed = cleanAndParseJson(response.text, {
        isFood: true,
        name: 'Scanned Meal',
        calories: 350,
        analysis: 'Estimated food item.',
      });

      res.json({
        isFood: typeof parsed.isFood === 'boolean' ? parsed.isFood : true,
        name: parsed.name || 'Scanned Meal',
        calories: typeof parsed.calories === 'number' ? parsed.calories : 0,
        analysis: parsed.analysis || '',
      });
    } catch (err: any) {
      console.error('Server scan food error:', err);
      res.json({
        isFood: true,
        name: 'Scanned Meal',
        calories: 400,
        analysis: 'Image received. You can adjust calories and name to match your exact plate.',
        wasFallback: true,
      });
    }
  });

  // 2. Voice / Text Meal Processing
  app.post('/api/gemini/voice-meal', async (req, res) => {
    try {
      const { transcription, stats = {}, profile = null, foodLog = [] } = req.body;
      if (!transcription) {
        return res.status(400).json({ error: 'transcription is required' });
      }

      const ai = getGeminiClient();
      const userLocation = profile?.location || '';
      const currencyGuidance = getCurrencyPromptGuidance(userLocation, profile?.dailyBudget, profile?.currency);
      const goalText = profile ? `The user's goal is to ${profile.goal ? profile.goal.replace('_', ' ') : 'get fit'}.` : '';
      const recentMeals = foodLog.length > 0 
        ? `Recent meals today: ${foodLog.map((m: any) => `${m.name} (${m.calories} kcal)`).join(', ')}.` 
        : 'No meals logged yet today.';

      const prompt = `The user said: "${transcription}". 
Evaluate the user's intent. They might be:
1. Logging a meal (e.g., "I just had a burger and fries").
2. Asking a question or seeking advice (e.g., "Is this healthy?", "What should I eat for dinner?", "What can I eat on my budget?").
3. Expressing a concern or pattern (e.g., "I've been eating too many carbs lately").

User profile: ${goalText}
Current day context: ${stats.calories || 0}/${stats.caloriesGoal || 2000} kcal consumed.
${recentMeals}

${currencyGuidance}

Provide a helpful, conversational, and PROACTIVE response. 
- If they are logging a meal: Extract the info AND give a brief, supportive comment or tip related to their goal.
- If they are asking a question or seeking meal recommendations/food budget advice: Answer it thoroughly and intelligently based on their personal data, location, and quote any prices/costs strictly in their local currency.
- If they express a concern: Analyze their recent history (if provided) and offer constructive feedback.

CRITICAL: ALWAYS provide a conversational response in the "response" field. Do not leave it empty.

Return a JSON object:
{
  "intent": "log" | "question" | "advice",
  "response": "Conversational reply to the user (Markdown)",
  "mealName": "string (summary of items, only if logging, null otherwise)",
  "calories": number (integer, only if logging, 0 otherwise)",
  "analysis": "string (brief summary/tags for the log or key takeaway)"
}`;

      let response;
      try {
        response = await generateContentWithRetryAndFallback(
          ai,
          AI_MODELS,
          {
            contents: prompt,
            config: {
              temperature: 0.7,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  intent: { type: Type.STRING, enum: ['log', 'question', 'advice'] },
                  response: { type: Type.STRING },
                  mealName: { type: Type.STRING, nullable: true },
                  calories: { type: Type.INTEGER },
                  analysis: { type: Type.STRING },
                },
                required: ['intent', 'response', 'calories', 'analysis'],
              },
            },
          }
        );
      } catch (e) {
        console.warn('Voice meal AI unavailable or rate-limited, returning smart fallback:', e);
        return res.json(generateFallbackVoiceMeal(transcription));
      }

      const parsed = response?.text 
        ? cleanAndParseJson(response.text, generateFallbackVoiceMeal(transcription))
        : generateFallbackVoiceMeal(transcription);

      res.json(parsed);
    } catch (err: any) {
      console.error('Server voice meal error:', err);
      res.json(generateFallbackVoiceMeal(req.body?.transcription || ''));
    }
  });

  // 3. Buffet & Live Stream Analysis
  app.post('/api/gemini/buffet', async (req, res) => {
    try {
      const { imageBase64, remainingCalories = 500, profile = null } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 is required' });
      }

      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64.trim();
      const ai = getGeminiClient();
      const goalText = profile ? `The user's goal is to ${profile.goal ? profile.goal.replace('_', ' ') : 'stay healthy'}.` : '';

      const prompt = `The user is examining food/buffet spread and has ${remainingCalories} calories remaining for the day. ${goalText}
Analyze all available food items in the image and provide advice on what they should pick to stay on track.
Suggest a specific plate configuration.

Return a JSON object:
{
  "advice": "Markdown string with advice and specific recommendations",
  "estimatedCalories": number (integer for the suggested plate),
  "isFood": boolean (true if food items are visible, false if non-food item)
}`;

      let response;
      try {
        response = await generateContentWithRetryAndFallback(
          ai,
          AI_MODELS,
          {
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: cleanBase64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
            },
          }
        );
      } catch (e) {
        console.warn('Buffet scan fallback:', e);
      }

      const parsed = response?.text ? cleanAndParseJson(response.text, {
        advice: 'Scan completed. Focus on filling half your plate with leafy greens, one quarter with lean protein (grilled chicken, fish, or tofu), and one quarter with complex carbs (brown rice, sweet potato)!',
        estimatedCalories: Math.min(500, remainingCalories),
        isFood: true,
      }) : {
        advice: 'Scan completed. Focus on filling half your plate with leafy greens, one quarter with lean protein (grilled chicken, fish, or tofu), and one quarter with complex carbs (brown rice, sweet potato)!',
        estimatedCalories: Math.min(500, remainingCalories),
        isFood: true,
      };

      res.json(parsed);
    } catch (err: any) {
      console.error('Server buffet scan error:', err);
      res.json({
        advice: 'Plate scanned! Aim for lean proteins and fibrous vegetables to keep within your calorie budget.',
        estimatedCalories: Math.min(500, req.body?.remainingCalories || 500),
        isFood: true,
      });
    }
  });

  // 4. Suggest Workout
  app.post('/api/gemini/suggest-workout', async (req, res) => {
    try {
      const { remainingMinutes, profile, focusArea, environment } = req.body;
      const ai = getGeminiClient();
      const activeEnv = (environment || profile?.workoutEnvironment || 'home').toLowerCase();
      const isGym = activeEnv === 'gym';
      const targetArea = focusArea || 'Full Body';

      const envInstructions = isGym
        ? `WORKOUT LOCATION: GYM. The user has access to a commercial gym. Recommend exercises that utilize gym equipment such as barbells, dumbbells, cable stations, benches, and resistance machines. Provide suggested set/rep schemes (e.g., 3 sets of 10-12 reps).`
        : `WORKOUT LOCATION: HOME. The user is training at HOME. Strictly recommend exercises that can be performed using bodyweight, calisthenics, floor mats, or common household items (chair, wall). DO NOT suggest heavy gym equipment, barbell racks, or cable machines.`;

      const goalText = profile 
        ? `User Profile: Goal is ${profile.goal ? profile.goal.replace('_', ' ') : 'fitness'}, Activity Level: ${profile.activityLevel ? profile.activityLevel.replace('_', ' ') : 'moderate'}, Weight: ${profile.weight || 150} lbs, Location: ${profile.location || 'Home'}.`
        : '';

      const prompt = `The user needs a personalized ${remainingMinutes || 20}-minute ${targetArea} workout.
${goalText}
${envInstructions}
Target Muscle Focus: ${targetArea}

Tailor the volume, intensity, and exercise selection strictly to their goal (${profile?.goal || 'fitness'}), experience, and the ${isGym ? 'GYM' : 'HOME'} environment.

Format the response using Markdown:
- Start with an inspiring # Heading (e.g., # 🏋️ ${remainingMinutes || 20}-Minute Gym ${targetArea} Power Session or # 🏠 ${remainingMinutes || 20}-Minute Home ${targetArea} Circuit)
- Use ## Subheadings for sections
- ## Overview: 2-3 brief bullet points on key benefits, targeted muscles, and equipment (${isGym ? 'Free Weights & Gym Machines' : 'Bodyweight / No Equipment'})
- ## Workout Routine (${remainingMinutes || 20} mins):
  List the warm-up, core working exercises with sets/reps/intervals, and cool-down.
- CRITICAL: For EVERY exercise suggested, include a link to search for it on YouTube in this exact format:
  [📺 Watch Tutorial](https://www.youtube.com/results?search_query=how+to+do+[exercise+name])
- Include a bold > **Pro-tip:** for proper form, tempo, breathing, and safe execution in the ${isGym ? 'gym' : 'home'} setting.
- Keep it motivating, punchy, and clear.`;

      let responseText: string | null = null;
      try {
        const response = await generateContentWithRetryAndFallback(
          ai,
          AI_MODELS,
          {
            contents: prompt,
            config: {
              temperature: 0.8,
            },
          }
        );
        responseText = response?.text || null;
      } catch (geminiErr) {
        console.warn('Workout Gemini AI call failed, using high-quality workout routine fallback:', geminiErr);
        responseText = generateFallbackWorkout(remainingMinutes, profile, targetArea, activeEnv);
      }

      res.json({ text: responseText || generateFallbackWorkout(remainingMinutes, profile, targetArea, activeEnv) });
    } catch (err: any) {
      console.error('Server workout error:', err);
      res.json({ text: generateFallbackWorkout(req.body?.remainingMinutes, req.body?.profile, req.body?.focusArea, req.body?.environment) });
    }
  });

  // 4b. Recommend Focus Area
  app.post('/api/gemini/recommend-focus-area', async (req, res) => {
    try {
      const { profile = null, stats = {}, foodHistory = [] } = req.body;
      const ai = getGeminiClient();
      const goalText = profile ? `Goal: ${profile.goal ? profile.goal.replace('_', ' ') : 'fitness'}. Weight: ${profile.weight}lbs. Location: ${profile.location || 'Home'}. History: ${foodHistory.length} meals logged.` : '';

      const prompt = `Based on the following user data:
${goalText}
Current Day Progress: ${stats.calories || 0}/${stats.caloriesGoal || 2000} kcal, ${stats.exercise || 0}/${stats.exerciseGoal || 30} mins exercise.

Recommend ONE primary body area or exercise type the user should focus on today. 
Options include: Cardio, Legs, Biceps, Triceps, Back, Chest, Shoulders, Core, or Full Body.

Provide a 1-sentence personalized justification.

Format your response as a JSON object:
{
  "area": "Cardio | Legs | Biceps | Triceps | Back | Chest | Shoulders | Core | Full Body",
  "reason": "Brief justification"
}`;

      let response;
      try {
        response = await generateContentWithRetryAndFallback(
          ai,
          AI_MODELS,
          {
            contents: prompt,
            config: {
              temperature: 0.7,
              responseMimeType: 'application/json',
            },
          }
        );
      } catch (geminiErr) {
        console.warn('Recommend focus area Gemini call failed, using fallback:', geminiErr);
        return res.json(generateFallbackFocusArea(profile, stats));
      }

      const parsed = cleanAndParseJson(response?.text, generateFallbackFocusArea(profile, stats));
      res.json(parsed);
    } catch (err: any) {
      console.error('Server recommend focus area error:', err);
      res.json(generateFallbackFocusArea(req.body?.profile, req.body?.stats));
    }
  });

  // 5. Suggest Daily Meals
  app.post('/api/gemini/suggest-daily-meals', async (req, res) => {
    try {
      const { remainingCalories = 2000, profile = null, totalDailyGoal = 2000 } = req.body;
      const ai = getGeminiClient();
      const userLocation = profile?.location || '';
      const currencyGuidance = getCurrencyPromptGuidance(userLocation, profile?.dailyBudget, profile?.currency);
      const goalText = profile ? `The user's goal is to ${profile.goal ? profile.goal.replace('_', ' ') : 'maintain weight'}. Location: ${profile.location || 'Global'}.` : '';
      const prepText = profile ? `They usually ${profile.mealPrepStyle === 'self' ? 'cook for themselves' : profile.mealPrepStyle === 'others' ? 'have someone cook for them' : 'eat out'}. Fruit consumption: ${profile.fruitConsumption || 'daily'}.` : '';
      const today = new Date().toDateString();

      const prompt = `Today is ${today}. The user has ${remainingCalories} calories remaining today out of a total daily goal of ${totalDailyGoal} kcal. ${goalText} ${prepText}

${currencyGuidance}

Suggest a full day's meal plan including Breakfast, Lunch, Dinner, and a Snack, tailored specifically to their regional location and ingredients. 

CRITICAL CALORIE RULE:
The SUM of calories for all 4 suggested meals (Breakfast + Lunch + Dinner + Snack) MUST closely equal ${remainingCalories} kcal.

Format the response as a JSON object with keys 'breakfast', 'lunch', 'dinner', and 'snacks'. 
Each value should be an object with 'content' (Markdown string) and 'calories' (integer):
- content: Use a # Heading for the meal name, bullet points for key ingredients (including estimated price/cost strictly in their local currency), and one key benefit in bold.
- calories: The exact calorie count for this meal.`;

      let parsed: any = null;
      try {
        const response = await generateContentWithRetryAndFallback(
          ai,
          AI_MODELS,
          {
            contents: prompt,
            config: {
              temperature: 0.7,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  breakfast: { 
                    type: Type.OBJECT,
                    properties: { content: { type: Type.STRING }, calories: { type: Type.INTEGER } },
                    required: ['content', 'calories'],
                  },
                  lunch: { 
                    type: Type.OBJECT,
                    properties: { content: { type: Type.STRING }, calories: { type: Type.INTEGER } },
                    required: ['content', 'calories'],
                  },
                  dinner: { 
                    type: Type.OBJECT,
                    properties: { content: { type: Type.STRING }, calories: { type: Type.INTEGER } },
                    required: ['content', 'calories'],
                  },
                  snacks: { 
                    type: Type.OBJECT,
                    properties: { content: { type: Type.STRING }, calories: { type: Type.INTEGER } },
                    required: ['content', 'calories'],
                  },
                },
                required: ['breakfast', 'lunch', 'dinner', 'snacks'],
              },
            },
          }
        );
        parsed = cleanAndParseJson(response.text, null);
      } catch (geminiErr) {
        console.warn('Daily meals AI call failed, generating tailored fallback meals:', geminiErr);
        parsed = generateFallbackDailyMeals(remainingCalories, profile);
      }

      res.json(parsed || generateFallbackDailyMeals(remainingCalories, profile));
    } catch (err: any) {
      console.error('Server daily meals error:', err);
      res.json(generateFallbackDailyMeals(req.body?.remainingCalories, req.body?.profile));
    }
  });

  // 6. Suggest Single Meal
  app.post('/api/gemini/suggest-meal', async (req, res) => {
    try {
      const { remainingCalories = 500, profile = null, mealType = 'meal', excludeItems = [], totalDailyGoal = 2000 } = req.body;
      const ai = getGeminiClient();
      const userLocation = profile?.location || '';
      const currencyGuidance = getCurrencyPromptGuidance(userLocation, profile?.dailyBudget, profile?.currency);
      const goalText = profile ? `The user's goal is to ${profile.goal ? profile.goal.replace('_', ' ') : 'stay fit'}.` : '';
      const today = new Date().toDateString();
      const excludeText = excludeItems.length > 0 ? `\n\nDo NOT suggest anything similar to: ${excludeItems.join(', ')}.` : '';

      const targetCalories = mealType === 'breakfast' ? totalDailyGoal * 0.25 :
                            mealType === 'lunch' ? totalDailyGoal * 0.35 :
                            mealType === 'dinner' ? totalDailyGoal * 0.30 :
                            totalDailyGoal * 0.10;

      const prompt = `Today is ${today}. The user has ${remainingCalories} calories remaining today out of a ${totalDailyGoal} kcal goal.
Suggest a healthy, delicious ${mealType} that is around ${Math.round(targetCalories)} kcal, tailored to what is authentic and accessible in their region.

${currencyGuidance}
${goalText}${excludeText}

Format the response as a JSON object:
- content: Markdown string with # Heading, bullet points for key ingredients (including estimated price/cost strictly in their local currency), and one key benefit in bold.
- calories: The exact calorie count (integer).`;

      let parsed: any = null;
      try {
        const response = await generateContentWithRetryAndFallback(
          ai,
          AI_MODELS,
          {
            contents: prompt,
            config: {
              temperature: 0.7,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  content: { type: Type.STRING },
                  calories: { type: Type.INTEGER },
                },
                required: ['content', 'calories'],
              },
            },
          }
        );
        parsed = cleanAndParseJson(response.text, null);
      } catch (geminiErr) {
        console.warn('Single meal AI call failed, generating tailored fallback meal:', geminiErr);
        parsed = generateFallbackSingleMeal(remainingCalories, mealType, totalDailyGoal, profile);
      }

      res.json(parsed || generateFallbackSingleMeal(remainingCalories, mealType, totalDailyGoal, profile));
    } catch (err: any) {
      console.error('Server meal error:', err);
      res.json(generateFallbackSingleMeal(req.body?.remainingCalories, req.body?.mealType, req.body?.totalDailyGoal, req.body?.profile));
    }
  });

  // 7. Goal Steps
  app.post('/api/gemini/goal-steps', async (req, res) => {
    try {
      const { profile, stats, recentLogs = [] } = req.body;
      const ai = getGeminiClient();
      const userLocation = profile?.location || '';
      const currencyInfo = getCurrencyForLocation(userLocation, profile?.currency);
      const budget = profile?.dailyBudget || currencyInfo.defaultDailyBudget;
      const prepText = profile ? `Meal Prep: ${profile.mealPrepStyle || 'standard'}, Budget: ${currencyInfo.symbol}${budget.toLocaleString()} (${currencyInfo.name})/day.` : '';
      const recentFoodContext = recentLogs.length > 0 
        ? `\n\nRecent meals logged: ${recentLogs.slice(0, 5).map((l: any) => `${l.name} (${l.calories} kcal)`).join(', ')}.`
        : '';

      const prompt = `The user is a ${profile?.age || 25} year old ${profile?.gender || 'individual'} with a goal to ${profile?.goal ? profile.goal.replace('_', ' ') : 'stay fit'}. 
Current stats: Weight: ${profile?.weight || 150}lbs, Height: ${profile?.height || 170}cm. Location: ${userLocation || 'Global'}. Currency: ${currencyInfo.name} (${currencyInfo.symbol}).
${prepText}${recentFoodContext}
Today's progress: ${stats?.calories || 0}/${stats?.caloriesGoal || 2000} kcal, ${stats?.steps || 0}/${stats?.stepsGoal || 10000} steps, ${stats?.exercise || 0}/${stats?.exerciseGoal || 30} min exercise.

Provide 3 actionable, highly specific "Next Steps" or diet advice items. If mentioning grocery costs or meal budget, use ${currencyInfo.name} (${currencyInfo.symbol}).
Format using Markdown: bulleted list with emojis, bold text for key actions.`;

      let responseText: string | null = null;
      try {
        const response = await generateContentWithRetryAndFallback(
          ai,
          AI_MODELS,
          {
            contents: prompt,
            config: {
              temperature: 0.8,
            },
          }
        );
        responseText = response?.text || null;
      } catch (geminiErr) {
        console.warn('Goal steps AI call failed, using smart goal steps fallback:', geminiErr);
        responseText = generateFallbackGoalSteps(profile, stats);
      }

      res.json({ text: responseText || generateFallbackGoalSteps(profile, stats) });
    } catch (err: any) {
      console.error('Server goal steps error:', err);
      res.json({ text: generateFallbackGoalSteps(req.body?.profile, req.body?.stats) });
    }
  });

  // 8. Cheer
  app.post('/api/gemini/cheer', async (req, res) => {
    try {
      const { postContent } = req.body;
      const ai = getGeminiClient();
      const prompt = `A fitness community member just posted: "${postContent}". Write a short, highly enthusiastic, and personalized supportive comment (max 15 words) that would make them feel like a champion. Use 1 relevant emoji.`;
      let text: string | null = null;
      try {
        const response = await generateContentWithRetryAndFallback(
          ai,
          AI_MODELS,
          {
            contents: prompt,
            config: {
              temperature: 0.9,
            },
          }
        );
        text = response?.text || null;
      } catch (geminiErr) {
        console.warn('Cheer AI call failed, using default cheer:', geminiErr);
        text = "Keep up the fantastic momentum, you're crushing your fitness goals! 🔥";
      }

      res.json({ text: text || "Keep up the fantastic momentum, you're crushing your fitness goals! 🔥" });
    } catch (err: any) {
      console.error('Server cheer error:', err);
      res.json({ text: "Keep up the fantastic momentum, you're crushing your fitness goals! 🔥" });
    }
  });

  // Paystack Integration
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

  // 1. Initialize Transaction
  app.post('/api/paystack/initialize', async (req, res) => {
    try {
      const { email, amount, metadata, currency } = req.body;
      
      const payload: any = {
        email,
        amount: Math.round(Number(amount) * 100), // Ensure it's a number and convert to cents/kobo
        metadata: JSON.stringify(metadata),
        callback_url: req.headers.origin || `${req.protocol}://${req.get('host')}/`
      };

      if (currency && currency !== 'NGN') {
        payload.currency = currency;
      }
      
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        payload,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error('Paystack Initialize Error:', JSON.stringify(errorData || error.message, null, 2));
      res.status(error.response?.status || 500).json({ 
        error: 'Failed to initialize payment',
        details: errorData || error.message
      });
    }
  });

  // 2. Verify Transaction (Webhook or direct check)
  app.post('/api/paystack/verify/:reference', async (req, res) => {
    try {
      const { reference } = req.params;
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`
          }
        }
      );
      
      res.json(response.data);
    } catch (error: any) {
      console.error('Paystack Verify Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  });

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

export async function startServer() {
  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

// Automatically start standalone server in local and container environments (not in Vercel serverless)
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Server startup error:', err);
  });
}

export default app;

