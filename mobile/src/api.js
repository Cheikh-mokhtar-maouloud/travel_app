import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';
import { i18n, t } from './i18n';

let token = null;
let onUnauthorized = () => {};

export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);
export const getToken = () => token;

export async function loadToken() {
  token = await AsyncStorage.getItem('token');
  return token;
}

export async function saveToken(tk) {
  token = tk;
  if (tk) await AsyncStorage.setItem('token', tk);
  else await AsyncStorage.removeItem('token');
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { Accept: 'application/json', 'X-Lang': i18n.lang };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    // expo/fetch (SDK 57) لا يدعم أجزاء FormData من نوع { uri } — نستعمل XHR للملفات
    res = form ? await xhrRequest(API_URL + '/api' + path, method, headers, payload) : await fetch(API_URL + '/api' + path, { method, headers, body: payload });
  } catch (e) {
    throw new Error(t('netError', { url: API_URL }));
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new Error(data.error || t('genericError'));
  return data;
}

// إرسال FormData عبر شبكة React Native (تدعم { uri, name, type })
function xhrRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.onload = () =>
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: async () => JSON.parse(xhr.responseText),
      });
    xhr.onerror = () => reject(new Error('network'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.send(body);
  });
}

// رابط ملف محمي (التذكرة) يُفتح في المتصفح
export const fileUrl = (name) => `${API_URL}/api/files/${encodeURIComponent(name)}?token=${encodeURIComponent(token || '')}`;

// تجهيز صورة من expo-image-picker للإرسال
export const imagePart = (asset, fallback = 'image') => ({ uri: asset.uri, name: asset.fileName || `${fallback}-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' });
