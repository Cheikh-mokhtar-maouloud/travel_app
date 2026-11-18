// مكوّنات الواجهة الأساسية (تتبع اتجاه اللغة الحالية تلقائياً)
import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, dir, s, statusColors } from '../theme';
import { t } from '../i18n';

export const Icon = Ionicons;

export function T({ size = 15, weight = '400', color = colors.ink, center, ltr, style, children, ...p }) {
  return (
    <Text {...p} style={[{ fontSize: size, fontWeight: weight, color, textAlign: center ? 'center' : dir.start, writingDirection: ltr ? 'ltr' : dir.wd }, style]}>
      {children}
    </Text>
  );
}

export const Row = ({ style, children, gap = 8, ...p }) => (
  <View {...p} style={[{ flexDirection: dir.row, alignItems: 'center', gap }, style]}>
    {children}
  </View>
);

export const Card = ({ style, children }) => <View style={[s.card, style]}>{children}</View>;

export function Btn({ title, onPress, variant = 'primary', loading, disabled, icon, style, small }) {
  const v = {
    primary: { bg: colors.accent, fg: '#fff', border: colors.accent },
    dark: { bg: colors.ink, fg: '#fff', border: colors.ink },
    outline: { bg: '#fff', fg: colors.ink, border: colors.lineStrong },
    danger: { bg: '#fff', fg: colors.danger, border: '#E9C3BD' },
    ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!!(disabled || loading)}
      style={({ pressed }) => [
        { height: small ? 40 : 52, paddingHorizontal: small ? 14 : 20, borderRadius: 14, backgroundColor: v.bg, borderWidth: 1, borderColor: v.border, alignItems: 'center', justifyContent: 'center', flexDirection: dir.row, gap: 8, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 20} color={v.fg} /> : null}
          <T size={small ? 14 : 16} weight="700" color={v.fg}>
            {title}
          </T>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, ltr, style, inputStyle, hint, ...p }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? (
        <T size={13} color={colors.muted}>
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor="#9AA3AA"
        {...p}
        style={[
          {
            height: p.multiline ? 96 : 50,
            borderWidth: 1,
            borderColor: colors.lineStrong,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingTop: p.multiline ? 12 : 0,
            fontSize: 16,
            color: colors.ink,
            backgroundColor: '#fff',
            textAlign: ltr ? (dir.rtl ? (dir.start === 'left' ? 'right' : 'left') : dir.start) : dir.start,
            writingDirection: ltr ? 'ltr' : dir.wd,
            textAlignVertical: p.multiline ? 'top' : 'center',
          },
          inputStyle,
        ]}
      />
      {hint ? (
        <T size={12} color={colors.muted}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

// زر يشبه حقل الإدخال ويفتح نافذة اختيار
export function PickerField({ label, value, placeholder, onPress, icon, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [{ flexDirection: dir.row, alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: pressed ? '#FAF8F3' : '#fff' }, style]}
    >
      {icon ? <Ionicons name={icon} size={20} color={colors.muted} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T size={12} color={colors.muted}>
          {label}
        </T>
        <T size={16} weight="600" color={value ? colors.ink : '#9AA3AA'} numberOfLines={1}>
          {value || placeholder}
        </T>
      </View>
    </Pressable>
  );
}

export function Pill({ status, label }) {
  const [bg, fg] = statusColors[status] || ['#ECECEC', '#4A4A4A'];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: dir.aStart }}>
      <T size={12} weight="700" color={fg}>
        {label}
      </T>
    </View>
  );
}

export function Segmented({ options, value, onChange, style }) {
  return (
    <View style={[{ flexDirection: dir.row, backgroundColor: '#E9E3D6', borderRadius: 12, padding: 4, gap: 4 }, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={{ flex: 1, minHeight: 38, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#fff' : 'transparent' }}>
            <T size={13} weight={on ? '700' : '400'} color={on ? colors.ink : '#3E4A54'} center>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

// اختيار من خيارين أو أكثر على شكل أزرار (مثل الجنس)
export function Choice({ options, value, onChange }) {
  return (
    <View style={{ flexDirection: dir.row, gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.value)} style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? colors.accent : colors.lineStrong, backgroundColor: on ? colors.accentSoft : '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <T weight={on ? '700' : '400'} center>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange, title, sub, icon, color = colors.accent, disabled }) {
  return (
    <Pressable onPress={() => !disabled && onChange(!value)} style={{ flexDirection: dir.row, alignItems: 'center', gap: 12, opacity: disabled ? 0.5 : 1 }}>
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: value ? color : '#F0EBE0', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={value ? '#fff' : colors.muted} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T weight="700">{title}</T>
        {sub ? (
          <T size={13} color={colors.muted}>
            {sub}
          </T>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={!!disabled} trackColor={{ true: color }} />
    </Pressable>
  );
}

export function Header({ title, subtitle, onBack, right, dark }) {
  const fg = dark ? '#fff' : colors.ink;
  return (
    <View style={{ flexDirection: dir.row, alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: dark ? colors.ink : 'transparent' }}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('back')} onPress={onBack} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? 'rgba(255,255,255,0.1)' : '#fff', borderWidth: dark ? 0 : 1, borderColor: colors.line }}>
          <Ionicons name={dir.back} size={22} color={fg} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <T size={19} weight="700" color={fg} numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T size={13} color={dark ? '#C7CFD6' : colors.muted} numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Screen({ children, scroll = true, refreshing, onRefresh, header, footer, padded = true, dark, edges = ['top'] }) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={{ padding: padded ? 16 : 0, paddingBottom: 32, gap: 14 }} keyboardShouldPersistTaps="handled" refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}>
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: padded ? 16 : 0 }}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: dark ? colors.ink : colors.bg }}>
      {header}
      <View style={{ flex: 1, backgroundColor: colors.bg }}>{content}</View>
      {footer}
    </SafeAreaView>
  );
}

export const Loading = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
    <ActivityIndicator size="large" color={colors.accent} />
  </View>
);

export function Empty({ icon = 'airplane-outline', title, text, action }) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 10 }}>
      <Ionicons name={icon} size={48} color={colors.lineStrong} />
      <T size={17} weight="700" center>
        {title}
      </T>
      {text ? (
        <T color={colors.muted} center>
          {text}
        </T>
      ) : null}
      {action}
    </View>
  );
}

