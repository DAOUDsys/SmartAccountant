import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Text, XStack } from 'tamagui';

function TypingDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          duration: 320,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: 320,
          toValue: 0.35,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [delay, opacity]);

  return (
    <Animated.View
      style={{
        opacity,
      }}
    >
      <Text color="$gray11" fontSize="$6" lineHeight="$3">
        •
      </Text>
    </Animated.View>
  );
}

export function TypingIndicator() {
  return (
    <XStack
      accessibilityLabel="Assistant is typing"
      alignItems="center"
      backgroundColor="$gray3"
      borderColor="$gray6"
      borderRadius="$6"
      borderWidth={1}
      paddingHorizontal="$3"
      paddingVertical="$2"
      space="$1"
    >
      <TypingDot delay={0} />
      <TypingDot delay={140} />
      <TypingDot delay={280} />
    </XStack>
  );
}
