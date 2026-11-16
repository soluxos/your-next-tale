// Release-date wording for the New & upcoming page. Dates are YYYY-MM-DD.
//
// Publishers often announce only a year, which sources store as 1 January.
// A 1 January date more than two months away is treated as "sometime that
// year" rather than shown as a firm date.

const DAY = 86400000;
const parse = (d) => new Date(`${d}T00:00:00`);
const dayStart = (ms) => {
  const t = new Date(ms);
  t.setHours(0, 0, 0, 0);
  return t.getTime();
};

export function isDateTbc(date, now = Date.now()) {
  return /-01-01$/.test(date) && parse(date).getTime() - now > 60 * DAY;
}

export function daysUntil(date, now = Date.now()) {
  return Math.round((parse(date).getTime() - dayStart(now)) / DAY);
}

/** "Out today", "Out tomorrow", "Out Fri 14 Nov", "14 Nov", "2027", "Out 4 Aug". */
export function releaseLabel(date, now = Date.now()) {
  const d = parse(date);
  const days = daysUntil(date, now);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const short = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  if (days < 0) return `Out ${short}`;
  if (days === 0) return "Out today";
  if (days === 1) return "Out tomorrow";
  if (isDateTbc(date, now)) return `${d.getFullYear()}, date TBC`;
  if (days < 7) return `Out ${d.toLocaleDateString("en-GB", { weekday: "short" })} ${short}`;
  return short;
}

/** Group key and heading: one per month, plus "2027, date to be confirmed". */
export function releaseGroup(date, now = Date.now()) {
  const d = parse(date);
  if (isDateTbc(date, now)) {
    return { key: `${d.getFullYear()}-99`, heading: `${d.getFullYear()}`, note: "Date to be confirmed" };
  }
  return {
    key: date.slice(0, 7),
    heading: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    note: null
  };
}

/** Countdown parts for a future date: { n: 12, unit: "days" }, or a TBC year. */
export function countdown(date, now = Date.now()) {
  const days = daysUntil(date, now);
  if (isDateTbc(date, now)) return { n: parse(date).getFullYear(), unit: "date TBC", tbc: true };
  if (days <= 0) return { n: "Out", unit: "today" };
  if (days === 1) return { n: 1, unit: "day" };
  if (days < 21) return { n: days, unit: "days" };
  if (days < 63) return { n: Math.round(days / 7), unit: "weeks" };
  const months = Math.round(days / 30.4);
  return { n: months, unit: months === 1 ? "month" : "months" };
}
