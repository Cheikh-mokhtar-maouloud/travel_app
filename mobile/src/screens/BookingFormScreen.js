// إتمام الحجز: نوع التذكرة، المسافرون (مع المحفوظين)، سعر الطالب، النقاط، طريقة الدفع
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { api } from '../api';
import { useApp } from '../AppContext';
import { BottomBar, Btn, Card, Choice, Field, Header, Icon, Notice, Row, Screen, showError, T, Toggle } from '../components/ui';
import { SegmentBox } from '../components/flight';
import { Price, useFx } from '../components/Price';
import { colors, dir, fullDate, money } from '../theme';
import { t, loc, bag } from '../i18n';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const norm = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');

function buildPassengers(p, nat) {
  const list = [];
  for (let i = 0; i < p.adults; i++) list.push('adult');
  for (let i = 0; i < p.children; i++) list.push('child');
  for (let i = 0; i < p.infants; i++) list.push('infant');
  return list.map((type) => ({ type, gender: 'M', firstName: '', lastName: '', passportNo: '', passportExpiry: '', birthDate: '', nationality: nat, saveTraveler: true, fromSaved: null }));
}

export default function BookingFormScreen({ route, navigation }) {
  const { mode, outbound, inbound, request, offer, pkg, roomType } = route.params;
  const { config, user, isStudent, refreshUser, cityName } = useApp();
  const pax = mode === 'offer' ? { adults: request.adults, children: request.children, infants: request.infants } : route.params.pax;
  const legs = mode === 'flights' ? [outbound, inbound].filter(Boolean) : [];
  const allLocal = legs.length && legs.every((l) => l.provider !== 'amadeus');
  const hasAmadeus = legs.some((l) => l.provider === 'amadeus');
  const [fare, setFare] = useState('basic');
  const [passengers, setPassengers] = useState(() => buildPassengers(pax, t('defaultNationality')));
  const [studentIdx, setStudentIdx] = useState(null);
  const [usePoints, setUsePoints] = useState(false);
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [method, setMethod] = useState(config?.paymentMethods?.[0]?.id);
  const [busy, setBusy] = useState(false);
  const saved = user?.travelers || [];
  const cur = config?.currency;
  const fx = useFx();

  // ---------- حساب السعر (للعرض؛ الخادم يحسبه نهائياً) ----------
  const pctOf = (type) => (type === 'child' ? config.childPercent : type === 'infant' ? config.infantPercent : 100) / 100;
  const room = pkg ? pkg.roomPrices.find((r) => r.room === roomType) : null;
  const paxAmount = (type) => {
    if (mode === 'package') return type === 'adult' ? room.price : type === 'child' ? pkg.childPrice || room.price : pkg.infantPrice || Math.round(room.price * pctOf('infant'));
    return legs.reduce((a, l) => a + Math.round(((fare === 'flex' && l.fares.flex ? l.fares.flex.price : l.fares.basic.price) || 0) * pctOf(type)), 0);
  };
  const fareTotal = mode === 'offer' ? Number(offer.totalPrice) : mode === 'package' ? passengers.reduce((a, p) => a + paxAmount(p.type), 0) : legs.reduce((a, l) => a + (fare === 'flex' && l.fares.flex ? l.fares.flex.total : l.fares.basic.total), 0);
  const studentDiscount = studentIdx !== null ? Math.round((paxAmount(passengers[studentIdx].type) * config.studentDiscountPercent) / 100) : 0;
  const subtotal = fareTotal - studentDiscount;
  const P = config.points || {};
  const balance = user?.points || 0;
  const canUsePoints = P.enabled && balance >= P.minRedeem;
  const pointsToUse = usePoints && canUsePoints ? Math.min(balance, Math.floor(Math.floor((subtotal * P.maxRedeemPercent) / 100) / P.pointValue)) : 0;
  const pointsDiscount = pointsToUse * (P.pointValue || 0);
  const total = subtotal - pointsDiscount;
  const willEarn = P.enabled ? Math.floor(total / P.earnPer) : 0;

  const update = (i, patch) => setPassengers((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const fillFromSaved = (i, tr) => {
    if (passengers[i].fromSaved === tr.id) return update(i, { fromSaved: null, firstName: '', lastName: '', passportNo: '', passportExpiry: '', birthDate: '', gender: 'M', saveTraveler: true });
    if (studentIdx === i) setStudentIdx(null);
    update(i, { fromSaved: tr.id, firstName: tr.firstName, lastName: tr.lastName, passportNo: tr.passportNo, passportExpiry: tr.passportExpiry, birthDate: tr.birthDate, gender: tr.gender, nationality: tr.nationality || passengers[i].nationality, saveTraveler: false });
  };

  const toggleStudent = (i, on) => {
    if (!on) return setStudentIdx(null);
    const st = user.student;
    setStudentIdx(i);
    update(i, { firstName: st.firstName, lastName: st.lastName, birthDate: st.birthDate || passengers[i].birthDate });
  };

  const validate = () => {
    const lastTravel = mode === 'package' ? pkg.returnDate : (legs[legs.length - 1] || (offer && offer.segments[offer.segments.length - 1]) || {}).departAt?.slice(0, 10) || '';
    for (const [i, p] of passengers.entries()) {
      const n = t('passengerN', { n: i + 1 });
      if (!p.firstName.trim() || !p.lastName.trim()) return `${n}: ${t('vName')}`;
      if (!/^[A-Za-z\s'-]+$/.test(p.firstName + p.lastName)) return `${n}: ${t('vLatin')}`;
      if (!p.passportNo.trim()) return `${n}: ${t('vPassport')}`;
      if (!DATE_RE.test(p.passportExpiry)) return `${n}: ${t('vExpiry')}`;
      if (lastTravel && p.passportExpiry < lastTravel) return `${n}: ${t('vExpired')}`;
      if ((p.type !== 'adult' || hasAmadeus) && !DATE_RE.test(p.birthDate)) return `${n}: ${t('vBirth')}`;
      if (p.birthDate && !DATE_RE.test(p.birthDate)) return `${n}: ${t('vBirth')}`;
    }
    if (studentIdx !== null) {
      const p = passengers[studentIdx];
      if (norm(p.firstName) !== norm(user.student.firstName) || norm(p.lastName) !== norm(user.student.lastName)) return t('vStudentName', { name: `${user.student.firstName} ${user.student.lastName}` });
    }
    if (contactPhone.replace(/\D/g, '').length < 8) return t('vPhone');
    if (!method) return t('vMethod');
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) return showError(new Error(err));
    setBusy(true);
    try {
      const body = { passengers: passengers.map(({ fromSaved, ...p }) => p), contactPhone, paymentMethod: method, studentPassengerIndex: studentIdx, pointsToUse };
      if (mode === 'offer') Object.assign(body, { requestId: request.id, offerId: offer.id });
      else if (mode === 'package') Object.assign(body, { packageId: pkg.id, roomType });
      else Object.assign(body, { outboundFlightId: outbound.id, inboundFlightId: inbound?.id, fare });
      const b = await api('/bookings', { method: 'POST', body });
      refreshUser();
      navigation.reset({ index: 1, routes: [{ name: 'Tabs', params: { screen: 'Bookings' } }, { name: 'Payment', params: { id: b.id } }] });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const fareCard = (k, title) => {
    const on = fare === k;
    const f = outbound.fares[k];
    const tot = legs.reduce((a, l) => a + l.fares[k].total, 0);
    return (
      <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setFare(k)} style={{ flex: 1, padding: 14, borderRadius: 16, borderWidth: on ? 2 : 1, borderColor: on ? colors.accent : colors.line, backgroundColor: on ? colors.accentSoft : '#fff', gap: 6 }}>
        <T weight="700">{title}</T>
        <T size={12} color="#3E4A54">
          {bag(f.baggage)}
        </T>
        {[
          [f.changeable, t('changeDate')],
          [f.refundable, t('refund')],
        ].map(([ok, label]) => (
          <Row key={label} gap={4}>
            <Icon name={ok ? 'checkmark-circle' : 'close-circle'} size={14} color={ok ? colors.accent : '#9AA3AA'} />
            <T size={12} color="#3E4A54">
              {label}
            </T>
          </Row>
        ))}
        <T weight="700" size={15}>
          {money(tot, cur)}
        </T>
      </Pressable>
    );
  };

  const line = (label, value, opts = {}) => (
    <Row style={{ justifyContent: 'space-between' }}>
      <T color={opts.color || colors.muted}>{label}</T>
      <T weight={opts.bold ? '700' : '400'} size={opts.bold ? 18 : 15} color={opts.color || colors.ink}>
        {value}
      </T>
    </Row>
  );

  const methodObj = config?.paymentMethods?.find((m) => m.id === method);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={<Header title={t('completeBooking')} onBack={() => navigation.goBack()} />}
        footer={
          <BottomBar>
            <View style={{ flex: 1 }}>
              <T size={12} color={colors.muted}>
                {t('totalForN', { n: passengers.length })}
              </T>
              <Price amount={total} size={20} color={colors.ink} align={dir.aStart} />
            </View>
            <Btn title={t('confirmBooking')} onPress={submit} loading={busy} />
          </BottomBar>
        }
      >
        {/* الرحلة */}
        <Card style={{ gap: 10 }}>
          {mode === 'package' ? (
            <>
              <T weight="700">{loc(pkg, 'title')}</T>
              <T color={colors.muted}>
                {fullDate(pkg.departDate)} {dir.arrow} {fullDate(pkg.returnDate)} · {cityName(pkg.departCity)}
              </T>
              <T color={colors.muted}>
                {t('room_' + roomType)} · {money(room.price, cur)} {t('perPerson')}
              </T>
            </>
          ) : (
            <>
              <T weight="700">{t('yourTrip')}</T>
              {(mode === 'offer' ? offer.segments : legs).map((sg, i, arr) => (
                <SegmentBox key={i} seg={sg} label={arr.length > 1 ? (i === 0 ? t('outboundShort') : t('returnShort')) : null} />
              ))}
              {mode === 'offer' && offer.conditions ? <Notice>{offer.conditions}</Notice> : null}
            </>
          )}
        </Card>

        {mode === 'flights' && allLocal && outbound.fares.flex ? (
          <View style={{ gap: 8 }}>
            <T weight="700">{t('chooseFare')}</T>
            <View style={{ flexDirection: dir.row, gap: 8 }}>
              {fareCard('basic', t('fareBasic'))}
              {fareCard('flex', t('fareFlex'))}
            </View>
          </View>
        ) : hasAmadeus ? (
          <Notice icon="globe-outline">{t('liveFareNote')}</Notice>
        ) : null}

        {/* المسافرون */}
        {passengers.map((p, i) => {
          const opts = saved.filter((tr) => (tr.type || 'adult') === p.type);
          const studentAllowed = mode === 'flights' && isStudent && p.type !== 'infant' && (studentIdx === null || studentIdx === i);
          return (
            <Card key={i} style={{ gap: 12 }}>
              <View>
                <T weight="700">
                  {t('passengerN', { n: i + 1 })} · {t('type_' + p.type)}
                </T>
                <T size={12} color={colors.muted}>
                  {t('latinHint')}
                </T>
              </View>
              {opts.length ? (
                <View style={{ gap: 6 }}>
                  <T size={13} color={colors.muted}>
                    {t('fromSaved')}
                  </T>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: dir.row }}>
                    {opts.map((tr) => {
                      const on = p.fromSaved === tr.id;
                      const usedElsewhere = passengers.some((x, j) => j !== i && x.fromSaved === tr.id);
                      return (
                        <Pressable key={tr.id} disabled={!!usedElsewhere} onPress={() => fillFromSaved(i, tr)} style={{ paddingHorizontal: 12, height: 38, borderRadius: 19, justifyContent: 'center', backgroundColor: on ? colors.accent : '#fff', borderWidth: 1, borderColor: on ? colors.accent : colors.lineStrong, opacity: usedElsewhere ? 0.35 : 1 }}>
                          <T size={13} weight="600" color={on ? '#fff' : colors.ink}>
                            {tr.firstName} {tr.lastName}
                            {tr.relation ? ` · ${tr.relation}` : ''}
                          </T>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
              {studentAllowed ? <Toggle icon="school" color={colors.purple} value={studentIdx === i} onChange={(v) => toggleStudent(i, v)} title={t('iAmStudent', { p: config.studentDiscountPercent })} sub={t('iAmStudentSub')} /> : null}
              <Choice
                value={p.gender}
                onChange={(v) => update(i, { gender: v })}
                options={[
                  { value: 'M', label: t('male') },
                  { value: 'F', label: t('female') },
                ]}
              />
              <View style={{ flexDirection: dir.row, gap: 8 }}>
                <Field style={{ flex: 1 }} label={t('firstName')} ltr autoCapitalize="characters" value={p.firstName} onChangeText={(v) => update(i, { firstName: v, fromSaved: null })} placeholder="MOHAMED" editable={studentIdx !== i} />
                <Field style={{ flex: 1 }} label={t('lastName')} ltr autoCapitalize="characters" value={p.lastName} onChangeText={(v) => update(i, { lastName: v, fromSaved: null })} placeholder="AHMED" editable={studentIdx !== i} />
              </View>
              <View style={{ flexDirection: dir.row, gap: 8 }}>
                <Field style={{ flex: 1 }} label={t('passportNo')} ltr autoCapitalize="characters" value={p.passportNo} onChangeText={(v) => update(i, { passportNo: v })} />
                <Field style={{ flex: 1 }} label={t('passportExpiry')} ltr value={p.passportExpiry} onChangeText={(v) => update(i, { passportExpiry: v })} placeholder="2030-12-31" keyboardType="numbers-and-punctuation" maxLength={10} />
              </View>
              <View style={{ flexDirection: dir.row, gap: 8 }}>
                <Field style={{ flex: 1 }} label={p.type === 'adult' && !hasAmadeus ? t('birthOptional') : t('birthDate')} ltr value={p.birthDate} onChangeText={(v) => update(i, { birthDate: v })} placeholder="1990-01-31" keyboardType="numbers-and-punctuation" maxLength={10} />
                <Field style={{ flex: 1 }} label={t('nationality')} value={p.nationality} onChangeText={(v) => update(i, { nationality: v })} />
              </View>
              {!p.fromSaved ? <Toggle value={p.saveTraveler} onChange={(v) => update(i, { saveTraveler: v })} title={t('saveTraveler')} sub={t('saveTravelerSub')} /> : null}
            </Card>
          );
        })}

        <Card style={{ gap: 12 }}>
          <T weight="700">{t('contact')}</T>
          <Field label={t('contactPhone')} ltr keyboardType="phone-pad" value={contactPhone} onChangeText={setContactPhone} />
        </Card>

        {/* النقاط */}
        {P.enabled ? (
          <Card style={{ gap: 10 }}>
            <Toggle
              icon="star"
              color={colors.gold}
              value={usePoints && canUsePoints}
              disabled={!canUsePoints}
              onChange={setUsePoints}
              title={t('usePoints')}
              sub={canUsePoints ? t('usePointsSub', { n: balance, v: money(Math.min(balance, Math.floor(Math.floor((subtotal * P.maxRedeemPercent) / 100) / P.pointValue)) * P.pointValue, cur) }) : t('pointsNotEnough', { n: balance, min: P.minRedeem })}
            />
            {willEarn > 0 ? (
              <T size={13} color={colors.goldInk}>
                {t('willEarn', { n: willEarn })}
              </T>
            ) : null}
          </Card>
        ) : null}

        <Card style={{ gap: 10 }}>
          <T weight="700">{t('paymentMethod')}</T>
          <View style={{ flexDirection: dir.row, flexWrap: 'wrap', gap: 8 }}>
            {(config?.paymentMethods || []).map((m) => {
              const on = m.id === method;
              return (
                <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setMethod(m.id)} style={{ width: '48.5%', padding: 12, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? colors.accent : colors.line, backgroundColor: on ? colors.accentSoft : '#fff', gap: 2 }}>
                  <T weight="700">{m.id === 'cash' ? t('payAtAgency') : m.name}</T>
                  <T size={12} color={colors.muted} numberOfLines={1}>
                    {m.id === 'cash' ? t('cashSub') : t('transferSub')}
                  </T>
                </Pressable>
              );
            })}
          </View>
          {methodObj ? <Notice kind="warn" icon="time-outline">{methodObj.id === 'cash' ? t('cashNote', { h: config.paymentDeadlineHours }) : t('transferNote', { m: methodObj.name, h: config.paymentDeadlineHours })}</Notice> : null}
        </Card>

        {/* ملخص السعر */}
        <Card style={{ gap: 8 }}>
          <T weight="700">{t('priceSummary')}</T>
          {line(t('ticketsPrice'), money(fareTotal, cur))}
          {studentDiscount ? line(t('studentDiscount', { p: config.studentDiscountPercent }), '− ' + money(studentDiscount, cur), { color: colors.purple }) : null}
          {pointsDiscount ? line(t('pointsDiscount', { n: pointsToUse }), '− ' + money(pointsDiscount, cur), { color: colors.goldInk }) : null}
          <View style={{ height: 1, backgroundColor: colors.line }} />
          {line(t('total'), money(total, cur), { bold: true })}
          <T size={12} color={colors.muted} style={{ textAlign: dir.rtl ? 'left' : 'right' }} ltr>
            {fx(total)}
          </T>
          <T size={12} color={colors.muted}>
            {t('payInMRU')}
          </T>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
