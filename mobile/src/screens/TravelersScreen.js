// المسافرون المحفوظون (الجوازات والعائلة) للحجز السريع
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Btn, Card, Choice, Empty, Field, Icon, Row, Screen, Header, showError, T } from '../components/ui';
import { Sheet } from '../components/pickers';
import { colors, dir, s } from '../theme';
import { t } from '../i18n';

const blank = () => ({ relation: '', type: 'adult', gender: 'M', firstName: '', lastName: '', passportNo: '', passportExpiry: '', birthDate: '', nationality: t('defaultNationality') });

export default function TravelersScreen({ navigation }) {
  const { user, refreshUser } = useApp();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = user.travelers || [];
  const set = (k) => (v) => setEdit((e) => ({ ...e, [k]: v }));

  const save = async () => {
    const e = edit;
    if (!e.firstName.trim() || !e.lastName.trim() || !e.passportNo.trim()) return showError(new Error(t('vTraveler')));
    if (!/^[A-Za-z\s'-]+$/.test(e.firstName + e.lastName)) return showError(new Error(t('vLatin')));
    setBusy(true);
    try {
      await api('/me/travelers' + (e.id ? '/' + e.id : ''), { method: e.id ? 'PUT' : 'POST', body: e });
      await refreshUser();
      setEdit(null);
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = (tr) =>
    Alert.alert(t('delete'), t('deleteTravelerQ', { name: `${tr.firstName} ${tr.lastName}` }), [
      { text: t('back'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api('/me/travelers/' + tr.id, { method: 'DELETE' });
            refreshUser();
          } catch (err) {
            showError(err);
          }
        },
      },
    ]);

  return (
    <Screen header={<Header title={t('savedTravelers')} onBack={() => navigation.goBack()} />}>
      <T color={colors.muted}>{t('travelersIntro')}</T>
      {list.length ? (
        list.map((tr) => (
          <View key={tr.id} style={[s.card, { gap: 6 }]}>
            <Row>
              <Icon name={tr.gender === 'F' ? 'woman' : 'man'} size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <T weight="700" ltr style={{ textAlign: dir.start }}>
                  {tr.lastName}/{tr.firstName}
                </T>
                <T size={13} color={colors.muted}>
                  {[tr.relation, t('type_' + (tr.type || 'adult')), `${t('passportShort')} ${tr.passportNo}`, tr.passportExpiry ? t('expires', { d: tr.passportExpiry }) : ''].filter(Boolean).join(' · ')}
                </T>
              </View>
              <Pressable accessibilityLabel={t('edit')} onPress={() => setEdit({ ...blank(), ...tr })} style={{ padding: 8 }}>
                <Icon name="create-outline" size={20} color={colors.ink} />
              </Pressable>
              <Pressable accessibilityLabel={t('delete')} onPress={() => remove(tr)} style={{ padding: 8 }}>
                <Icon name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </Row>
          </View>
        ))
      ) : (
        <Empty icon="people-outline" title={t('noTravelers')} text={t('noTravelersText')} />
      )}
      <Btn title={t('addTraveler')} icon="add" onPress={() => setEdit(blank())} />

      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('editTraveler') : t('addTraveler')}>
        {edit ? (
          <View style={{ padding: 16, gap: 12 }}>
            <Field label={t('relationOptional')} value={edit.relation} onChangeText={set('relation')} placeholder={t('relationPh')} />
            <Choice value={edit.type} onChange={set('type')} options={['adult', 'child', 'infant'].map((k) => ({ value: k, label: t('type_' + k) }))} />
            <Choice value={edit.gender} onChange={set('gender')} options={[{ value: 'M', label: t('male') }, { value: 'F', label: t('female') }]} />
            <View style={{ flexDirection: dir.row, gap: 8 }}>
              <Field style={{ flex: 1 }} label={t('firstName')} ltr autoCapitalize="characters" value={edit.firstName} onChangeText={set('firstName')} />
              <Field style={{ flex: 1 }} label={t('lastName')} ltr autoCapitalize="characters" value={edit.lastName} onChangeText={set('lastName')} />
            </View>
            <View style={{ flexDirection: dir.row, gap: 8 }}>
              <Field style={{ flex: 1 }} label={t('passportNo')} ltr autoCapitalize="characters" value={edit.passportNo} onChangeText={set('passportNo')} />
              <Field style={{ flex: 1 }} label={t('passportExpiry')} ltr value={edit.passportExpiry} onChangeText={set('passportExpiry')} placeholder="2030-12-31" maxLength={10} />
            </View>
            <View style={{ flexDirection: dir.row, gap: 8 }}>
              <Field style={{ flex: 1 }} label={t('birthDate')} ltr value={edit.birthDate} onChangeText={set('birthDate')} placeholder="1990-01-31" maxLength={10} />
              <Field style={{ flex: 1 }} label={t('nationality')} value={edit.nationality} onChangeText={set('nationality')} />
            </View>
            <Btn title={t('save')} onPress={save} loading={busy} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
