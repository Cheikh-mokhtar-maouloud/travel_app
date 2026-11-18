// نوافذ الاختيار: المطار، التاريخ، المسافرين
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Field, Header, Icon, Row, T } from './ui';
import { colors, dir, monthName, ymd, parseYmd } from '../theme';
import { i18n, t, loc } from '../i18n';

export function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header
          title={title}
          right={
            <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={26} color={colors.ink} />
            </Pressable>
          }
        />
        {children}
      </SafeAreaView>
    </Modal>
  );
}

const cityOf = (a) => loc(a, 'city');
const countryOf = (a) => loc(a, 'country');

// ---------- المطار ----------
export function AirportPicker({ visible, onClose, onSelect, airports, title, exclude }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return airports
      .filter((a) => a.code !== exclude)
      .filter((a) => !s || [a.code, a.city, a.country, a.cityFr, a.countryFr, a.cityEn, a.countryEn].some((v) => String(v || '').toLowerCase().includes(s)));
  }, [q, airports, exclude]);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Field placeholder={t('searchAirport')} value={q} onChangeText={setQ} autoFocus />
      </View>
      <FlatList
        data={list}
        keyExtractor={(a) => a.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onSelect(item);
              setQ('');
              onClose();
            }}
            style={({ pressed }) => ({ flexDirection: dir.row, alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line, opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{ width: 52, height: 40, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}>
              <T weight="700" ltr center>
                {item.code}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T size={16} weight="600">
                {cityOf(item)}
              </T>
              <T size={13} color={colors.muted}>
                {countryOf(item)}
              </T>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <T color={colors.muted} center style={{ padding: 24 }}>
            {t('noAirport')}
          </T>
        }
      />
    </Sheet>
  );
}

