import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';

interface Props {
  /** Called with the raw scanned string. Returns true if the caller handled it
   *  (scanner should lock/close); false if the payload was rejected and the
   *  scanner should keep running. */
  onScan: (data: string) => boolean;
  onExit: () => void;
}

export function ScanScreen({ onScan, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const qrLock = useRef(false);

  // Auto-request permission on first mount
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
        // Caller will unmount us; no need to unlock.
      } else {
        // Let the user try again after a beat
        setTimeout(() => {
          qrLock.current = false;
        }, 1500);
      }
    },
    [onScan]
  );

  // Permission not yet determined — show nothing while OS prompt is pending
  if (!permission) {
    return <View style={styles.root} />;
  }

  // Permission denied — show recovery UI
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

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScanned}
      />

      {/* Dark mask with a transparent cutout for the frame.
          The maskHole is FRAME×FRAME and centered; its huge border
          paints the dark overlay all the way past the screen edges. */}
      <View style={styles.maskWrap} pointerEvents="none">
        <View style={styles.maskHole} />
      </View>

      {/* Corner frame */}
      <View style={styles.frame} pointerEvents="none">
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

      {/* Bottom caption */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.caption}>
          ALIGN THE TABLE QR{'\n'}WITHIN THE FRAME
        </Text>
      </View>
    </View>
  );
}

/** Animated horizontal line sweeping up and down inside the frame. */
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

const FRAME = 240;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Dark mask — a centered FRAME×FRAME View whose enormous border
  // paints the dim overlay everywhere outside the frame.
  maskWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maskHole: {
    width: FRAME,
    height: FRAME,
    borderWidth: 2000,
    borderColor: 'rgba(0,0,0,0.55)',
  },

  // The visible frame
  frame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: FRAME,
    height: FRAME,
    marginTop: -FRAME / 2,
    marginLeft: -FRAME / 2,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopColor: theme.colors.green,
    borderLeftColor: theme.colors.green,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopColor: theme.colors.green,
    borderRightColor: theme.colors.green,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomColor: theme.colors.green,
    borderLeftColor: theme.colors.green,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomColor: theme.colors.green,
    borderRightColor: theme.colors.green,
  },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: theme.colors.green,
    opacity: 0.85,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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

  // Bottom caption
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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

  // Permission denied
  errorWrap: { padding: 20 },
  errorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorIcon: {
    fontSize: 40,
    color: theme.colors.yellow,
    marginBottom: 20,
    fontFamily: theme.fonts.mono,
  },
  errorTitle: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 12,
    color: theme.colors.text,
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  errorSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  settingsBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    borderRadius: theme.radius,
    backgroundColor: 'transparent',
  },
  settingsText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 11,
    color: theme.colors.text,
    letterSpacing: 2,
  },
});