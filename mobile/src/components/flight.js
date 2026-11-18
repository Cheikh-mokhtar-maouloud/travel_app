// بطاقة الرحلة في نتائج البحث + عرض مقطع رحلة
import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon, Row, T } from './ui';
import { colors, dir, duration, hm, money, s, shortDate } from '../theme';
import { t, loc, bag } from '../i18n';
import { useApp } from '../AppContext';
import { Price } from './Price';

const BADGE_COLORS = ['#7A1F2B', '#0E6B4F', '#B23A2E', '#1D4E89', '#5B3F8C', '#8A3B12', '#13202B'];
const badgeColor = (code = '') => BADGE_COLORS[[...code].reduce((a, c) => a + c.charCodeAt(0), 0) % BADGE_COLORS.length];

export function AirlineBadge({ code, size = 38 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: badgeColor(code), alignItems: 'center', justifyContent: 'center' }}>
      <T size={12} weight="700" color="#fff" ltr center>
        {code || '✈'}
      </T>
    </View>
  );
}

// خط الرحلة: وقت الإقلاع — المدة — وقت الوصول
export function Timeline({ seg, big = true }) {
  const { cityName } = useApp();
  const via = seg.via ? seg.via.split(',').map((c) => cityName(c.trim())).join('، ') : '';
  return (
    <Row gap={10}>
      <View style={{ alignItems: dir.aStart }}>
        <T size={big ? 21 : 18} weight="700">
          {hm(seg.departAt)}
        </T>
        <T size={12} color={colors.muted}>
          {seg.from} · {cityName(seg.from)}
        </T>
      </View>
      <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
        <T size={11} color={colors.muted} center>
          {seg.durationMin ? duration(seg.durationMin) : ''}
        </T>
        <View style={{ width: '100%', borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: '#C9C1AE' }} />
        <T size={11} weight="600" color={seg.stops ? '#8A3B12' : colors.accent} center numberOfLines={1}>
          {seg.stops ? t('stopIn', { city: via }) : t('direct')}
        </T>
      </View>
      <View style={{ alignItems: dir.aEnd }}>
        <T size={big ? 21 : 18} weight="700">
          {hm(seg.arriveAt)}
        </T>
        <T size={12} color={colors.muted}>
          {seg.to} · {cityName(seg.to)}
        </T>
      </View>
    </Row>
  );
}

export function FlightCard({ f, onPress, currency, best, fastest, studentPrice }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.card, { gap: 12, opacity: pressed ? 0.9 : 1 }]}>
      <Row gap={10}>
        <AirlineBadge code={f.airlineCode} />
        <View style={{ flex: 1 }}>
          <T size={14} weight="600" numberOfLines={1}>
            {loc(f, 'airline') || f.airline}
          </T>
          <T size={12} color={colors.muted} numberOfLines={1}>
            {f.flightNo}
          </T>
        </View>
        {best ? <Tag text={t('cheapest')} /> : null}
        {fastest ? <Tag text={t('fastest')} info /> : null}
      </Row>
      <Timeline seg={f} />
      <Row style={{ borderTopWidth: 1, borderTopColor: '#EEE8DC', paddingTop: 10, justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: 4, flex: 1 }}>
          <Row gap={6}>
            <Icon name="briefcase-outline" size={16} color={colors.muted} />
            <T size={12} color={colors.muted}>
              {bag(f.fares.basic.baggage) || '—'}
            </T>
          </Row>
          {f.seatsLeft <= 5 ? (
            <T size={12} weight="600" color={colors.danger}>
              {t('seatsLeft', { n: f.seatsLeft })}
            </T>
          ) : null}
          {studentPrice ? (
            <Row gap={4}>
              <Icon name="school" size={14} color={colors.purple} />
              <T size={12} weight="700" color={colors.purple}>
                {t('studentFrom', { p: money(studentPrice, currency) })}
              </T>
            </Row>
          ) : null}
        </View>
        <View style={{ alignItems: dir.aEnd }}>
          <T size={11} color={colors.muted}>
            {t('from')}
          </T>
          <Price amount={f.fares.basic.total} />
        </View>
      </Row>
    </Pressable>
  );
}

const Tag = ({ text, info }) => (
  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: info ? colors.infoSoft : colors.goldSoft }}>
    <T size={11} weight="700" color={info ? colors.info : colors.goldInk}>
      {text}
    </T>
  </View>
);

// عرض مقطع رحلة داخل الحجز
export function SegmentBox({ seg, label }) {
  return (
    <View style={{ gap: 10, padding: 12, backgroundColor: '#F8F6F0', borderRadius: 14 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6} style={{ flex: 1 }}>
          {label ? (
            <T size={12} weight="700" color={colors.accent}>
              {label}
            </T>
          ) : null}
          <T size={12} color={colors.muted} numberOfLines={1} style={{ flex: 1 }}>
            {loc(seg, 'airline') || seg.airline} · {seg.flightNo}
          </T>
        </Row>
        <T size={12} color={colors.muted}>
          {shortDate(seg.departAt)}
        </T>
      </Row>
      <Timeline seg={seg} big={false} />
    </View>
  );
}

export { badgeColor };