export function Notice({ kind = 'info', children, icon }) {
  const c = { info: [colors.infoSoft, colors.info], warn: [colors.goldSoft, colors.goldInk], danger: [colors.dangerSoft, colors.danger], ok: [colors.accentSoft, colors.accent], purple: [colors.purpleSoft, colors.purple] }[kind];
  return (
    <View style={{ flexDirection: dir.row, gap: 10, backgroundColor: c[0], padding: 12, borderRadius: 14, alignItems: 'flex-start' }}>
      <Ionicons name={icon || 'information-circle-outline'} size={20} color={c[1]} />
      <T size={14} color={c[1]} style={{ flex: 1 }}>
        {children}
      </T>
    </View>
  );
}

export const showError = (e) => Alert.alert(t('alert'), e?.message || String(e));

// شريط سفلي ثابت (المجموع + زر)
export function BottomBar({ children }) {
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flexDirection: dir.row, alignItems: 'center', gap: 12, padding: 14, paddingHorizontal: 16 }}>{children}</View>
    </SafeAreaView>
  );
}

// سطر قائمة قابل للضغط (في الحساب)
export function ListLine({ icon, title, sub, onPress, badge, color = colors.accent, soft = colors.accentSoft }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Row gap={12} style={{ paddingVertical: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <T weight="600">{title}</T>
          {sub ? (
            <T size={13} color={colors.muted}>
              {sub}
            </T>
          ) : null}
        </View>
        {badge ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.gold }}>
            <T size={12} weight="700" color={colors.ink}>
              {badge}
            </T>
          </View>
        ) : null}
        <Ionicons name={dir.fwd} size={18} color={colors.muted} />
      </Row>
    </Pressable>
  );
}
