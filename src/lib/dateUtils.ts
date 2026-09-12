/**
 * Date and Fitness Day calculation utilities.
 * The standard fitness day boundary rolls over at 5:00 AM local time.
 * This guarantees consistent daily streaks, stats archiving, and AI resets.
 */

export const FITNESS_DAY_OFFSET_HOURS = 5;

/**
 * Calculates the fitness day string in 'YYYY-MM-DD' format.
 * Rolling over at 5:00 AM local time.
 */
export const getFitnessDayStr = (dateInput?: Date | string | number): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  const localOffset = new Date(d.getTime() - FITNESS_DAY_OFFSET_HOURS * 60 * 60 * 1000);
  const year = localOffset.getFullYear();
  const month = String(localOffset.getMonth() + 1).padStart(2, '0');
  const day = String(localOffset.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Checks if a given timestamp or date string belongs to the current fitness day.
 */
export const isTodayFitnessDay = (dateInput?: Date | string | number): boolean => {
  if (!dateInput) return false;
  const targetDay = getFitnessDayStr(dateInput);
  const currentDay = getFitnessDayStr(new Date());
  return targetDay === currentDay;
};

/**
 * Checks if two dates fall into the exact same fitness day cycle.
 */
export const isSameFitnessDay = (
  date1?: Date | string | number,
  date2?: Date | string | number
): boolean => {
  if (!date1 || !date2) return false;
  return getFitnessDayStr(date1) === getFitnessDayStr(date2);
};

/**
 * Calculates milliseconds remaining until the next 5:00 AM fitness day rollover.
 */
export const getMsUntilNextDayReset = (): number => {
  const now = new Date();
  const nextReset = new Date(now);
  if (now.getHours() >= FITNESS_DAY_OFFSET_HOURS) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  nextReset.setHours(FITNESS_DAY_OFFSET_HOURS, 0, 0, 0);
  const diff = nextReset.getTime() - now.getTime();
  return Math.max(1000, diff);
};
