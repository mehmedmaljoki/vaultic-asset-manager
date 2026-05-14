console.log('[_layout] module loading...');
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useApp } from '@/lib/AppContext';
import DbProvider from '@/lib/db/DbProvider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isDark, settings } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!settings.onboardingDone) {
      router.replace('/(onboarding)' as never);
    }
  }, [settings.onboardingDone]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(onboarding)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    console.log('[RootLayout] fontsLoaded:', fontsLoaded, 'fontError:', fontError);
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DbProvider>
        <AppProvider>
          <RootNavigator />
        </AppProvider>
      </DbProvider>
    </GestureHandlerRootView>
  );
}
