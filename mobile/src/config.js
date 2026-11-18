// عنوان الخادم (server)
// ‣ أثناء التطوير: يُكتشف تلقائياً من عنوان جهاز الكمبيوتر الذي يشغّل Expo.
// ‣ إن لم يعمل (مثلاً مع --tunnel)، اكتب العنوان يدوياً هنا، مثال:
//     const MANUAL_API_URL = 'http://192.168.1.10:4000';
// ‣ عند النشر: ضع عنوان الخادم الحقيقي https://api.your-agency.com
import Constants from 'expo-constants';

const MANUAL_API_URL = '';
const SERVER_PORT = 4000;

function guessFromExpo() {
  const host =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    '';
  const ip = host.split(':')[0];
  if (ip && !ip.includes('exp.direct')) return `http://${ip}:${SERVER_PORT}`;
  return `http://localhost:${SERVER_PORT}`;
}

export const API_URL = (MANUAL_API_URL || process.env.EXPO_PUBLIC_API_URL || guessFromExpo()).replace(/\/$/, '');
