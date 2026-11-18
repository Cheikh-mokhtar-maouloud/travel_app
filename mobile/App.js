import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/AppContext';
import { API_URL } from './src/config';
import { colors, dir } from './src/theme';
import { t } from './src/i18n';
import { Btn, Empty, Icon, Loading } from './src/components/ui';

import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import BookingFormScreen from './src/screens/BookingFormScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import BookingDetailScreen from './src/screens/BookingDetailScreen';
import RequestFormScreen from './src/screens/RequestFormScreen';
import RequestDetailScreen from './src/screens/RequestDetailScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import AccountScreen from './src/screens/AccountScreen';
import ChatScreen from './src/screens/ChatScreen';
import PointsScreen from './src/screens/PointsScreen';
import StudentScreen from './src/screens/StudentScreen';
import TravelersScreen from './src/screens/TravelersScreen';
import { PackagesScreen, PackageDetailScreen } from './src/screens/PackagesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.accent } };

const TABS = [
  { name: 'Home', label: 'tabHome', icon: 'home', component: HomeScreen },
  { name: 'Bookings', label: 'tabBookings', icon: 'ticket', component: BookingsScreen },
  { name: 'Notifications', label: 'tabNotifications', icon: 'notifications', component: NotificationsScreen, badge: true },
  { name: 'Account', label: 'tabAccount', icon: 'person', component: AccountScreen },
];

function Tabs() {
  const { badges } = useApp();
  // "الرئيسية" دائماً في بداية السطر: يمين في العربية، يسار في الفرنسية
  const ordered = dir.flip ? [...TABS].reverse() : TABS;
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' }, tabBarStyle: { borderTopColor: colors.line } }}
    >
      {ordered.map((tb) => (
        <Tab.Screen
          key={tb.name}
          name={tb.name}
          component={tb.component}
          options={{
            tabBarLabel: t(tb.label),
            tabBarIcon: ({ color, focused, size }) => <Icon name={focused ? tb.icon : `${tb.icon}-outline`} size={size} color={color} />,
            tabBarBadge: tb.badge && badges.unread ? badges.unread : undefined,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

function Root() {
  const { ready, user, config, bootError, boot } = useApp();
  if (!ready) return <Loading />;
  if (!config) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <Empty icon="cloud-offline-outline" title={t('serverUnreachable')} text={`${bootError || ''}\n\n${API_URL}`} action={<Btn title={t('retry')} onPress={boot} small />} />
      </View>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: dir.rtl ? 'slide_from_left' : 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="Results" component={ResultsScreen} />
          <Stack.Screen name="BookingForm" component={BookingFormScreen} />
          <Stack.Screen name="Payment" component={PaymentScreen} />
          <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
          <Stack.Screen name="RequestForm" component={RequestFormScreen} />
          <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Points" component={PointsScreen} />
          <Stack.Screen name="Student" component={StudentScreen} />
          <Stack.Screen name="Travelers" component={TravelersScreen} />
          <Stack.Screen name="Packages" component={PackagesScreen} />
          <Stack.Screen name="PackageDetail" component={PackageDetailScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

// عند تغيير اللغة يتغير المفتاح فيُعاد بناء التطبيق كاملاً بالاتجاه الجديد
function Keyed() {
  const { langKey } = useApp();
  return (
    <NavigationContainer key={langKey} theme={navTheme}>
      <StatusBar style="dark" />
      <Root />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Keyed />
      </AppProvider>
    </SafeAreaProvider>
  );
}
