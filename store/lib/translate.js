const brand = require('../config/brand');

// Free, keyless machine translation (MyMemory's public API) used to
// auto-fill RU/EN product fields from the Azerbaijani an admin types —
// never overwrites a field the admin filled in by hand. No account or
// API key needed; passing our own contact email raises MyMemory's free
// daily quota, as their docs recommend.
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const MAX_CHARS = 480; // MyMemory's free tier caps ~500 chars per request

async function translateText(text, sourceLang, targetLang) {
  if (!text || !text.trim() || text.length > MAX_CHARS) return null;
  try {
    const params = new URLSearchParams({
      q: text,
      langpair: `${sourceLang}|${targetLang}`,
      de: brand.email,
    });
    const res = await fetch(`${MYMEMORY_URL}?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const translated = data && data.responseData && data.responseData.translatedText;
    if (!translated || /MYMEMORY WARNING|INVALID|QUERY LENGTH LIMIT/i.test(translated)) return null;
    return translated;
  } catch (e) {
    return null; // translation is a nice-to-have — never block saving the product
  }
}

// Fills in whichever of name_ru/name_en/description_ru/description_en
// were left blank, translating from the Azerbaijani fields. Fields the
// admin already typed are passed through untouched.
async function autoTranslateProduct({ name, description, name_ru, name_en, description_ru, description_en }) {
  const [filledNameRu, filledNameEn, filledDescRu, filledDescEn] = await Promise.all([
    name_ru || translateText(name, 'az', 'ru'),
    name_en || translateText(name, 'az', 'en'),
    description_ru || translateText(description, 'az', 'ru'),
    description_en || translateText(description, 'az', 'en'),
  ]);
  return { name_ru: filledNameRu || null, name_en: filledNameEn || null, description_ru: filledDescRu || null, description_en: filledDescEn || null };
}

module.exports = { translateText, autoTranslateProduct };
