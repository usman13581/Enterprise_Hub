import { HeaderBackButton } from '@react-navigation/elements';
import { useNavigation, useRouter, useSegments } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import {
  isCompanyHomeRoute,
  isLoginRoute,
  isRootRoute,
  smartBackHref,
  smartBackLabel,
  shouldReplaceInsteadOfBack,
} from '../lib/smartNavigation';
import { colors } from '../lib/ui';

export function SmartHeaderBack() {
  const router = useRouter();
  const segments = useSegments();
  const navigation = useNavigation();

  if (isCompanyHomeRoute(segments) || isLoginRoute(segments)) {
    return (
      <View style={styles.logoWrap}>
        <Image
          source={require('../assets/prequaliq-mark.png')}
          style={styles.logo}
          accessibilityLabel="Prequaliq"
        />
      </View>
    );
  }

  if (isRootRoute(segments)) return null;

  const label = smartBackLabel(segments);

  return (
    <HeaderBackButton
      tintColor={colors.ink}
      label={label}
      truncatedLabel={label}
      onPress={() => {
        const state = navigation.getState();
        if (shouldReplaceInsteadOfBack(state)) {
          router.replace(smartBackHref(segments) as never);
          return;
        }
        if (navigation.canGoBack()) {
          router.back();
          return;
        }
        router.replace(smartBackHref(segments) as never);
      }}
    />
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    marginLeft: 4,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
});
