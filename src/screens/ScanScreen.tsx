import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';

interface Props {
  onScan: (data: string) => boolean;
  onExit: () => void;
  /** If set, shows a blue banner above the frame with the reserve countdown. */
  reservationLabel?: string | null;
}

const FRAME = 240;

export function ScanScreen({ onScan, onExit, reservationLabel }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const qrLock = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Tab screens never unmount, so we track focus ourselves. This resets the
  // scan lock on focus, and (important on Android) lets us unmount the camera
  // while the tab is hidden instead of leaving it running in the background.
  useFocusEffect(
    useCallback(() => {
      qrLock.current = false;
      setFocused(true);
      return () => {
        if (lockTimer.current) clearTimeout(lockTimer.current);
        lockTimer.current = null;
        qrLock.current = false;
        setFocused(false);
      };
    }, [])
  );

  // Clear any pending lock timer on real unmount.
  useEffect(() => {
    return () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    };
  }, []);

  const handleScanned = useCallback(
    ({ data }: { data: string }) => {
      if (qrLock.current) return;
      qrLock.current = true;

      const handled = onScan(data);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Release the lock on a timer. Successful scans release faster
      // (navigation is quick); rejected scans leave a longer pause so the
      // user can see the toast and reposition the QR.
      if (lockTimer.current) clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(
        () => {
          qrLock.current = false;
          lockTimer.current = null;
        },
        handled ? 1500 : 2000
      );
    },
    [onScan]
  );

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.errorWrap, { paddingTop: insets.top + 20 }]}>
        <Pressable onPress={onExit} style={styles.backBtn}>
          <Text style={styles.backText}>← CLOSE</Text>
        </Pressable>

        <View style={styles.errorCenter}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorTitle}>CAMERA ACCESS NEEDED</Text>
          <Text style={styles.errorSub}>
            We need camera access to scan table QR codes.
          </Text>

          <Pressable
            onPress={() => Linking.openSettings()}
            style={({ pressed }) => [
              styles.settingsBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.settingsText}>OPEN SETTINGS</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const windowTop = (screenH - FRAME) / 2 - 80;
  const windowLeft = (screenW - FRAME) / 2;

  return (
    <View style={styles.root}>
      {focused && (
        <CameraView
          // Key on whether a reservation exists, NOT the label. The label is a
          // live countdown, so keying on it remounted the camera every tick,
          // which caused flicker and dropped scans on Android.
          key={reservationLabel ? 'reservation' : 'no-reservation'}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleScanned}
        />
      )}

      {/* Top mask */}
      <View
        pointerEvents="none"
        style={[styles.maskStrip, { top: 0.1, left: 0, right: 0, height: windowTop }]}
      />
      {/* Bottom mask */}
      <View
        pointerEvents="none"
        style={[
          styles.maskStrip,
          { top: windowTop + FRAME, left: 0, right: 0, bottom: 0 },
        ]}
      />
      {/* Left mask */}
      <View
        pointerEvents="none"
        style={[
          styles.maskStrip,
          { top: windowTop, left: 0, width: windowLeft, height: FRAME },
        ]}
      />
      {/* Right mask */}
      <View
        pointerEvents="none"
        style={[
          styles.maskStrip,
          {
            top: windowTop,
            left: windowLeft + FRAME,
            right: 0,
            height: FRAME,
          },
        ]}
      />

      {/* Corner frame */}
      <View
        pointerEvents="none"
        style={[
          styles.frame,
          { top: windowTop, left: windowLeft, width: FRAME, height: FRAME },
        ]}
      >
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
        {focused && <ScanLine />}
      </View>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onExit} style={styles.backBtn}>
          <Text style={styles.backText}>← CLOSE</Text>
        </Pressable>
        <Text style={styles.title}>SCAN TABLE</Text>
      </View>

      {/* Reservation banner */}
      {reservationLabel && (
        <View style={[styles.reserveBanner, { top: insets.top + 52 }]}>
          <View style={styles.reserveBar} />
          <Text style={styles.reserveText}>{reservationLabel}</Text>
        </View>
      )}

      {/* Bottom caption */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.caption}>
          ALIGN THE TABLE QR{'\n'}WITHIN THE FRAME
        </Text>
      </View>
    </View>
  );
}

// Runs on the native thread via Animated, so it stays smooth even when the JS
// thread is busy handling camera callbacks. The old version re-rendered the
// whole component 60x/sec with setState and recreated its interval every
// time the direction flipped.
function ScanLine() {
  const translateY = useRef(new Animated.Value(4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: FRAME - 6,
          duration: 1900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 4,
          duration: 1900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.scanLine, { transform: [{ translateY }] }]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  maskStrip: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.75)' },

  frame: { position: 'absolute', overflow: 'hidden' },
  corner: { position: 'absolute', width: 32, height: 32 },
  tl: {
    top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3,
    borderTopColor: theme.colors.green, borderLeftColor: theme.colors.green,
  },
  tr: {
    top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3,
    borderTopColor: theme.colors.green, borderRightColor: theme.colors.green,
  },
  bl: {
    bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3,
    borderBottomColor: theme.colors.green, borderLeftColor: theme.colors.green,
  },
  br: {
    bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3,
    borderBottomColor: theme.colors.green, borderRightColor: theme.colors.green,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 8, right: 8, height: 2,
    backgroundColor: theme.colors.green,
    opacity: 0.85,
  },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backBtn: { paddingVertical: 6 },
  backText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 2,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 16,
    color: theme.colors.text,
    letterSpacing: 1.5,
  },

  reserveBanner: {
    position: 'absolute',
    left: 16, right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,10,0.95)',
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    borderRadius: theme.radius,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  reserveBar: {
    width: 3, height: '100%',
    backgroundColor: theme.colors.blue,
    borderRadius: 2,
    marginRight: 4,
  },
  reserveText: {
    flex: 1,
    fontFamily: theme.fonts.monoBold,
    fontSize: 10,
    color: theme.colors.blue,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  caption: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 3,
    textAlign: 'center',
    lineHeight: 18,
  },

  errorWrap: { padding: 20 },
  errorCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorIcon: {
    fontSize: 40, color: theme.colors.yellow,
    marginBottom: 20, fontFamily: theme.fonts.mono,
  },
  errorTitle: {
    fontFamily: theme.fonts.monoBold, fontSize: 12,
    color: theme.colors.text, letterSpacing: 2.5, marginBottom: 12,
  },
  errorSub: {
    fontFamily: theme.fonts.mono, fontSize: 10,
    color: theme.colors.textDim, letterSpacing: 1.5,
    textAlign: 'center', lineHeight: 18, marginBottom: 28,
  },
  settingsBtn: {
    paddingVertical: 14, paddingHorizontal: 24,
    borderWidth: 1, borderColor: theme.colors.borderBright,
    borderRadius: theme.radius, backgroundColor: 'transparent',
  },
  settingsText: {
    fontFamily: theme.fonts.monoBold, fontSize: 11,
    color: theme.colors.text, letterSpacing: 2,
  },
});