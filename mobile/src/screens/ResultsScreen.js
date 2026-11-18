// نتائج البحث: اختيار رحلة الذهاب ثم العودة (رحلات الوكالة + أسعار Amadeus الحية)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Btn, Empty, Header, Loading, Notice, Row, T } from '../components/ui';
import { FlightCard, SegmentBox } from '../components/flight';
import { paxSummary } from '../components/pickers';
import { colors, dayName, dir, shortDate, ymd } from '../theme';
import { t } from '../i18n';

export default function ResultsScreen({ route, navigation }) {
  const { from, to, returnDate, pax } = route.params;
  const { cityName, config, isStudent } = useApp();
  const [date, setDate] = useState(route.params.date);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('cheap');
  const [directOnly, setDirectOnly] = useState(false);
  const [outbound, setOutbound] = useState(null);
  const listRef = useRef(null);
  const step = returnDate && outbound ? 'in' : 'out';

  const load = useCallback(async () => {
    setData(null);
    setError(null);
    setOutbound(null);
    try {
      const q = new URLSearchParams({ from, to, date, returnDate: returnDate || '', adults: pax.adults, children: pax.children, infants: pax.infants, cabin: pax.cabin || 'economy' });
      setData(await api('/flights/search?' + q.toString()));
    } catch (e) {
      setError(e.message);
    }
  }, [from, to, date, returnDate, pax]);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => {
    if (!data) return [];
    let l = (step === 'out' ? data.outbound : data.inbound).slice();
    if (directOnly) l = l.filter((f) => !f.stops);
    if (sort === 'cheap') l.sort((a, b) => a.fares.basic.total - b.fares.basic.total);
    if (sort === 'fast') l.sort((a, b) => a.durationMin - b.durationMin);
    if (sort === 'early') l.sort((a, b) => a.departAt.localeCompare(b.departAt));
    return l;
  }, [data, step, sort, directOnly]);

  const cheapestId = useMemo(() => (list.length ? list.reduce((a, b) => (b.fares.basic.total < a.fares.basic.total ? b : a)).id : null), [list]);
  const fastestId = useMemo(() => (list.length > 1 ? list.reduce((a, b) => (b.durationMin < a.durationMin ? b : a)).id : null), [list]);
  const studentPct = isStudent ? config?.studentDiscountPercent || 0 : 0;

  const choose = (f) => {
    if (step === 'out' && returnDate) {
      setOutbound(f);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }
    navigation.navigate('BookingForm', { mode: 'flights', outbound: step === 'out' ? f : outbound, inbound: step === 'in' ? f : null, pax });
  };

  const requestQuote = () => navigation.navigate('RequestForm', { from, to, date, returnDate, pax });
  const A = dir.arrow;
  const title = step === 'out' ? `${cityName(from)} ${A} ${cityName(to)}` : `${t('returnShort')}: ${cityName(to)} ${A} ${cityName(from)}`;
  const subtitle = `${step === 'out' ? shortDate(date) : shortDate(returnDate)}${returnDate && step === 'out' ? ' – ' + shortDate(returnDate) : ''} · ${paxSummary(pax)}`;

  const chip = (key, label, on, onPress) => (
    <Pressable key={key} onPress={onPress} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: on ? colors.ink : '#fff', borderWidth: 1, borderColor: on ? colors.ink : colors.lineStrong }}>
      <T size={13} weight={on ? '700' : '400'} color={on ? '#fff' : colors.ink}>
        {label}
      </T>
    </Pressable>
  );

  const today = ymd(new Date());
  const headerBlock = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      {step === 'out' && data?.dateStrip ? (
        <View style={{ flexDirection: dir.row, gap: 6 }}>
          {data.dateStrip.map((d) => {
            const on = d.date === date;
            const disabled = d.date < today || (!!returnDate && d.date > returnDate);
            return (
              <Pressable key={d.date} disabled={disabled} onPress={() => setDate(d.date)} style={{ flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center', backgroundColor: on ? colors.accent : '#fff', borderWidth: 1, borderColor: on ? colors.accent : colors.line, opacity: disabled ? 0.35 : 1 }}>
                <T size={10} color={on ? '#fff' : colors.muted} center numberOfLines={1}>
                  {dir.rtl ? dayName(d.date).replace('ال', '').slice(0, 5) : dayName(d.date).slice(0, 3) + '.'}
                </T>
                <T size={15} weight="700" color={on ? '#fff' : colors.ink} center>
                  {Number(d.date.slice(8))}
                </T>
                <T size={9} color={on ? '#fff' : colors.muted} center>
                  {d.minPrice ? Math.round(d.minPrice / 1000) + 'K' : '—'}
                </T>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {data?.liveError ? <Notice kind="warn">{t('liveUnavailable')}</Notice> : null}
      {step === 'in' ? (
        <View style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T size={13} weight="600" color={colors.muted}>
              {t('chosenOutbound')}
            </T>
            <Pressable onPress={() => setOutbound(null)} hitSlop={10}>
              <T size={13} weight="700" color={colors.accent}>
                {t('change')}
              </T>
            </Pressable>
          </Row>
          <SegmentBox seg={outbound} label={t('outboundShort')} />
        </View>
      ) : null}
      <View style={{ flexDirection: dir.row, flexWrap: 'wrap', gap: 8 }}>
        {chip('cheap', t('cheapest'), sort === 'cheap', () => setSort('cheap'))}
        {chip('fast', t('fastest'), sort === 'fast', () => setSort('fast'))}
        {chip('early', t('earliest'), sort === 'early', () => setSort('early'))}
        {chip('direct', t('directOnly'), directOnly, () => setDirectOnly(!directOnly))}
      </View>
      {list.length ? (
        <T size={13} color={colors.muted}>
          {t('nFlights', { n: list.length })}
          {returnDate ? t('thisDirection') : ''}
        </T>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.ink }}>
      <Header dark title={title} subtitle={subtitle} onBack={() => (step === 'in' ? setOutbound(null) : navigation.goBack())} />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {error ? (
          <Empty icon="cloud-offline-outline" title={t('loadFlightsError')} text={error} action={<Btn title={t('retry')} onPress={load} small />} />
        ) : !data ? (
          <Loading />
        ) : (
          <FlatList
            ref={listRef}
            data={list}
            keyExtractor={(f) => String(f.id)}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            ListHeaderComponent={headerBlock}
            renderItem={({ item }) => (
              <FlightCard
                f={item}
                currency={config?.currency}
                best={item.id === cheapestId && list.length > 1}
                fastest={item.id === fastestId && item.id !== cheapestId}
                studentPrice={studentPct ? item.fares.basic.total - Math.round((item.fares.basic.price * studentPct) / 100) : 0}
                onPress={() => choose(item)}
              />
            )}
            ListEmptyComponent={<Empty title={t('noFlights')} text={t('noFlightsText')} action={<Btn title={t('askQuote')} icon="paper-plane-outline" onPress={requestQuote} small />} />}
            ListFooterComponent={
              list.length ? (
                <Pressable onPress={requestQuote} style={{ padding: 16 }}>
                  <T size={13} color={colors.accent} weight="600" center>
                    {t('notSuitable')}
                  </T>
                </Pressable>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
