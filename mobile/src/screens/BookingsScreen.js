// حجوزاتي + طلبات الأسعار
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Btn, Empty, Icon, Loading, Pill, Row, Screen, Segmented, showError, T } from '../components/ui';
import { colors, dir, longDate, money, s, shortDate, ymd } from '../theme';
import { t, loc } from '../i18n';
import { Price } from '../components/Price';

const ACTIVE = ['awaiting_payment', 'payment_review', 'confirmed', 'ticketed'];

export const lastDate = (b) => (b.package ? b.package.returnDate : (b.segments[b.segments.length - 1]?.departAt || '9999').slice(0, 10));

export default function BookingsScreen({ navigation }) {
  const { config, cityName } = useApp();
  const [tab, setTab] = useState('upcoming');
  const [bookings, setBookings] = useState(null);
  const [requests, setRequests] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, r] = await Promise.all([api('/bookings'), api('/requests')]);
      setBookings(b);
      setRequests(r);
    } catch (e) {
      showError(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const today = ymd(new Date());
  const isUpcoming = (b) => ACTIVE.includes(b.status) && lastDate(b) >= today;
  const list = bookings ? (tab === 'upcoming' ? bookings.filter(isUpcoming) : bookings.filter((b) => !isUpcoming(b))) : null;
  const A = dir.arrow;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <T size={26} weight="700">
        {t('myBookings')}
      </T>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: t('upcoming') },
          { value: 'past', label: t('pastCancelled') },
          { value: 'requests', label: `${t('quoteRequests')}${requests?.some((r) => r.status === 'quoted') ? ' •' : ''}` },
        ]}
      />
      {!bookings ? (
        <Loading />
      ) : tab === 'requests' ? (
        <>
          <Btn title={t('newQuoteRequest')} icon="add" variant="outline" small onPress={() => navigation.navigate('RequestForm', {})} />
          {requests.length ? (
            requests.map((r) => (
              <Pressable key={r.id} onPress={() => navigation.navigate('RequestDetail', { id: r.id })} style={[s.card, { gap: 8 }]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T size={16} weight="700">
                    {cityName(r.from)} {A} {cityName(r.to)}
                  </T>
                  <Pill status={r.status} label={config.requestLabels[r.status]} />
                </Row>
                <T size={13} color={colors.muted}>
                  {longDate(r.date)}
                  {r.returnDate ? ` – ${shortDate(r.returnDate)}` : ''} · {t('nTravellers', { n: r.adults + r.children + r.infants })}
                </T>
                {r.offers.length ? (
                  <T size={13} weight="600" color={colors.accent}>
                    {t('nOffersFrom', { n: r.offers.length, p: money(Math.min(...r.offers.map((o) => o.totalPrice)), config.currency) })}
                  </T>
                ) : (
                  <T size={13} color={colors.muted}>
                    {t('agencySearching')}
                  </T>
                )}
              </Pressable>
            ))
          ) : (
            <Empty icon="paper-plane-outline" title={t('noRequests')} text={t('noRequestsText')} />
          )}
        </>
      ) : list.length ? (
        list.map((b) => {
          const first = b.segments[0];
          const last = b.segments[b.segments.length - 1];
          return (
            <Pressable key={b.id} onPress={() => navigation.navigate('BookingDetail', { id: b.id })} style={[s.card, { gap: 10 }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T size={13} color={colors.muted} ltr>
                  {b.ref}
                </T>
                <Pill status={b.status} label={config.statusLabels[b.status]} />
              </Row>
              <Row gap={10}>
                <Icon name={b.package ? 'moon' : 'airplane'} size={20} color={b.package ? colors.gold : colors.accent} />
                <View style={{ flex: 1 }}>
                  <T size={17} weight="700">
                    {b.package ? loc(b.package, 'title') : first ? `${cityName(first.from)} ${A} ${cityName(first.to)}${b.segments.length > 1 ? ' ⇄' : ''}` : ''}
                  </T>
                  <T size={13} color={colors.muted}>
                    {b.package ? `${longDate(b.package.departDate)} – ${shortDate(b.package.returnDate)}` : first ? `${longDate(first.departAt.slice(0, 10))}${b.segments.length > 1 ? ` – ${shortDate(last.departAt.slice(0, 10))}` : ''}` : ''} · {t('nTravellers', { n: b.passengers.length })}
                  </T>
                </View>
              </Row>
              <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEE8DC', paddingTop: 10 }}>
                <T size={13} color={b.status === 'awaiting_payment' ? colors.danger : colors.muted} weight={b.status === 'awaiting_payment' ? '700' : '400'}>
                  {b.status === 'awaiting_payment' ? t('completePayment') : b.pnr ? `PNR: ${b.pnr}` : b.paymentMethodName}
                </T>
                <Price amount={b.total} size={15} color={colors.ink} />
              </Row>
            </Pressable>
          );
        })
      ) : (
        <Empty icon="ticket-outline" title={tab === 'upcoming' ? t('noUpcoming') : t('nothingHere')} text={tab === 'upcoming' ? t('noUpcomingText') : null} action={tab === 'upcoming' ? <Btn title={t('searchFlight')} small onPress={() => navigation.navigate('Home')} /> : null} />
      )}
    </Screen>
  );
}
