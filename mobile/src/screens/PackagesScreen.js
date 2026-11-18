// باقات العمرة والحج: القائمة والتفاصيل
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useApp } from '../AppContext';
import { BottomBar, Btn, Card, Empty, Header, Icon, Loading, Notice, PickerField, Row, Screen, Segmented, showError, T } from '../components/ui';
import { PaxPicker, paxSummary } from '../components/pickers';
import { colors, dir, fullDate, money, s } from '../theme';
import { t, loc } from '../i18n';
import { Price } from '../components/Price';

const nights = (p) => (p.nightsMakkah || 0) + (p.nightsMadinah || 0);

export function PackagesScreen({ navigation }) {
  const { config } = useApp();
  const [list, setList] = useState(null);
  const [type, setType] = useState('all');

  useFocusEffect(
    useCallback(() => {
      api('/packages').then(setList, showError);
    }, [])
  );

  const shown = (list || []).filter((p) => type === 'all' || p.type === type);
  const hasHajj = (list || []).some((p) => p.type === 'hajj');

  return (
    <Screen header={<Header title={t('umrahHajj')} subtitle={t('umrahHajjSub')} onBack={() => navigation.goBack()} />}>
      {hasHajj ? (
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: t('all') },
            { value: 'umrah', label: t('umrah') },
            { value: 'hajj', label: t('hajj') },
          ]}
        />
      ) : null}
      {!list ? (
        <Loading />
      ) : shown.length ? (
        shown.map((p) => (
          <Pressable key={p.id} onPress={() => navigation.navigate('PackageDetail', { id: p.id })} style={[s.card, { padding: 0, overflow: 'hidden' }]}>
            <View style={{ backgroundColor: '#0B3B2E', padding: 16, gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ backgroundColor: colors.gold, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                  <T size={12} weight="700" color="#0B3B2E">
                    {p.type === 'hajj' ? t('hajj') : t('umrah')}
                  </T>
                </View>
                {p.seats <= 10 ? (
                  <T size={12} weight="700" color="#F6D58E">
                    {t('placesLeft', { n: p.seats })}
                  </T>
                ) : null}
              </Row>
              <T size={19} weight="700" color="#fff">
                {loc(p, 'title')}
              </T>
              <T size={13} color="#C8DDD4">
                {fullDate(p.departDate)} {dir.arrow} {fullDate(p.returnDate)}
                {nights(p) ? ` · ${t('nNights', { n: nights(p) })}` : ''}
              </T>
            </View>
            <View style={{ padding: 16, gap: 8 }}>
              {p.hotelMakkah ? (
                <Row gap={8}>
                  <Icon name="business-outline" size={16} color={colors.muted} />
                  <T size={13} color="#3E4A54" style={{ flex: 1 }} numberOfLines={1}>
                    {t('makkah')}: {p.hotelMakkah}
                  </T>
                </Row>
              ) : null}
              <Row style={{ justifyContent: 'space-between' }}>
                <T size={13} color={colors.muted}>
                  {p.airline}
                </T>
                <View style={{ alignItems: dir.aEnd }}>
                  <T size={11} color={colors.muted}>
                    {t('fromPerPerson')}
                  </T>
                  <Price amount={p.fromPrice} />
                </View>
              </Row>
            </View>
          </Pressable>
        ))
      ) : (
        <Empty icon="moon-outline" title={t('noPackages')} text={t('noPackagesText')} />
      )}
    </Screen>
  );
}

