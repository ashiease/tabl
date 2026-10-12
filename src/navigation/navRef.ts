import { createNavigationContainerRef } from '@react-navigation/native';

export const navRef = createNavigationContainerRef<any>();

/**
 * Jumps to a tab by name. The tab navigator is now the root navigator,
 * so we call navigate with just the tab name.
 */
export function goToTab(tab: string, params?: object) {
  if (!navRef.isReady()) return;
  // @ts-ignore — the ref isn't typed, navigate accepts (name, params)
  navRef.navigate(tab, params);
}

/**
 * Goes to the Home tab AND resets its nested stack to HomeMain.
 */
export function goToHome() {
  if (!navRef.isReady()) return;
  // @ts-ignore
  navRef.navigate('Home', { screen: 'HomeMain' });
}