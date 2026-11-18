// الحالة العامة: اللغة، المستخدم، إعدادات الوكالة، المطارات، الإشعارات
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, loadToken, saveToken, setUnauthorizedHandler } from './api';
import { i18n, setI18nLang, loc } from './i18n';
import { applyDirection } from './theme';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState('ar');
  const [langKey, setLangKey] = useState(0);
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [airports, setAirports] = useState([]);
  const [badges, setBadges] = useState({ unread: 0, unreadMessages: 0 });
  const [bootError, setBootError] = useState(null);
  const timer = useRef(null);

  const logout = useCallback(async () => {
    await saveToken(null);
    setUser(null);
    setBadges({ unread: 0, unreadMessages: 0 });
  }, []);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  const loadPublic = useCallback(async () => {
    const [cfg, aps] = await Promise.all([api('/config'), api('/airports')]);
    // في الفرنسية تُعرض العملة برمزها الدولي بدل "أوقية"
    if (i18n.lang !== 'ar' && /[\u0600-\u06FF]/.test(cfg.currency || '')) cfg.currency = 'MRU';
    setConfig(cfg);
    setAirports(aps);
  }, []);

  const boot = useCallback(async () => {
    setBootError(null);
    const saved = await AsyncStorage.getItem('lang');
    const l = saved === 'fr' || saved === 'en' ? saved : 'ar';
    setI18nLang(l);
    applyDirection(l);
    setLangState(l);
    try {
      await loadPublic();
      const tk = await loadToken();
      if (tk) {
        try {
          setUser(await api('/me'));
        } catch {
          await saveToken(null);
        }
      }
    } catch (e) {
      setBootError(e.message);
    } finally {
      setReady(true);
    }
  }, [loadPublic]);

  useEffect(() => {
    boot();
  }, [boot]);

  // تغيير اللغة: يُعاد رسم التطبيق كاملاً بالاتجاه الجديد
  const setLanguage = useCallback(
    async (l) => {
      await AsyncStorage.setItem('lang', l);
      setI18nLang(l);
      applyDirection(l);
      setLangState(l);
      setLangKey((k) => k + 1);
      loadPublic().catch(() => {});
      if (user) api('/me', { method: 'PUT', body: { lang: l } }).catch(() => {});
    },
    [user, loadPublic]
  );

  const refreshUser = useCallback(async () => {
    try {
      const u = await api('/me');
      setUser(u);
      return u;
    } catch {
      return null;
    }
  }, []);

  const refreshBadges = useCallback(async () => {
    try {
      const n = await api('/notifications');
      setBadges({ unread: n.unread, unreadMessages: n.unreadMessages });
      setUser((u) => (u && u.points !== n.points ? { ...u, points: n.points } : u));
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshBadges();
    timer.current = setInterval(refreshBadges, 30000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refreshBadges());
    return () => {
      clearInterval(timer.current);
      sub.remove();
    };
  }, [!!user, refreshBadges]); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (path, body) => {
    const r = await api(path, { method: 'POST', body });
    await saveToken(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const airport = useCallback((code) => airports.find((a) => a.code === code) || { code, city: code, country: '' }, [airports]);
  // اسم المدينة بلغة التطبيق
  const cityName = useCallback(
    (code) => {
      const a = airports.find((x) => x.code === code);
      if (!a) return code;
      return loc(a, 'city');
    },
    [airports, lang] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isStudent = !!(user && user.student && user.student.status === 'verified');

  return (
    <Ctx.Provider value={{ ready, lang, langKey, setLanguage, user, setUser, refreshUser, config, airports, airport, cityName, isStudent, badges, refreshBadges, signIn, logout, bootError, boot }}>
      {children}
    </Ctx.Provider>
  );
}
