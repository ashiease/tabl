import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { StoreProvider, useStore } from './src/state/store';
import { ToastProvider } from './src/components/Toast';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { navRef } from './src/navigation/navRef';
import { theme } from './src/constants/theme';

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: theme.colors.bg },
};

/**
 * Sits inside StoreProvider so it can read auth state.
 * Shows LoginScreen until the store is ready AND a profile has loaded.
 * This is the gate that prevents RootNavigator from rendering with
 * `state.profile === null`.
 */
function Root() {
  const { ready, state } = useStore();

  if (!ready || !state.profile) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer ref={navRef} theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ToastProvider>
          <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />
          <View style={styles.root}>
            <Root />
          </View>
        </ToastProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
});