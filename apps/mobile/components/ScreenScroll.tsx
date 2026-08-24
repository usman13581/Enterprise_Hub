import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
} from 'react-native';
import { ui } from '../lib/ui';

type KeyboardLift = 'full' | 'gentle';

type ScreenScrollProps = ScrollViewProps & {
  /**
   * full — keep inputs clear of the keyboard (module forms).
   * gentle — small lift only (login / short screens).
   */
  keyboardLift?: KeyboardLift;
};

/**
 * Scroll container that keeps focused inputs above the software keyboard.
 * Use instead of bare ScrollView on any screen with forms.
 */
export function ScreenScroll({
  children,
  contentContainerStyle,
  style,
  keyboardLift = 'full',
  ...rest
}: ScreenScrollProps) {
  const gentle = keyboardLift === 'gentle';
  const [bottomPad, setBottomPad] = useState(gentle ? 24 : 48);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates.height;
      // Gentle: only a fraction of the keyboard so the form nudges up,
      // without shoving the whole screen toward the top.
      setBottomPad(gentle ? Math.round(h * 0.22) + 16 : h + 32);
    });
    const onHide = Keyboard.addListener(hideEvent, () =>
      setBottomPad(gentle ? 24 : 48),
    );

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [gentle]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // Login has no nav header; module screens sit under the stack header (~88).
      keyboardVerticalOffset={
        Platform.OS === 'ios' ? (gentle ? 12 : 88) : 0
      }
    >
      <ScrollView
        style={[ui.screen, style]}
        contentContainerStyle={[
          ui.content,
          { paddingBottom: bottomPad },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // Full mode uses system insets; gentle avoids double-shifting with
        // KeyboardAvoidingView + large bottom pad.
        automaticallyAdjustKeyboardInsets={!gentle}
        showsVerticalScrollIndicator={false}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
