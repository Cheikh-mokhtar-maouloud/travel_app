// الدفع: تفاصيل الحساب + إرسال رقم العملية وصورة الإيصال
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, imagePart } from '../api';
import { useApp } from '../AppContext';
import { Btn, Card, Field, Header, Icon, Loading, Notice, Row, Screen, showError, T } from '../components/ui';
import { colors, dateTime, dir, money } from '../theme';
import { t } from '../i18n';
import { useFx } from '../components/Price';

export async function pickImage(camera) {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    showError(new Error(t('photoPermission')));
    return null;
  }
  const fn = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const r = await fn({ mediaTypes: ['images'], quality: 0.6 });
  return !r.canceled && r.assets?.[0] ? r.assets[0] : null;
}

export function ImageSlot({ image, onPick, onClear, label }) {
  if (image) {
    return (
      <View style={{ gap: 8 }}>
        <Image source={{ uri: image.uri }} style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: '#eee' }} resizeMode="contain" />
        <Btn title={t('removeImage')} variant="danger" small onPress={onClear} />
      </View>
    );
  }
  const box = (camera, icon, text) => (
    <Pressable onPress={async () => { const a = await pickImage(camera); if (a) onPick(a); }} style={{ flex: 1, height: 90, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C9C1AE', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FAF8F3' }}>
      <Icon name={icon} size={24} color={colors.ink} />
      <T size={13} weight="600" center>
        {text}
      </T>
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <T size={13} color={colors.muted}>
          {label}
        </T>
      ) : null}
      <View style={{ flexDirection: dir.row, gap: 8 }}>
        {box(false, 'image-outline', t('fromPhotos'))}
        {box(true, 'camera-outline', t('takePhoto'))}
      </View>
    </View>
  );
}

export default function PaymentScreen({ route, navigation }) {
  const { id } = route.params;
  const { config } = useApp();
  const fx = useFx();
  const [b, setB] = useState(null);
  const [reference, setReference] = useState('');
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setB(await api('/bookings/' + id));
    } catch (e) {
      showError(e);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!reference.trim() && !image) return showError(new Error(t('needProof')));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('reference', reference.trim());
      if (image) fd.append('receipt', imagePart(image, 'receipt'));
      await api(`/bookings/${id}/payment`, { method: 'POST', form: fd });
      navigation.replace('BookingDetail', { id });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!b)
    return (
      <Screen header={<Header title={t('payment')} onBack={() => navigation.goBack()} />}>
        <Loading />
      </Screen>
    );

  const method = config.paymentMethods.find((m) => m.id === b.paymentMethod) || { name: b.paymentMethodName };
  const isCash = b.paymentMethod === 'cash';
  const rejected = b.payment && b.payment.status === 'rejected';
  const rows = (label, value, ltr) => (
    <Row style={{ justifyContent: 'space-between' }}>
      <T color={colors.muted}>{label}</T>
      <T size={ltr ? 17 : 15} weight="700" ltr={ltr} selectable>
        {value}
      </T>
    </Row>
  );

  return (
    <Screen header={<Header title={t('payment')} subtitle={t('bookingRef', { ref: b.ref })} onBack={() => navigation.goBack()} />}>
      <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 22 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="checkmark" size={30} color={colors.accent} />
        </View>
        <T size={18} weight="700" center>
          {b.package ? t('placesHeld') : t('seatsHeld')}
        </T>
        <T color={colors.muted} center>
          {t('amountDue')}
        </T>
        <T size={30} weight="700" center>
          {money(b.total, config.currency)}
        </T>
        <T size={13} color={colors.muted} center ltr>
          {fx(b.total)}
        </T>
        {b.studentDiscount || b.pointsDiscount ? (
          <T size={13} color={colors.accent} center>
            {t('youSaved', { v: money((b.studentDiscount || 0) + (b.pointsDiscount || 0), config.currency) })}
          </T>
        ) : null}
        <T size={13} color={colors.danger} center>
          {t('payBefore', { d: dateTime(b.paymentDeadline) })}
        </T>
      </Card>

      {rejected ? <Notice kind="danger" icon="alert-circle-outline">{t('proofRejected', { r: b.payment.reason })}</Notice> : null}

      {b.status !== 'awaiting_payment' ? (
        <>
          <Notice kind="ok">{t('proofReceived')}</Notice>
          <Btn title={t('viewBooking')} onPress={() => navigation.replace('BookingDetail', { id })} />
        </>
      ) : isCash ? (
        <>
          <Card style={{ gap: 8 }}>
            <T weight="700">{t('cashTitle')}</T>
            <T color="#3E4A54">{t('cashGiveRef')}</T>
            <T size={26} weight="700" ltr center style={{ letterSpacing: 3 }} selectable>
              {b.ref}
            </T>
            {config.address ? (
              <Row gap={6}>
                <Icon name="location-outline" size={16} color={colors.muted} />
                <T color={colors.muted}>{config.address}</T>
              </Row>
            ) : null}
          </Card>
          <Btn title={t('okViewBooking')} onPress={() => navigation.replace('BookingDetail', { id })} />
        </>
      ) : (
        <>
          <Card style={{ gap: 10 }}>
            <T weight="700">{t('step1Transfer', { m: method.name })}</T>
            <T size={12} color={colors.muted}>
              {t('payInMRU')}
            </T>
            <View style={{ backgroundColor: '#F8F6F0', borderRadius: 14, padding: 14, gap: 8 }}>
              {rows(t('accountNo'), method.account, true)}
              {method.holder ? rows(t('accountHolder'), method.holder) : null}
              {rows(t('amount'), money(b.total, config.currency))}
              {rows(t('writeInNote'), b.ref, true)}
            </View>
          </Card>
          <Card style={{ gap: 12 }}>
            <T weight="700">{t('step2Proof')}</T>
            <Field label={t('transactionId')} ltr value={reference} onChangeText={setReference} placeholder="123456789" />
            <ImageSlot image={image} onPick={setImage} onClear={() => setImage(null)} label={t('receiptLabel')} />
            <Btn title={t('sendProof')} onPress={submit} loading={busy} />
          </Card>
          <Pressable onPress={() => navigation.replace('BookingDetail', { id })} style={{ padding: 8 }}>
            <T color={colors.muted} center>
              {t('payLater')}
            </T>
          </Pressable>
        </>
      )}
    </Screen>
  );
}
