// الرئيسية: البحث عن رحلة + العمرة + الطلاب + النقاط
import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useApp } from '../AppContext';
import { Btn, Card, Icon, PickerField, Row, Screen, Segmented, showError, T } from '../components/ui';
import { AirportPicker, DatePicker, PaxPicker, paxSummary } from '../components/pickers';
import { addDays, colors, dir, longDate, posEnd, ymd } from '../theme';
import { t, loc } from '../i18n';

export default function HomeScreen({ navigation }) {
  const { user, config, airports, cityName, isStudent } = useApp();
  const [trip, setTrip] = useState('round');
  const [from, setFrom] = useState('NKC');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(addDays(ymd(new Date()), 7));
  const [returnDate, setReturnDate] = useState(addDays(ymd(new Date()), 14));
  const [pax, setPax] = useState({ adults: 1, children: 0, infants: 0, cabin: 'economy' });
  const [picker, setPicker] = useState(null);

  const params = () => ({ from, to, date, returnDate: trip === 'round' ? returnDate : '', pax });

  const search = () => {
    if (!from || !to) return showError(new Error(t('chooseCities')));
    if (from === to) return showError(new Error(t('sameCities')));
    navigation.navigate('Results', params());
  };

  const pickDate = (d) => {
    setDate(d);
    if (returnDate < d) setReturnDate(addDays(d, 7));
  };

  const firstName = (user?.name || '').split(' ')[0];
  const st = user?.student?.status;
  const pts = config?.points?.enabled ? user?.points || 0 : null;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10} style={{ flex: 1 }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="airplane" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <T size={12} color={colors.muted}>
              {t('hello', { name: firstName })}
            </T>
            <T size={16} weight="700" numberOfLines={1}>
              {config?.agencyName}
            </T>
          </View>
        </Row>
        {pts !== null ? (
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Points')} style={{ flexDirection: dir.row, alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.goldSoft }}>
            <Icon name="star" size={16} color={colors.gold} />
            <T size={14} weight="700" color={colors.goldInk}>
              {pts}
            </T>
          </Pressable>
        ) : null}
      </Row>

      <T size={28} weight="700" style={{ marginTop: 4 }}>
        {t('whereTo')}
      </T>

      <Card style={{ gap: 12 }}>
        <Segmented
          value={trip}
          onChange={setTrip}
          options={[
            { value: 'oneway', label: t('oneWay') },
            { value: 'round', label: t('roundTrip') },
          ]}
        />
        <View style={{ gap: 8 }}>
          <PickerField label={t('fromLabel')} icon="airplane-outline" value={from ? `${cityName(from)}  ${from}` : ''} placeholder={t('departureCity')} onPress={() => setPicker('from')} />
          <PickerField label={t('toLabel')} icon="location-outline" value={to ? `${cityName(to)}  ${to}` : ''} placeholder={t('chooseDestination')} onPress={() => setPicker('to')} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('swap')}
            onPress={() => {
              setFrom(to);
              setTo(from);
            }}
            style={{ position: 'absolute', ...posEnd(14), top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="swap-vertical" size={20} color={colors.accent} />
          </Pressable>
        </View>
        <View style={{ flexDirection: dir.row, gap: 8 }}>
          <PickerField style={{ flex: 1 }} label={t('departure')} value={longDate(date)} onPress={() => setPicker('date')} />
          {trip === 'round' ? <PickerField style={{ flex: 1 }} label={t('return')} value={longDate(returnDate)} onPress={() => setPicker('return')} /> : null}
        </View>
        <PickerField label={t('paxAndCabin')} icon="people-outline" value={paxSummary(pax)} onPress={() => setPicker('pax')} />
        <Btn title={t('searchFlights')} icon="search" onPress={search} />
      </Card>

      <Pressable onPress={() => navigation.navigate('RequestForm', params())} style={{ padding: 4 }}>
        <T color={colors.accent} weight="600" center>
          {t('notFoundAskQuote')}
        </T>
      </Pressable>

      {/* الطلاب */}
      {config?.studentDiscountPercent ? (
        <Pressable onPress={() => navigation.navigate('Student')} style={{ flexDirection: dir.row, alignItems: 'center', gap: 12, backgroundColor: colors.purpleSoft, padding: 14, borderRadius: 18 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="school" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="700" color={colors.purple}>
              {isStudent ? t('studentActiveTitle', { p: config.studentDiscountPercent }) : t('studentPromoTitle', { p: config.studentDiscountPercent })}
            </T>
            <T size={13} color="#4B437F">
              {isStudent ? t('studentActiveSub', { d: user.student.validUntil }) : st === 'pending' ? t('studentPendingSub') : t('studentPromoSub')}
            </T>
          </View>
          <Icon name={dir.fwd} size={18} color={colors.purple} />
        </Pressable>
      ) : null}

      {/* العمرة والحج */}
      {config?.hasPackages ? (
        <Pressable onPress={() => navigation.navigate('Packages')} style={{ flexDirection: dir.row, alignItems: 'center', gap: 12, backgroundColor: '#0B3B2E', padding: 16, borderRadius: 18 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="moon" size={22} color="#0B3B2E" />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="700" size={16} color="#fff">
              {t('umrahHajj')}
            </T>
            <T size={13} color="#C8DDD4">
              {t('umrahHajjSub')}
            </T>
          </View>
          <Icon name={dir.fwd} size={18} color="#fff" />
        </Pressable>
      ) : null}

      {config?.popularDestinations?.length ? (
        <View style={{ gap: 10 }}>
          <T size={17} weight="700">
            {t('popular')}
          </T>
          <View style={{ flexDirection: dir.row, flexWrap: 'wrap', gap: 8 }}>
            {config.popularDestinations.map((a) => (
              <Pressable key={a.code} onPress={() => setTo(a.code)} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, backgroundColor: to === a.code ? colors.accentSoft : '#fff', borderWidth: 1, borderColor: to === a.code ? colors.accent : colors.line }}>
                <T weight="600">{loc(a, 'city')}</T>
                <T size={12} color={colors.muted}>
                  {loc(a, 'country')}
                </T>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {config?.referral?.enabled ? (
        <Pressable onPress={() => navigation.navigate('Points')} style={{ flexDirection: dir.row, alignItems: 'center', gap: 12, backgroundColor: colors.goldSoft, padding: 14, borderRadius: 18 }}>
          <Icon name="gift" size={24} color={colors.goldInk} />
          <T size={14} weight="600" color={colors.goldInk} style={{ flex: 1 }}>
            {t('inviteBanner', { n: config.referral.referrer })}
          </T>
          <Icon name={dir.fwd} size={18} color={colors.goldInk} />
        </Pressable>
      ) : null}

      {config?.whatsapp ? (
        <Pressable onPress={() => Linking.openURL(`https://wa.me/${config.whatsapp}`)} style={{ flexDirection: dir.row, alignItems: 'center', gap: 12, backgroundColor: colors.ink, padding: 16, borderRadius: 18 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="logo-whatsapp" size={22} color={colors.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="700" color="#fff">
              {t('needHelp')}
            </T>
            <T size={13} color="#C7CFD6">
              {t('needHelpSub')}
            </T>
          </View>
        </Pressable>
      ) : null}

      <AirportPicker visible={picker === 'from'} title={t('departureCity')} airports={airports} exclude={to} onClose={() => setPicker(null)} onSelect={(a) => setFrom(a.code)} />
      <AirportPicker visible={picker === 'to'} title={t('destination')} airports={airports} exclude={from} onClose={() => setPicker(null)} onSelect={(a) => setTo(a.code)} />
      <DatePicker visible={picker === 'date'} title={t('departureDate')} value={date} onClose={() => setPicker(null)} onSelect={pickDate} />
      <DatePicker visible={picker === 'return'} title={t('returnDate')} value={returnDate} minDate={date} rangeStart={date} onClose={() => setPicker(null)} onSelect={setReturnDate} />
      <PaxPicker visible={picker === 'pax'} value={pax} onChange={setPax} onClose={() => setPicker(null)} />
    </Screen>
  );
}
