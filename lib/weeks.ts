// Week-calendar utilities — no server-only imports, safe to use in client components.

export type WeekKey = 'last' | 'current' | 'next';

export interface WeekDates {
  Monday: Date;
  Tuesday: Date;
  Wednesday: Date;
  Thursday: Date;
  Friday: Date;
  Saturday: Date;
  Sunday: Date;
}

export interface Weeks {
  last: WeekDates;
  current: WeekDates;
  next: WeekDates;
}

export interface PlannedRecipe {
  planned_recipe_id: string;
  recipe_id: string;
  planned_date: string;  // YYYY-MM-DD
  day_of_week: string;   // 'any' | 'Monday' | ... | 'Sunday'
  servings: number;
  is_cooked: boolean;
  tag?: string | null;
  app_user_id: string;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildWeekDates(monday: Date): WeekDates {
  const result: Partial<WeekDates> = {};
  const names: (keyof WeekDates)[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  names.forEach((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    result[name] = d;
  });
  return result as WeekDates;
}

export function getWeeks(): Weeks {
  const thisMonday = getMonday(new Date());
  const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
  const nextMonday = new Date(thisMonday); nextMonday.setDate(thisMonday.getDate() + 7);
  return {
    last: buildWeekDates(lastMonday),
    current: buildWeekDates(thisMonday),
    next: buildWeekDates(nextMonday),
  };
}

export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
