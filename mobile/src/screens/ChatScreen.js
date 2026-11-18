// المحادثة مع الوكالة حول حجز أو طلب
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Header, Icon, Loading, showError, T } from '../components/ui';
import { colors, dir, fromNow } from '../theme';
import { t } from '../i18n';

export default function ChatScreen({ route, navigation }) {
  const { type, id, title } = route.params;
  const { config, refreshBadges } = useApp();
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      setList(await api(`/threads/${type}/${id}/messages`));
      refreshBadges();
    } catch (e) {
      showError(e);
    }
  }, [type, id, refreshBadges]);

  useEffect(() => {
    load();
    const tm = setInterval(load, 10000);
    return () => clearInterval(tm);
  }, [load]);

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    try {
      await api(`/threads/${type}/${id}/messages`, { method: 'POST', body: { text: msg } });
      setText('');
      await load();
    } catch (e) {
      showError(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={config?.agencyName || t('agency')} subtitle={title} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!list ? (
          <Loading />
        ) : (
          <FlatList
            ref={ref}
            data={list}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
            onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <T color={colors.muted} center style={{ marginTop: 40 }}>
                {t('chatEmpty')}
              </T>
            }
            renderItem={({ item: m }) => (
              <View style={{ maxWidth: '82%', alignSelf: m.fromStaff ? dir.aEnd : dir.aStart, backgroundColor: m.fromStaff ? '#fff' : colors.accent, padding: 10, paddingHorizontal: 14, borderRadius: 16 }}>
                {m.fromStaff ? (
                  <T size={11} weight="700" color={colors.accent}>
                    {m.senderName}
                  </T>
                ) : null}
                <T color={m.fromStaff ? colors.ink : '#fff'}>{m.text}</T>
                <T size={10} color={m.fromStaff ? colors.muted : '#D2EDE3'}>
                  {fromNow(m.createdAt)}
                </T>
              </View>
            )}
          />
        )}
        <View style={{ flexDirection: dir.row, gap: 8, padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line }}>
          <TextInput value={text} onChangeText={setText} placeholder={t('writeMessage')} placeholderTextColor="#9AA3AA" multiline style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 11, fontSize: 16, color: colors.ink, textAlign: dir.start, writingDirection: dir.wd }} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('send')} disabled={sending} onPress={send} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', opacity: sending ? 0.5 : 1 }}>
            <Icon name="send" size={20} color="#fff" style={{ transform: [{ scaleX: dir.rtl ? -1 : 1 }] }} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
