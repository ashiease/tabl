import {
    CommonActions,
    StackActions,
    createNavigationContainerRef,
  } from '@react-navigation/native';
  
  export const navRef = createNavigationContainerRef<any>();
  
  /**
   * Jumps to a tab. If a Browse or Map screen is currently pushed on top
   * of the stack, pop back to Tabs first so the stack is clean.
   */
  export function goToTab(tab: string, params?: object) {
    if (!navRef.isReady()) return;
  
    const current = navRef.getCurrentRoute();
  
    // If we're on a pushed screen, pop back to the Tabs root first.
    if (current && current.name !== 'Tabs') {
      navRef.dispatch(StackActions.popToTop());
    }
  
    // Switch to the requested tab (nested navigator target).
    navRef.dispatch(
      CommonActions.navigate('Tabs', { screen: tab, params })
    );
  }