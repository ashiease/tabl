import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import {
  useFonts,
  GeistMono_400Regular,
  GeistMono_700Bold,
} from '@expo-google-fonts/geist-mono';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
import { Inter_400Regular } from '@expo-google-fonts/inter';

import { StoreProvider, useStore } from './src/state/store';
import { ToastProvider } from './src/components/Toast';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { navRef } from './src/navigation/navRef';
import { theme } from './src/constants/theme';

function Root() {
  const { ready, state } = useStore();
  if (!ready || !state.profile) return <LoginScreen />;
  return (
    <NavigationContainer ref={navRef} theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [loaded] = useFonts({
    GeistMono_400Regular, GeistMono_700Bold,
    SpaceMono_400Regular, SpaceMono_700Bold,
    Inter_400Regular,
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

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: theme.colors.bg },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
});