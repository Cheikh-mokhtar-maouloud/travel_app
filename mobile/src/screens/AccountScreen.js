// حسابي: النقاط، الطالب، المسافرون، اللغة، التواصل، البيانات
import React, { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import Constants from 'expo-constants';
import { api } from '../api';
import { useApp } from '../AppContext';
import { API_URL } from '../config';
import { Btn, Card, Field, ListLine, Row, Screen, showError, T } from '../components/ui';
import { colors } from '../theme';
import { t } from '../i18n';
import { LangSwitch } from './AuthScreen';

export default function AccountScreen({ navigation }) {
  const { user, setUser, config, logout, isStudent } = useApp();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email || '');
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [busy, setBusy] = useState(false);
  const st = user.student?.status || 'none';

  const save = async () => {
    setBusy(true);
    try {
      const body = { name, email };
      if (newPassword) Object.assign(body, { currentPassword, newPassword });
      setUser(await api('/me', { method: 'PUT', body }));
      setCurrent('');
      setNew('');
      Alert.alert(t('done'), t('saved'));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmLogout = () =>
    Alert.alert(t('logout'), t('logoutQ'), [
      { text: t('back'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: logout },
    ]);

  return (
    <Screen>
      <T size={26} weight="700">
        {t('myAccount')}
      </T>
      <Card style={{ gap: 4 }}>
        <Row gap={12}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
            <T size={22} weight="700" color="#fff" center>
              {user.name.slice(0, 1).toUpperCase()}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T size={18} weight="700">
              {user.name}
            </T>
            <T color={colors.muted} ltr>
              {user.phone}
            </T>
          </View>
        </Row>
      </Card>

      <Card style={{ gap: 2 }}>
        {config.points?.enabled ? <ListLine icon="star" color={colors.gold} soft={colors.goldSoft} title={t('myPoints')} sub={t('pointsWorth', { n: user.points || 0, v: `${((user.points || 0) * config.points.pointValue).toLocaleString('en-US')} ${config.currency}` })} onPress={() => navigation.navigate('Points')} /> : null}
        {config.referral?.enabled ? <ListLine icon="gift" color={colors.goldInk} soft={colors.goldSoft} title={t('inviteFriends')} sub={t('inviteSub', { n: config.referral.referrer })} onPress={() => navigation.navigate('Points')} /> : null}
        <ListLine icon="school" color={colors.purple} soft={colors.purpleSoft} title={t('studentPrice')} sub={isStudent ? t('studentVerifiedUntil', { d: user.student.validUntil }) : t('studentStatus_' + (st === 'verified' ? 'expired' : st))} onPress={() => navigation.navigate('Student')} />
        <ListLine icon="people" title={t('savedTravelers')} sub={t('savedTravelersSub', { n: (user.travelers || []).length })} onPress={() => navigation.navigate('Travelers')} />
      </Card>

      <Card style={{ gap: 10 }}>
        <T weight="700">{t('language')}</T>
        <LangSwitch />
      </Card>

      <Card style={{ gap: 2 }}>
        <T weight="700" style={{ marginBottom: 4 }}>
          {t('contactAgency', { name: config.agencyName })}
        </T>
        {config.whatsapp ? <ListLine icon="logo-whatsapp" title="WhatsApp" sub={t('whatsappSub')} onPress={() => Linking.openURL(`https://wa.me/${config.whatsapp}`)} /> : null}
        {config.agencyPhone ? <ListLine icon="call-outline" title={t('call')} sub={config.agencyPhone} onPress={() => Linking.openURL(`tel:${config.agencyPhone.replace(/\s/g, '')}`)} /> : null}
        {config.address ? <ListLine icon="location-outline" title={t('address')} sub={config.address} onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(config.address)}`)} /> : null}
      </Card>

      <Card style={{ gap: 12 }}>
        <T weight="700">{t('editProfile')}</T>
        <Field label={t('name')} value={name} onChangeText={setName} />
        <Field label={t('emailOptional')} ltr keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <T size={13} weight="600" color={colors.muted} style={{ marginTop: 6 }}>
          {t('changePasswordOptional')}
        </T>
        <Field label={t('currentPassword')} ltr secureTextEntry value={currentPassword} onChangeText={setCurrent} />
        <Field label={t('newPassword')} ltr secureTextEntry value={newPassword} onChangeText={setNew} />
        <Btn title={t('save')} onPress={save} loading={busy} />
      </Card>

      <Btn title={t('logout')} variant="danger" icon="log-out-outline" onPress={confirmLogout} />
      <T size={11} color={colors.muted} center>
        {t('version')} {Constants.expoConfig?.version || '1.0.0'} · {API_URL}
      </T>
    </Screen>
  );
}