export function PackageDetailScreen({ route, navigation }) {
  const { config, cityName } = useApp();
  const [p, setP] = useState(null);
  const [room, setRoom] = useState(null);
  const [pax, setPax] = useState({ adults: 1, children: 0, infants: 0 });
  const [picker, setPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api('/packages/' + route.params.id).then((x) => {
        setP(x);
        setRoom((r) => r || x.roomPrices[0].room);
      }, showError);
    }, [route.params.id])
  );

  if (!p)
    return (
      <Screen header={<Header title={t('umrahHajj')} onBack={() => navigation.goBack()} />}>
        <Loading />
      </Screen>
    );

  const r = p.roomPrices.find((x) => x.room === room) || p.roomPrices[0];
  const childP = p.childPrice || r.price;
  const infantP = p.infantPrice || Math.round((r.price * config.infantPercent) / 100);
  const total = pax.adults * r.price + pax.children * childP + pax.infants * infantP;
  const seatsNeeded = pax.adults + pax.children;
  const includes = loc(p, 'includes') && loc(p, 'includes').length ? loc(p, 'includes') : p.includes;

  const book = () => {
    if (seatsNeeded > p.seats) return showError(new Error(t('notEnoughPlaces')));
    navigation.navigate('BookingForm', { mode: 'package', pkg: p, roomType: r.room, pax });
  };

  return (
    <Screen
      header={<Header title={loc(p, 'title')} subtitle={p.type === 'hajj' ? t('hajj') : t('umrah')} onBack={() => navigation.goBack()} />}
      footer={
        <BottomBar>
          <View style={{ flex: 1 }}>
            <T size={12} color={colors.muted}>
              {paxSummary(pax, true)}
            </T>
            <Price amount={total} size={20} color={colors.ink} align={dir.aStart} />
          </View>
          <Btn title={t('bookNow')} onPress={book} disabled={!p.seats} />
        </BottomBar>
      }
    >
      <View style={{ backgroundColor: '#0B3B2E', borderRadius: 22, padding: 20, gap: 8 }}>
        <Icon name="moon" size={28} color={colors.gold} />
        <T size={22} weight="700" color="#fff">
          {loc(p, 'title')}
        </T>
        <T color="#C8DDD4">
          {fullDate(p.departDate)} {dir.arrow} {fullDate(p.returnDate)}
        </T>
        {loc(p, 'description') ? <T color="#E1EAE6">{loc(p, 'description')}</T> : null}
      </View>

      <Card style={{ gap: 10 }}>
        {[
          ['airplane-outline', t('flight'), p.airline],
          ['location-outline', t('departFrom'), cityName(p.departCity)],
          ['business-outline', t('hotelMakkah'), p.hotelMakkah ? `${p.hotelMakkah}${p.nightsMakkah ? ` · ${t('nNights', { n: p.nightsMakkah })}` : ''}` : ''],
          ['business-outline', t('hotelMadinah'), p.hotelMadinah ? `${p.hotelMadinah}${p.nightsMadinah ? ` · ${t('nNights', { n: p.nightsMadinah })}` : ''}` : ''],
        ]
          .filter((x) => x[2])
          .map(([icon, label, value]) => (
            <Row key={label} gap={10} style={{ alignItems: 'flex-start' }}>
              <Icon name={icon} size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <T size={12} color={colors.muted}>
                  {label}
                </T>
                <T>{value}</T>
              </View>
            </Row>
          ))}
      </Card>

      {includes && includes.length ? (
        <Card style={{ gap: 8 }}>
          <T weight="700">{t('includes')}</T>
          {includes.map((x, i) => (
            <Row key={i} gap={8}>
              <Icon name="checkmark-circle" size={18} color={colors.accent} />
              <T style={{ flex: 1 }}>{x}</T>
            </Row>
          ))}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <T weight="700">{t('chooseRoom')}</T>
        {p.roomPrices.map((x) => {
          const on = x.room === r.room;
          return (
            <Pressable key={x.room} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setRoom(x.room)} style={{ flexDirection: dir.row, alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? colors.accent : colors.line, backgroundColor: on ? colors.accentSoft : '#fff' }}>
              <Icon name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.accent : colors.muted} />
              <T weight="600" style={{ flex: 1 }}>
                {t('room_' + x.room)}
              </T>
              <T weight="700">
                {money(x.price, config.currency)} <T size={12} color={colors.muted}>{t('perPerson')}</T>
              </T>
            </Pressable>
          );
        })}
        {p.childPrice || p.infantPrice ? (
          <T size={12} color={colors.muted}>
            {t('childInfantPrices', { c: money(childP, config.currency), i: money(infantP, config.currency) })}
          </T>
        ) : null}
      </Card>

      <PickerField label={t('travellers')} icon="people-outline" value={paxSummary(pax, true)} onPress={() => setPicker(true)} />
      {p.seats <= 10 ? <Notice kind="warn">{t('placesLeft', { n: p.seats })}</Notice> : null}
      <PaxPicker noCabin visible={picker} value={pax} onChange={setPax} onClose={() => setPicker(false)} />
    </Screen>
  );
}
