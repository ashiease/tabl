import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
  } from 'react';
  import { Animated, StyleSheet, Text, View } from 'react-native';
  import { theme } from '../constants/theme';
  
  type ToastType = 'info' | 'success' | 'error' | 'warning';
  
  interface ToastValue {
    show: (msg: string, type?: ToastType) => void;
  }
  
  const ToastContext = createContext<ToastValue | null>(null);
  
  export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx;
  }
  
  export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<{ msg: string; type: ToastType; id: number } | null>(null);
  
    const show = useCallback((msg: string, type: ToastType = 'info') => {
      setToast({ msg, type, id: Date.now() });
    }, []);
  
    return (
      <ToastContext.Provider value={{ show }}>
        {children}
        {toast && (
          <ToastHost
            key={toast.id}
            message={toast.msg}
            type={toast.type}
            onHide={() => setToast(null)}
          />
        )}
      </ToastContext.Provider>
    );
  }
  
  function ToastHost({
    message,
    type,
    onHide,
  }: {
    message: string;
    type: ToastType;
    onHide: () => void;
  }) {
    const translate = useRef(new Animated.Value(100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
  
    useEffect(() => {
      Animated.parallel([
        Animated.timing(translate, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
  
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translate, { toValue: 100, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => onHide());
      }, 2400);
  
      return () => clearTimeout(t);
    }, []);
  
    const accent =
      type === 'success' ? theme.colors.green
      : type === 'error' ? theme.colors.red
      : type === 'warning' ? theme.colors.yellow
      : theme.colors.green;
  
    return (
      <Animated.View
        style={[
          styles.toast,
          { borderLeftColor: accent, transform: [{ translateY: translate }], opacity },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.text} numberOfLines={2}>
          › {message}
        </Text>
      </Animated.View>
    );
  }
  
  const styles = StyleSheet.create({
    toast: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 90,
      padding: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderBright,
      borderLeftWidth: 3,
      borderRadius: theme.radius,
      zIndex: 999,
    },
    text: {
      fontFamily: theme.fonts.monoBold,
      fontSize: 10,
      color: theme.colors.text,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
  });