import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import {
  useFonts,
  DotGothic16_400Regular,
} from '@expo-google-fonts/dotgothic16';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import { StoreProvider } from './src/state/store';
import { ToastProvider } from './src/components/Toast';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navRef } from './src/navigation/navRef';
import { theme } from './src/constants/theme';

export default function App() {
  const [loaded] = useFonts({
    DotGothic16_400Regular,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    Inter_400Regular,
  });

  if (!loaded) return null;

  const navTheme = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: theme.colors.bg },
  };

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ToastProvider>
          <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />
          <View style={styles.root}>
            <NavigationContainer ref={navRef} theme={navTheme}>
              <RootNavigator />
            </NavigationContainer>
          </View>
        </ToastProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
});