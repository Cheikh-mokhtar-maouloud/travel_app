// طلب عرض سعر من الوكالة (عندما لا توجد رحلة مناسبة في التطبيق)
import React, { useState } from 'react';
import { View } from 'react-native';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Btn, Card, Field, Header, Notice, PickerField, Screen, Segmented, showError } from '../components/ui';
import { AirportPicker, DatePicker, PaxPicker, paxSummary } from '../components/pickers';
import { addDays, dir, longDate, ymd } from '../theme';
import { t } from '../i18n';

export default function RequestFormScreen({ route, navigation }) {
  const p = route.params || {};
  const { airports, cityName, isStudent } = useApp();
  const [trip, setTrip] = useState(p.returnDate === '' ? 'oneway' : 'round');
  const [from, setFrom] = useState(p.from || 'NKC');
  const [to, setTo] = useState(p.to || '');
  const [date, setDate] = useState(p.date || addDays(ymd(new Date()), 7));
  const [returnDate, setReturnDate] = useState(p.returnDate || addDays(p.date || ymd(new Date()), 14));
  const [pax, setPax] = useState(p.pax || { adults: 1, children: 0, infants: 0, cabin: 'economy' });
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!from || !to) return showError(new Error(t('chooseCities')));
    setBusy(true);
    try {
      const r = await api('/requests', { method: 'POST', body: { from, to, date, returnDate: trip === 'round' ? returnDate : '', adults: pax.adults, children: pax.children, infants: pax.infants, cabin: pax.cabin, notes } });
      navigation.replace('RequestDetail', { id: r.id });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<Header title={t('quoteRequest')} subtitle={t('quoteRequestSub')} onBack={() => navigation.goBack()} />}>
      <Notice icon="chatbubble-ellipses-outline">{t('quoteRequestInfo')}</Notice>
      {isStudent ? <Notice kind="purple" icon="school">{t('quoteStudentNote')}</Notice> : null}
      <Card style={{ gap: 12 }}>
        <Segmented
          value={trip}
          onChange={setTrip}
          options={[
            { value: 'oneway', label: t('oneWay') },
            { value: 'round', label: t('roundTrip') },
          ]}
        />
        <PickerField label={t('fromLabel')} icon="airplane-outline" value={from ? `${cityName(from)}  ${from}` : ''} placeholder={t('departureCity')} onPress={() => setPicker('from')} />
        <PickerField label={t('toLabel')} icon="location-outline" value={to ? `${cityName(to)}  ${to}` : ''} placeholder={t('destination')} onPress={() => setPicker('to')} />
        <View style={{ flexDirection: dir.row, gap: 8 }}>
          <PickerField style={{ flex: 1 }} label={t('departure')} value={longDate(date)} onPress={() => setPicker('date')} />
          {trip === 'round' ? <PickerField style={{ flex: 1 }} label={t('return')} value={longDate(returnDate)} onPress={() => setPicker('return')} /> : null}
        </View>
        <PickerField label={t('paxAndCabin')} icon="people-outline" value={paxSummary(pax)} onPress={() => setPicker('pax')} />
        <Field multiline label={t('notesOptional')} value={notes} onChangeText={setNotes} placeholder={t('notesPh')} />
        <Btn title={t('sendToAgency')} icon="paper-plane-outline" onPress={submit} loading={busy} />
      </Card>
      <AirportPicker visible={picker === 'from'} title={t('departureCity')} airports={airports} exclude={to} onClose={() => setPicker(null)} onSelect={(a) => setFrom(a.code)} />
      <AirportPicker visible={picker === 'to'} title={t('destination')} airports={airports} exclude={from} onClose={() => setPicker(null)} onSelect={(a) => setTo(a.code)} />
      <DatePicker
        visible={picker === 'date'}
        title={t('departureDate')}
        value={date}
        onClose={() => setPicker(null)}
        onSelect={(d) => {
          setDate(d);
          if (returnDate < d) setReturnDate(addDays(d, 7));
        }}
      />
      <DatePicker visible={picker === 'return'} title={t('returnDate')} value={returnDate} minDate={date} rangeStart={date} onClose={() => setPicker(null)} onSelect={setReturnDate} />
      <PaxPicker visible={picker === 'pax'} value={pax} onChange={setPax} onClose={() => setPicker(null)} />
    </Screen>
  );
}
