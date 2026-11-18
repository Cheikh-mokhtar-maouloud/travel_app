// تفاصيل الحجز والتذكرة
import React, { useCallback, useState } from 'react';
import { Alert, Linking, Modal, Pressable, Share, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { api, fileUrl } from '../api';
import { useApp } from '../AppContext';
import { Btn, Card, Field, Header, Icon, Loading, Notice, Row, Screen, Segmented, showError, T } from '../components/ui';
import { SegmentBox } from '../components/flight';
import { colors, dateTime, dir, fullDate, hm, longDate, money } from '../theme';
import { t, loc } from '../i18n';
import { Price } from '../components/Price';

export default function BookingDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { config, cityName, refreshUser } = useApp();
  const [b, setB] = useState(null);
  const [reqModal, setReqModal] = useState(false);
  const [reqType, setReqType] = useState('change');
  const [reqNote, setReqNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setB(await api('/bookings/' + id));
    } catch (e) {
      showError(e);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!b)
    return (
      <Screen header={<Header title={t('booking')} onBack={() => navigation.goBack()} />}>
        <Loading />
      </Screen>
    );

  const cur = config.currency;
  const first = b.segments[0];
  const ticketed = b.status === 'ticketed';
  const closed = ['cancelled', 'expired', 'refunded'].includes(b.status);
  const openReq = b.customerRequest && b.customerRequest.status === 'open';
  const A = dir.arrow;
  const title = b.package ? loc(b.package, 'title') : first ? `${cityName(first.from)} ${A} ${cityName(first.to)}` : t('booking');

  const share = () => {
    const lines = [`${t('bookingRef', { ref: b.ref })}${b.pnr ? ` · PNR ${b.pnr}` : ''}`];
    if (b.package) lines.push(`${loc(b.package, 'title')}: ${fullDate(b.package.departDate)} ${A} ${fullDate(b.package.returnDate)}`);
    b.segments.forEach((sg) => lines.push(`${loc(sg, 'airline') || sg.airline} ${sg.flightNo}: ${cityName(sg.from)} ${hm(sg.departAt)} ${A} ${cityName(sg.to)} ${hm(sg.arriveAt)} (${longDate(sg.departAt.slice(0, 10))})`));
    lines.push(`${t('passengers')}: ` + b.passengers.map((p) => `${p.firstName} ${p.lastName}`).join(', '));
    Share.share({ message: lines.join('\n') });
  };

  const cancelUnpaid = () =>
    Alert.alert(t('cancelBooking'), t('cancelBookingQ'), [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yesCancel'),
        style: 'destructive',
        onPress: async () => {
          try {
            setB(await api(`/bookings/${id}/request`, { method: 'POST', body: { type: 'cancel' } }));
            refreshUser();
          } catch (e) {
            showError(e);
          }
        },
      },
    ]);

  const sendRequest = async () => {
    setBusy(true);
    try {
      setB(await api(`/bookings/${id}/request`, { method: 'POST', body: { type: reqType, note: reqNote } }));
      setReqModal(false);
      setReqNote('');
      Alert.alert(t('sent'), t('requestSent'));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const banner = {
    awaiting_payment: (
      <Card style={{ gap: 10, borderWidth: 1, borderColor: colors.gold }}>
        <Row gap={8}>
          <Icon name="time-outline" size={22} color={colors.goldInk} />
          <T weight="700" color={colors.goldInk} style={{ flex: 1 }}>
            {config.statusLabels.awaiting_payment}
          </T>
        </Row>
        {b.payment?.status === 'rejected' ? <Notice kind="danger">{t('proofRejected', { r: b.payment.reason })}</Notice> : null}
        <T color="#3E4A54">{t('payBeforeAuto', { d: dateTime(b.paymentDeadline) })}</T>
        <Btn title={b.paymentMethod === 'cash' ? t('cashDetails') : t('payNow')} onPress={() => navigation.navigate('Payment', { id })} />
      </Card>
    ),
    payment_review: <Notice icon="hourglass-outline">{t('bannerReview')}</Notice>,
    confirmed: <Notice kind="ok" icon="checkmark-circle-outline">{b.package ? t('bannerConfirmedPkg') : t('bannerConfirmed')}</Notice>,
    cancelled: <Notice kind="danger" icon="close-circle-outline">{t('bannerCancelled')}</Notice>,
    expired: <Notice kind="danger" icon="close-circle-outline">{t('bannerExpired')}</Notice>,
    refunded: <Notice icon="cash-outline">{t('bannerRefunded')}</Notice>,
  }[b.status];

  const line = (label, value, color) => (
    <Row style={{ justifyContent: 'space-between' }}>
      <T color={color || colors.muted}>{label}</T>
      <T color={color || colors.ink}>{value}</T>
    </Row>
  );

  return (
    <Screen
      onRefresh={load}
      header={
        <Header
          title={title}
          subtitle={t('bookingRef', { ref: b.ref })}
          onBack={() => navigation.goBack()}
          right={
            <Pressable accessibilityRole="button" accessibilityLabel={t('share')} onPress={share} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="share-outline" size={22} color={colors.ink} />
            </Pressable>
          }
        />
      }
    >
      {banner}
      {openReq ? <Notice kind="warn">{b.customerRequest.type === 'cancel' ? t('openCancelReq') : t('openChangeReq')}</Notice> : null}
      {ticketed && b.pointsEarned ? (
        <Notice kind="warn" icon="star">
          {t('earnedPoints', { n: b.pointsEarned })}
        </Notice>
      ) : null}

      {/* بطاقة التذكرة */}
      <View style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff' }}>
        <View style={{ backgroundColor: ticketed ? (b.package ? '#0B3B2E' : colors.accent) : colors.ink, padding: 16, gap: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <T size={12} weight="700" color="#fff">
                {config.statusLabels[b.status]}
              </T>
            </View>
            <T size={13} color="#fff">
              {b.package ? (b.package.type === 'hajj' ? t('hajj') : t('umrah')) : b.segments.length > 1 ? t('roundTrip') : t('oneWay')}
            </T>
          </Row>
          {b.package ? (
            <View style={{ gap: 4 }}>
              <T size={22} weight="700" color="#fff">
                {loc(b.package, 'title')}
              </T>
              <T size={13} color="#E1EAE6">
                {fullDate(b.package.departDate)} {A} {fullDate(b.package.returnDate)} · {t('room_' + b.package.roomType)}
              </T>
            </View>
          ) : first ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T size={32} weight="700" color="#fff" ltr>
                  {first.from}
                </T>
                <T size={13} color="#E1EAE6">
                  {cityName(first.from)}
                </T>
              </View>
              <Icon name="airplane" size={26} color="#fff" style={{ transform: [{ scaleX: dir.rtl ? -1 : 1 }] }} />
              <View style={{ alignItems: dir.aEnd }}>
                <T size={32} weight="700" color="#fff" ltr>
                  {first.to}
                </T>
                <T size={13} color="#E1EAE6">
                  {cityName(first.to)}
                </T>
              </View>
            </Row>
          ) : null}
        </View>
        {b.package ? (
          <View style={{ padding: 16, gap: 8 }}>
            {b.package.hotelMakkah ? line(t('hotelMakkah'), b.package.hotelMakkah) : null}
            {b.package.hotelMadinah ? line(t('hotelMadinah'), b.package.hotelMadinah) : null}
            {line(t('departFrom'), cityName(b.package.departCity))}
          </View>
        ) : (
          <View style={{ padding: 16, gap: 10 }}>
            {b.segments.map((sg, i) => (
              <SegmentBox key={i} seg={sg} label={b.segments.length > 1 ? (i === 0 ? t('outboundShort') : t('returnShort')) : null} />
            ))}
          </View>
        )}
        <View style={{ borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.line, marginHorizontal: 16 }} />
        <Row style={{ padding: 16, justifyContent: 'space-between' }}>
          <View style={{ gap: 2, flex: 1 }}>
            <T size={11} color={colors.muted}>
              {b.pnr ? t('pnrLabel') : t('bookingNo')}
            </T>
            <T size={b.pnr && b.pnr.length > 8 ? 18 : 24} weight="700" ltr style={{ letterSpacing: 2, textAlign: dir.start }} selectable>
              {b.pnr || b.ref}
            </T>
            {b.pnr ? (
              <T size={11} color={colors.muted} ltr style={{ textAlign: dir.start }}>
                {b.ref}
              </T>
            ) : null}
          </View>
          <View style={{ padding: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 10 }}>
            <QRCode value={`${b.ref}|${b.pnr || ''}`} size={76} color={colors.ink} />
          </View>
        </Row>
      </View>

      {ticketed ? (
        <View style={{ flexDirection: dir.row, gap: 8 }}>
          {b.ticketFile ? <Btn style={{ flex: 1 }} variant="dark" icon="download-outline" title={b.package ? t('downloadDocs') : t('downloadTicket')} onPress={() => Linking.openURL(fileUrl(b.ticketFile.name))} /> : null}
          <Btn style={{ flex: 1 }} variant="outline" icon="share-social-outline" title={t('share')} onPress={share} />
        </View>
      ) : null}

      <Card style={{ gap: 10 }}>
        <T weight="700">{t('passengers')}</T>
        {b.passengers.map((p, i) => (
          <Row key={i} style={{ paddingVertical: 6, borderBottomWidth: i < b.passengers.length - 1 ? 1 : 0, borderBottomColor: '#F0EBE0' }}>
            <View style={{ flex: 1 }}>
              <T weight="600" ltr style={{ textAlign: dir.start }}>
                {p.lastName}/{p.firstName}
              </T>
              <T size={12} color={colors.muted}>
                {t('type_' + p.type)} · {t('passportShort')} {p.passportNo}
                {p.isStudent ? ` · ${t('student')}` : ''}
              </T>
            </View>
            {p.ticketNumber ? (
              <View style={{ alignItems: dir.aEnd }}>
                <T size={11} color={colors.muted}>
                  {t('ticketNo')}
                </T>
                <T size={13} weight="600" ltr selectable>
                  {p.ticketNumber}
                </T>
              </View>
            ) : null}
          </Row>
        ))}
      </Card>

      <Card style={{ gap: 8 }}>
        <T weight="700">{t('payment')}</T>
        {b.studentDiscount || b.pointsDiscount ? line(t('ticketsPrice'), money(b.fareTotal, cur)) : null}
        {b.studentDiscount ? line(t('studentDiscountShort'), '− ' + money(b.studentDiscount, cur), colors.purple) : null}
        {b.pointsDiscount ? line(t('pointsDiscount', { n: b.pointsUsed }), '− ' + money(b.pointsDiscount, cur), colors.goldInk) : null}
        <Row style={{ justifyContent: 'space-between' }}>
          <T color={colors.muted}>{t('total')}</T>
          <Price amount={b.total} size={18} color={colors.ink} />
        </Row>
        {line(t('paymentMethod'), b.paymentMethod === 'cash' ? t('payAtAgency') : b.paymentMethodName)}
        {b.fare === 'flex' || b.fare === 'basic' ? line(t('fareType'), b.fare === 'flex' ? t('fareFlexLong') : t('fareBasic')) : null}
      </Card>

      <Btn title={t('chatAboutBooking')} icon="chatbubbles-outline" variant="outline" onPress={() => navigation.navigate('Chat', { type: 'booking', id: b.id, title: t('bookingRef', { ref: b.ref }) })} />

      {!closed ? b.status === 'awaiting_payment' ? <Btn title={t('cancelBooking')} variant="danger" onPress={cancelUnpaid} /> : !openReq ? <Btn title={t('requestChangeCancel')} variant="danger" onPress={() => setReqModal(true)} /> : null : null}

      <Modal visible={reqModal} transparent animationType="fade" onRequestClose={() => setReqModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(19,32,43,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 14 }}>
            <T size={18} weight="700">
              {t('requestChangeCancel')}
            </T>
            <Segmented
              value={reqType}
              onChange={setReqType}
              options={[
                { value: 'change', label: t('change') },
                { value: 'cancel', label: t('cancel') },
              ]}
            />
            <Field multiline label={reqType === 'change' ? t('whatToChange') : t('cancelReason')} value={reqNote} onChangeText={setReqNote} />
            <T size={12} color={colors.muted}>
              {b.fare === 'basic' ? t('basicWarning') : t('agencyWillReview')}
            </T>
            <View style={{ flexDirection: dir.row, gap: 8 }}>
              <Btn style={{ flex: 1 }} title={t('sendRequest')} onPress={sendRequest} loading={busy} />
              <Btn style={{ flex: 1 }} title={t('back')} variant="outline" onPress={() => setReqModal(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
