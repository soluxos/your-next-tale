const LANG_MAP = {
  en: "en",
  eng: "en",
  english: "en",
  es: "es",
  spa: "es",
  spanish: "es",
  fr: "fr",
  fre: "fr",
  fra: "fr",
  french: "fr",
  de: "de",
  ger: "de",
  deu: "de",
  german: "de",
  it: "it",
  ita: "it",
  italian: "it",
  pt: "pt",
  por: "pt",
  portuguese: "pt",
  ja: "ja",
  jpn: "ja",
  japanese: "ja",
  zh: "zh",
  chi: "zh",
  zho: "zh",
  chinese: "zh",
  ko: "ko",
  kor: "ko",
  korean: "ko",
  ru: "ru",
  rus: "ru",
  russian: "ru",
  ar: "ar",
  ara: "ar",
  arabic: "ar",
  nl: "nl",
  dut: "nl",
  nld: "nl",
  dutch: "nl",
  sv: "sv",
  swe: "sv",
  swedish: "sv",
  pl: "pl",
  pol: "pl",
  polish: "pl"
};

export function normaliseLanguage(raw) {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return LANG_MAP[key] || key;
}

export function isEnglish(langCode) {
  if (!langCode) return false;
  return normaliseLanguage(langCode) === "en";
}