// ---------- التاريخ ----------
export function DatePicker({ visible, onClose, onSelect, value, minDate, maxDate, rangeStart, title, startYear }) {
  const min = minDate || ymd(new Date());
  const initial = parseYmd(value || (startYear ? `${startYear}-01-01` : min));
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  // الأسبوع يبدأ بالسبت في العربية وبالإثنين في الفرنسية
  const weekStart = i18n.lang === 'ar' ? 6 : 1;
  const week = { ar: ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'], fr: ['L', 'M', 'M', 'J', 'V', 'S', 'D'], en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'] }[i18n.lang];

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() - weekStart + 7) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const arr = Array(offset).fill(null);
    for (let d = 1; d <= days; d++) arr.push(ymd(new Date(month.getFullYear(), month.getMonth(), d)));
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [month, weekStart]);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const minMonth = parseYmd(min);
  const canPrev = month > new Date(minMonth.getFullYear(), minMonth.getMonth(), 1);
  const go = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ padding: 16, gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable accessibilityLabel={t('prevMonth')} disabled={!canPrev} onPress={() => go(-1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: canPrev ? 1 : 0.3 }}>
            <Icon name={dir.back} size={24} color={colors.ink} />
          </Pressable>
          <Row gap={4}>
            {startYear ? (
              <Pressable onPress={() => go(-12)} hitSlop={8} style={{ padding: 6 }}>
                <T color={colors.accent} weight="700">
                  «
                </T>
              </Pressable>
            ) : null}
            <T size={18} weight="700">
              {monthName(month.getMonth())} {month.getFullYear()}
            </T>
            {startYear ? (
              <Pressable onPress={() => go(12)} hitSlop={8} style={{ padding: 6 }}>
                <T color={colors.accent} weight="700">
                  »
                </T>
              </Pressable>
            ) : null}
          </Row>
          <Pressable accessibilityLabel={t('nextMonth')} onPress={() => go(1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={dir.fwd} size={24} color={colors.ink} />
          </Pressable>
        </Row>
        <View style={{ flexDirection: dir.row }}>
          {week.map((w, i) => (
            <T key={i} center color={colors.muted} size={13} style={{ flex: 1 }}>
              {w}
            </T>
          ))}
        </View>
        {weeks.map((wk, i) => (
          <View key={i} style={{ flexDirection: dir.row }}>
            {wk.map((d, j) => {
              if (!d) return <View key={j} style={{ flex: 1, height: 46 }} />;
              const disabled = d < min || (!!maxDate && d > maxDate);
              const selected = d === value;
              const inRange = rangeStart && value && d > rangeStart && d < value;
              const isStart = d === rangeStart;
              return (
                <Pressable
                  key={j}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  onPress={() => {
                    onSelect(d);
                    onClose();
                  }}
                  style={{ flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: inRange ? colors.accentSoft : 'transparent' }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : isStart ? colors.ink : 'transparent' }}>
                    <T center weight={selected || isStart ? '700' : '400'} color={selected || isStart ? '#fff' : disabled ? '#C2C2C2' : colors.ink}>
                      {Number(d.slice(8))}
                    </T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Sheet>
  );
}

// ---------- المسافرون والدرجة ----------
function Counter({ label, sub, value, onChange, min = 0, max = 9 }) {
  const btn = (icon, disabled, fn) => (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={fn} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1, backgroundColor: '#fff' }}>
      <Icon name={icon} size={22} color={colors.ink} />
    </Pressable>
  );
  return (
    <Row style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ flex: 1 }}>
        <T size={16} weight="600">
          {label}
        </T>
        <T size={13} color={colors.muted}>
          {sub}
        </T>
      </View>
      {btn('remove', value <= min, () => onChange(value - 1))}
      <T size={18} weight="700" center style={{ width: 32 }}>
        {value}
      </T>
      {btn('add', value >= max, () => onChange(value + 1))}
    </Row>
  );
}

export function PaxPicker({ visible, onClose, value, onChange, noCabin }) {
  const [v, setV] = useState(value);
  React.useEffect(() => setV(value), [value, visible]);
  const total = v.adults + v.children + v.infants;
  const set = (k) => (n) => setV((p) => ({ ...p, [k]: n }));
  return (
    <Sheet visible={visible} onClose={onClose} title={noCabin ? t('travellers') : t('paxAndCabin')}>
      <View style={{ padding: 16, gap: 4 }}>
        <Counter label={t('adults')} sub={t('adultsSub')} value={v.adults} min={1} max={9 - v.children - v.infants} onChange={set('adults')} />
        <Counter label={t('children')} sub={t('childrenSub')} value={v.children} max={9 - v.adults - v.infants} onChange={set('children')} />
        <Counter label={t('infants')} sub={t('infantsSub')} value={v.infants} max={Math.min(v.adults, 9 - v.adults - v.children)} onChange={set('infants')} />
        {noCabin ? null : (
          <>
            <T size={14} weight="600" style={{ marginTop: 18, marginBottom: 8 }}>
              {t('cabin')}
            </T>
            <Row>
              {[
                ['economy', t('economy')],
                ['business', t('business')],
              ].map(([k, l]) => (
                <Pressable key={k} onPress={() => setV((p) => ({ ...p, cabin: k }))} style={{ flex: 1, height: 48, borderRadius: 12, borderWidth: v.cabin === k ? 2 : 1, borderColor: v.cabin === k ? colors.accent : colors.lineStrong, backgroundColor: v.cabin === k ? colors.accentSoft : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <T weight="600" center>
                    {l}
                  </T>
                </Pressable>
              ))}
            </Row>
          </>
        )}
        <T size={12} color={colors.muted} style={{ marginTop: 8 }}>
          {t('paxRule')}
        </T>
        <Btn
          title={t('confirmPax', { n: total })}
          style={{ marginTop: 20 }}
          onPress={() => {
            onChange(v);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

export const paxSummary = (p, noCabin) => {
  const parts = [t('nAdults', { n: p.adults })];
  if (p.children) parts.push(t('nChildren', { n: p.children }));
  if (p.infants) parts.push(t('nInfants', { n: p.infants }));
  return parts.join(i18n.lang === 'ar' ? '، ' : ', ') + (noCabin ? '' : ' · ' + (p.cabin === 'business' ? t('business') : t('economy')));
};
