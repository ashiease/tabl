import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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
const MASK_COLOR = '#000000';

export function ScanScreen({ onScan, onExit, reservationLabel }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const qrLock = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScanned = useCallback(
    ({ data }: { data: string }) => {
      if (qrLock.current) return;
      qrLock.current = true;

      const handled = onScan(data);

      if (handled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } else {
        setTimeout(() => {
          qrLock.current = false;
        }, 1500);
      }
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
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScanned}
      />

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
        <ScanLine />
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

function ScanLine() {
  const [y, setY] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);

  useEffect(() => {
    const STEP = 2;
    const t = setInterval(() => {
      setY(prev => {
        let next = prev + dir * STEP;
        if (next >= FRAME - 4) {
          setDir(-1);
          next = FRAME - 4;
        } else if (next <= 4) {
          setDir(1);
          next = 4;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(t);
  }, [dir]);

  return <View style={[styles.scanLine, { top: y }]} pointerEvents="none" />;
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
    fontFamily: theme.fonts.dot,
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