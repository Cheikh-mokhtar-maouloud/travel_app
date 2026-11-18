// تسجيل الدخول / إنشاء حساب
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../AppContext';
import { Btn, Field, Icon, Row, Segmented, showError, T } from '../components/ui';
import { colors } from '../theme';
import { t } from '../i18n';

export function LangSwitch() {
  const { lang, setLanguage } = useApp();
  return (
    <Row gap={6} style={{ alignSelf: 'center' }}>
      {[
        ['ar', 'العربية'],
        ['fr', 'Français'],
        ['en', 'English'],
      ].map(([k, l]) => (
        <Pressable key={k} onPress={() => k !== lang && setLanguage(k)} style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: lang === k ? colors.ink : '#fff', borderWidth: 1, borderColor: lang === k ? colors.ink : colors.lineStrong }}>
          <T size={13} weight="700" color={lang === k ? '#fff' : colors.ink} center>
            {l}
          </T>
        </Pressable>
      ))}
    </Row>
  );
}

export default function AuthScreen() {
  const { signIn, config } = useApp();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!phone.trim() || !password) return showError(new Error(t('enterPhonePassword')));
    if (mode === 'register' && !name.trim()) return showError(new Error(t('enterName')));
    setBusy(true);
    try {
      if (mode === 'login') await signIn('/auth/login', { phone, password });
      else await signIn('/auth/register', { name, phone, password, referralCode: code.trim() });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 18, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <LangSwitch />
          <View style={{ alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="airplane" size={34} color="#fff" />
            </View>
            <T size={24} weight="700" center>
              {config?.agencyName || t('appName')}
            </T>
            <T color={colors.muted} center>
              {t('authTagline')}
            </T>
          </View>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'login', label: t('login') },
              { value: 'register', label: t('newAccount') },
            ]}
          />
          {mode === 'register' ? <Field label={t('fullName')} value={name} onChangeText={setName} placeholder={t('fullNamePh')} /> : null}
          <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" ltr placeholder="+222 00 00 00 00" autoComplete="tel" />
          <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry ltr placeholder={t('passwordPh')} />
          {mode === 'register' && config?.referral?.enabled ? (
            showCode ? (
              <Field label={t('referralCodeLabel')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" ltr placeholder="R1A2B3C" hint={t('referralCodeHint', { n: config.referral.referee })} />
            ) : (
              <Pressable onPress={() => setShowCode(true)}>
                <T color={colors.accent} weight="600" center>
                  {t('haveReferral')}
                </T>
              </Pressable>
            )
          ) : null}
          <Btn title={mode === 'login' ? t('enter') : t('createAccount')} onPress={submit} loading={busy} />
          {mode === 'login' ? (
            <T size={13} color={colors.muted} center>
              {t('forgotPassword', { phone: config?.agencyPhone || '' })}
            </T>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
