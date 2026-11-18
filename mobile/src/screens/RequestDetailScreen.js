// تفاصيل طلب التسعيرة والعروض المرسلة من الوكالة
import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Btn, Card, Empty, Header, Icon, Loading, Notice, Pill, Row, Screen, showError, T } from '../components/ui';
import { AirlineBadge, SegmentBox } from '../components/flight';
import { colors, dir, longDate, money, shortDate, ymd } from '../theme';
import { t, bag } from '../i18n';
import { Price } from '../components/Price';

export default function RequestDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { config, cityName } = useApp();
  const [r, setR] = useState(null);

  const load = useCallback(async () => {
    try {
      setR(await api('/requests/' + id));
    } catch (e) {
      showError(e);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!r)
    return (
      <Screen header={<Header title={t('request')} onBack={() => navigation.goBack()} />}>
        <Loading />
      </Screen>
    );

  const open = r.status === 'new' || r.status === 'quoted';
  const today = ymd(new Date());
  const A = dir.arrow;
  const routeTitle = `${cityName(r.from)} ${A} ${cityName(r.to)}`;

  const close = () =>
    Alert.alert(t('closeRequest'), t('closeRequestQ'), [
      { text: t('back'), style: 'cancel' },
      {
        text: t('close'),
        style: 'destructive',
        onPress: async () => {
          try {
            setR(await api(`/requests/${id}/close`, { method: 'POST' }));
          } catch (e) {
            showError(e);
          }
        },
      },
    ]);

  return (
    <Screen onRefresh={load} header={<Header title={routeTitle} subtitle={t('requestNo', { n: r.id })} onBack={() => navigation.goBack()} />}>
      <Card style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="700">{t('requestDetails')}</T>
          <Pill status={r.status} label={config.requestLabels[r.status]} />
        </Row>
        <T color="#3E4A54">
          {r.tripType === 'round' ? t('roundTrip') : t('oneWay')} · {longDate(r.date)}
          {r.returnDate ? ` – ${shortDate(r.returnDate)}` : ''}
        </T>
        <T color="#3E4A54">
          {t('nAdults', { n: r.adults })}
          {r.children ? ` · ${t('nChildren', { n: r.children })}` : ''}
          {r.infants ? ` · ${t('nInfants', { n: r.infants })}` : ''} · {r.cabin === 'business' ? t('business') : t('economy')}
        </T>
        {r.notes ? <T color={colors.muted}>“{r.notes}”</T> : null}
      </Card>

      {r.status === 'accepted' ? <Notice kind="ok">{t('offerAccepted')}</Notice> : null}

      <T size={17} weight="700">
        {t('offersN', { n: r.offers.length })}
      </T>
      {r.offers.length ? (
        r.offers.map((o) => {
          const expired = o.validUntil && o.validUntil < today;
          const accepted = r.acceptedOfferId === o.id;
          return (
            <Card key={o.id} style={{ gap: 10, borderWidth: accepted ? 2 : 0, borderColor: colors.accent }}>
              <Row gap={10}>
                <AirlineBadge code={o.airlineCode} />
                <T weight="700" style={{ flex: 1 }}>
                  {o.airline}
                </T>
                <Price amount={o.totalPrice} />
              </Row>
              {o.segments.map((sg, i) => (
                <SegmentBox key={i} seg={sg} label={o.segments.length > 1 ? (i === 0 ? t('outboundShort') : t('returnShort')) : null} />
              ))}
              {o.baggage ? (
                <Row gap={6}>
                  <Icon name="briefcase-outline" size={16} color={colors.muted} />
                  <T size={13} color={colors.muted}>
                    {bag(o.baggage)}
                  </T>
                </Row>
              ) : null}
              {o.conditions ? (
                <T size={13} color="#3E4A54">
                  {o.conditions}
                </T>
              ) : null}
              {o.validUntil ? (
                <T size={12} color={expired ? colors.danger : colors.muted}>
                  {expired ? t('offerExpired') : t('offerValidUntil', { d: longDate(o.validUntil) })}
                </T>
              ) : null}
              {open && !expired ? <Btn title={t('acceptOffer')} onPress={() => navigation.navigate('BookingForm', { mode: 'offer', request: r, offer: o })} /> : null}
              {accepted ? (
                <T weight="700" color={colors.accent}>
                  ✔ {t('acceptedOffer')}
                </T>
              ) : null}
            </Card>
          );
        })
      ) : (
        <Empty icon="hourglass-outline" title={t('waitingOffers')} text={t('waitingOffersText')} />
      )}

      <Btn title={t('chatAgency')} icon="chatbubbles-outline" variant="outline" onPress={() => navigation.navigate('Chat', { type: 'request', id: r.id, title: routeTitle })} />
      {open ? <Btn title={t('closeRequest')} variant="danger" onPress={close} /> : null}
    </Screen>
  );
}
