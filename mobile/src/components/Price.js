// السعر بالأوقية + ما يعادله بالدولار واليورو (حسب أسعار الصرف التي تضعها الوكالة)
import React from 'react';
import { View } from 'react-native';
import { useApp } from '../AppContext';
import { T } from './ui';
import { colors, dir, money } from '../theme';

export function useFx() {
  const { config } = useApp();
  const r = (config && config.exchangeRates) || {};
  const conv = (n, c) => (r[c] ? Math.round(n / r[c]).toLocaleString('en-US') : null);
  return (n) => {
    const usd = conv(n, 'USD');
    const eur = conv(n, 'EUR');
    if (!usd && !eur) return '';
    return [usd && `≈ $${usd}`, eur && `€${eur}`].filter(Boolean).join(' · ');
  };
}

export function Price({ amount, size = 19, color = colors.accent, align, center }) {
  const { config } = useApp();
  const fx = useFx();
  const a = center ? 'center' : align || dir.aEnd;
  return (
    <View style={{ alignItems: a }}>
      <T size={size} weight="700" color={color} center={center}>
        {money(amount, config?.currency)}
      </T>
      <T size={Math.max(11, Math.round(size * 0.6))} color={colors.muted} ltr center={center}>
        {fx(amount)}
      </T>
    </View>
  );
}
