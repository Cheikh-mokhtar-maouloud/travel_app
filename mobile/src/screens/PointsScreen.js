// نقاطي + ادعُ صديقاً
import React, { useCallback, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Btn, Card, Header, Icon, Loading, Row, Screen, showError, T } from '../components/ui';
import { colors, dateTime, dir, money } from '../theme';
import { t } from '../i18n';

export default function PointsScreen({ navigation }) {
  const { config, refreshUser } = useApp();
  const [d, setD] = useState(null);
  const P = config.points || {};
  const R = config.referral || {};

  const load = useCallback(async () => {
    try {
      setD(await api('/me/points'));
      refreshUser();
    } catch (e) {
      showError(e);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const invite = () =>
    Share.share({ message: t('inviteMessage', { agency: config.agencyName, code: d.referralCode, n: R.referee }) });

  return (
    <Screen onRefresh={load} header={<Header title={t('myPoints')} onBack={() => navigation.goBack()} />}>
      {!d ? (
        <Loading />
      ) : (
        <>
          <View style={{ backgroundColor: colors.ink, borderRadius: 22, padding: 20, gap: 6 }}>
            <Row gap={8}>
              <Icon name="star" size={20} color={colors.gold} />
              <T color="#C7CFD6">{t('balance')}</T>
            </Row>
            <T size={40} weight="700" color="#fff">
              {d.balance.toLocaleString('en-US')}
            </T>
            <T color={colors.gold} weight="600">
              {t('worth', { v: money(d.balance * P.pointValue, config.currency) })}
            </T>
          </View>

          <Card style={{ gap: 10 }}>
            <T weight="700">{t('howPoints')}</T>
            {[
              ['airplane', t('howEarn', { per: money(P.earnPer, config.currency) })],
              ['pricetag', t('howUse', { v: money(P.pointValue, config.currency), min: P.minRedeem, max: P.maxRedeemPercent })],
              ['time', P.expiryMonths ? t('howExpire', { m: P.expiryMonths }) : t('noExpire')],
            ].map(([icon, text]) => (
              <Row key={icon} gap={10} style={{ alignItems: 'flex-start' }}>
                <Icon name={icon} size={18} color={colors.accent} />
                <T size={14} color="#3E4A54" style={{ flex: 1 }}>
                  {text}
                </T>
              </Row>
            ))}
          </Card>

          {R.enabled ? (
            <Card style={{ gap: 12, borderWidth: 1, borderColor: colors.gold }}>
              <Row gap={10}>
                <Icon name="gift" size={26} color={colors.goldInk} />
                <T weight="700" size={17} style={{ flex: 1 }}>
                  {t('inviteFriends')}
                </T>
              </Row>
              <T color="#3E4A54">{t('inviteExplain', { a: R.referrer, b: R.referee })}</T>
              <View style={{ backgroundColor: colors.goldSoft, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 }}>
                <T size={12} color={colors.goldInk} center>
                  {t('yourCode')}
                </T>
                <T size={28} weight="700" ltr center selectable style={{ letterSpacing: 4 }}>
                  {d.referralCode}
                </T>
              </View>
              <Btn title={t('shareInvite')} icon="share-social" onPress={invite} />
              {d.invited.length ? (
                <View style={{ gap: 6 }}>
                  <T size={13} weight="600" color={colors.muted}>
                    {t('invitedFriends', { n: d.invited.length })}
                  </T>
                  {d.invited.map((f, i) => (
                    <Row key={i} style={{ justifyContent: 'space-between' }}>
                      <T>{f.name}</T>
                      <T size={13} color={f.rewarded ? colors.accent : colors.muted}>
                        {f.rewarded ? t('rewarded', { n: R.referrer }) : t('waitingFirstTrip')}
                      </T>
                    </Row>
                  ))}
                </View>
              ) : null}
            </Card>
          ) : null}

          <Card style={{ gap: 4 }}>
            <T weight="700" style={{ marginBottom: 6 }}>
              {t('history')}
            </T>
            {d.items.length ? (
              d.items.map((i) => (
                <Pressable key={i.id} disabled={!i.bookingId} onPress={() => navigation.navigate('BookingDetail', { id: i.bookingId })}>
                  <Row style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EBE0' }}>
                    <View style={{ flex: 1 }}>
                      <T size={14}>{t('pr_' + i.reason)}{i.reason === 'referral' && i.note ? ` · ${i.note}` : ''}</T>
                      <T size={12} color={colors.muted}>
                        {dateTime(i.at)}
                      </T>
                    </View>
                    <T weight="700" color={i.delta > 0 ? colors.accent : colors.danger} ltr>
                      {i.delta > 0 ? '+' : ''}
                      {i.delta}
                    </T>
                  </Row>
                </Pressable>
              ))
            ) : (
              <T color={colors.muted}>{t('noPointsYet')}</T>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
