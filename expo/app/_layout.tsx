import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { UserProvider } from "@/contexts/UserContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import NotificationBanner from "@/components/NotificationBanner";
import ErrorBoundary from "@/components/ErrorBoundary";
import Colors from "@/constants/colors";

void SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const isTransientFetchError = (msg: string): boolean =>
    /Failed to fetch|NetworkError|Load failed|AuthRetryableFetchError/i.test(msg);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (reason && (reason.message ?? String(reason))) || '';
    if (isTransientFetchError(msg)) {
      console.log('[unhandledrejection] suppressed transient fetch error:', msg);
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message ?? '';
    if (isTransientFetchError(msg)) {
      console.log('[window.error] suppressed transient fetch error:', msg);
      event.preventDefault();
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: true }} />
      <Stack.Screen name="login" options={{ gestureEnabled: true }} />
      <Stack.Screen name="forgot-password" options={{ gestureEnabled: true, presentation: "card" }} />
      <Stack.Screen name="setup-recovery" options={{ gestureEnabled: false, presentation: "modal" }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="island/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="dm/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="user/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="change-password" options={{ presentation: "card" }} />
      <Stack.Screen name="support" options={{ presentation: "card" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
            <UserProvider>
              <ChatProvider>
                <NotificationsProvider>
                  <View style={{ flex: 1, backgroundColor: Colors.bg }}>
                    <StatusBar style="light" />
                    <RootLayoutNav />
                    <NotificationBanner />
                  </View>
                </NotificationsProvider>
              </ChatProvider>
            </UserProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
