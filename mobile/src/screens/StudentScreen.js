// سعر الطالب: الحالة + إرسال الوثائق للتوثيق
import React, { useState } from 'react';
import { View } from 'react-native';
import { api, imagePart } from '../api';
import { useApp } from '../AppContext';
import { Btn, Card, Field, Header, Icon, Notice, Pill, Row, Screen, showError, T } from '../components/ui';
import { ImageSlot } from './PaymentScreen';
import { colors, dir, fullDate } from '../theme';
import { t } from '../i18n';

export default function StudentScreen({ navigation }) {
  const { user, setUser, config } = useApp();
  const s = user.student || { status: 'none' };
  const verified = s.status === 'verified';
  const canSubmit = ['none', 'rejected', 'expired'].includes(s.status);
  const [form, setForm] = useState({ firstName: s.firstName || '', lastName: s.lastName || '', birthDate: s.birthDate || '', university: s.university || '', studentIdNo: s.studentIdNo || '' });
  const [card, setCard] = useState(null);
  const [cert, setCert] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const pct = config.studentDiscountPercent;

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return showError(new Error(t('vName')));
    if (!/^[A-Za-z\s'-]+$/.test(form.firstName + form.lastName)) return showError(new Error(t('vLatin')));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate)) return showError(new Error(t('vBirth')));
    if (!form.university.trim()) return showError(new Error(t('vUniversity')));
    if (!card || !cert) return showError(new Error(t('vDocs')));
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('card', imagePart(card, 'card'));
      fd.append('certificate', imagePart(cert, 'certificate'));
      setUser(await api('/me/student', { method: 'POST', form: fd }));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = t('studentStatus_' + s.status);

  return (
    <Screen header={<Header title={t('studentPrice')} onBack={() => navigation.goBack()} />}>
      <View style={{ backgroundColor: colors.purple, borderRadius: 22, padding: 20, gap: 8 }}>
        <Row gap={10}>
          <Icon name="school" size={28} color="#fff" />
          <T size={22} weight="700" color="#fff" style={{ flex: 1 }}>
            {t('studentHero', { p: pct })}
          </T>
        </Row>
        <T color="#DCD8F5">{t('studentHeroSub')}</T>
      </View>

      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="700">{t('verificationStatus')}</T>
          <Pill status={s.status} label={statusLabel} />
        </Row>
        {verified ? (
          <>
            <T color="#3E4A54">{t('verifiedText', { name: `${s.firstName} ${s.lastName}`, d: fullDate(s.validUntil) })}</T>
            <Notice kind="purple" icon="information-circle-outline">
              {t('studentRulesBooking')}
            </Notice>
            <Btn title={t('searchFlight')} icon="search" onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} />
          </>
        ) : s.status === 'pending' ? (
          <Notice icon="hourglass-outline">{t('pendingText')}</Notice>
        ) : s.status === 'rejected' ? (
          <Notice kind="danger" icon="close-circle-outline">{t('rejectedText', { r: s.rejectReason || '—' })}</Notice>
        ) : s.status === 'expired' ? (
          <Notice kind="warn" icon="time-outline">{t('expiredText')}</Notice>
        ) : null}
      </Card>

      {canSubmit ? (
        <Card style={{ gap: 12 }}>
          <T weight="700">{t('howVerify')}</T>
          {[t('verifyStep1'), t('verifyStep2'), t('verifyStep3', { age: config.studentMaxAge })].map((x, i) => (
            <Row key={i} gap={10} style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
                <T size={12} weight="700" color={colors.purple} center>
                  {i + 1}
                </T>
              </View>
              <T size={14} color="#3E4A54" style={{ flex: 1 }}>
                {x}
              </T>
            </Row>
          ))}
          <View style={{ flexDirection: dir.row, gap: 8 }}>
            <Field style={{ flex: 1 }} label={t('firstName')} ltr autoCapitalize="characters" value={form.firstName} onChangeText={set('firstName')} placeholder="MOHAMED" />
            <Field style={{ flex: 1 }} label={t('lastName')} ltr autoCapitalize="characters" value={form.lastName} onChangeText={set('lastName')} placeholder="AHMED" />
          </View>
          <View style={{ flexDirection: dir.row, gap: 8 }}>
            <Field style={{ flex: 1 }} label={t('birthDate')} ltr value={form.birthDate} onChangeText={set('birthDate')} placeholder="2003-05-20" keyboardType="numbers-and-punctuation" maxLength={10} />
            <Field style={{ flex: 1 }} label={t('studentIdOptional')} ltr value={form.studentIdNo} onChangeText={set('studentIdNo')} />
          </View>
          <Field label={t('university')} value={form.university} onChangeText={set('university')} placeholder={t('universityPh')} />
          <ImageSlot label={t('studentCardPhoto')} image={card} onPick={setCard} onClear={() => setCard(null)} />
          <ImageSlot label={t('certificatePhoto')} image={cert} onPick={setCert} onClear={() => setCert(null)} />
          <Btn title={t('sendForVerification')} icon="send" onPress={submit} loading={busy} />
        </Card>
      ) : null}
    </Screen>
  );
}
