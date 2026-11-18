// الإشعارات
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Empty, Icon, Loading, Row, Screen, showError, T } from '../components/ui';
import { colors, fromNow, s } from '../theme';
import { t } from '../i18n';

const ICONS = { booking: 'airplane-outline', request: 'pricetag-outline', points: 'star-outline', student: 'school-outline' };

export default function NotificationsScreen({ navigation }) {
  const { refreshBadges, refreshUser } = useApp();
  const [items, setItems] = useState(null);

  const load = useCallback(async () => {
    try {
      const n = await api('/notifications');
      setItems(n.items);
      if (n.unread) {
        await api('/notifications/read', { method: 'POST' });
        refreshBadges();
        refreshUser();
      }
    } catch (e) {
      showError(e);
    }
  }, [refreshBadges, refreshUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const open = (n) => {
    const l = n.link;
    if (!l) return;
    if (l.type === 'booking') navigation.navigate('BookingDetail', { id: l.id });
    if (l.type === 'request') navigation.navigate('RequestDetail', { id: l.id });
    if (l.type === 'points') navigation.navigate('Points');
    if (l.type === 'student') navigation.navigate('Student');
  };

  return (
    <Screen onRefresh={load}>
      <T size={26} weight="700">
        {t('notifications')}
      </T>
      {!items ? (
        <Loading />
      ) : items.length ? (
        items.map((n) => (
          <Pressable key={n.id} onPress={() => open(n)} style={[s.card, { padding: 14 }]}>
            <Row gap={12} style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: n.read ? '#F0EBE0' : colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={(n.link && ICONS[n.link.type]) || 'chatbubble-outline'} size={20} color={n.read ? colors.muted : colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T weight={n.read ? '600' : '700'}>{n.title}</T>
                <T size={14} color="#3E4A54">
                  {n.body}
                </T>
                <T size={12} color={colors.muted}>
                  {fromNow(n.createdAt)}
                </T>
              </View>
            </Row>
          </Pressable>
        ))
      ) : (
        <Empty icon="notifications-outline" title={t('noNotifications')} text={t('noNotificationsText')} />
      )}
    </Screen>
  );
}
