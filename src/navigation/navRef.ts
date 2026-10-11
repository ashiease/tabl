import {
  CommonActions,
  StackActions,
  createNavigationContainerRef,
} from '@react-navigation/native';

export const navRef = createNavigationContainerRef<any>();

export function goToTab(tab: string, params?: object) {
  if (!navRef.isReady()) return;

  const rootState = navRef.getRootState();
  // rootState is our Stack navigator. index 0 = Tabs on top,
  // index > 0 = Browse or Map pushed above Tabs.
  if (rootState && rootState.index > 0) {
    navRef.dispatch(StackActions.popToTop());
  }

  navRef.dispatch(CommonActions.navigate('Tabs', { screen: tab, params }));
}