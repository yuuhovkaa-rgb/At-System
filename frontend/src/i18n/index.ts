import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import kh from './km.json';

export const LANGS = [{ code: 'en', label: 'English', short: 'EN' }, { code: 'kh', label: 'ខ្មែរ', short: 'KH' }] as const;
const saved = (() => { try { return localStorage.getItem('at.lang'); } catch { return null; } })();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, kh: { translation: kh } },
  lng: saved === 'kh' ? 'kh' : 'en', fallbackLng: 'en', interpolation: { escapeValue: false }, returnNull: false,
});
// <html lang="km"> makes the browser pick Khmer-appropriate font shaping.
const apply = (l: string) => { document.documentElement.lang = l === 'kh' ? 'km' : 'en'; try { localStorage.setItem('at.lang', l); } catch { /* ignore */ } };
apply(i18n.language);
i18n.on('languageChanged', apply);
export default i18n;
