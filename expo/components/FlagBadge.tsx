import React from 'react';
import { View, Image, StyleSheet, Text, Platform } from 'react-native';
import Colors from '@/constants/colors';

interface FlagBadgeProps {
  code: string;
  fallback?: string;
  size?: number;
  rounded?: 'circle' | 'square';
  testID?: string;
}

export default function FlagBadge({
  code,
  fallback,
  size = 48,
  rounded = 'circle',
  testID,
}: FlagBadgeProps) {
  const radius = rounded === 'circle' ? size / 2 : Math.round(size * 0.28);
  const imgW = Math.round(size * 0.8);
  const imgH = Math.round(imgW * 0.66);
  const url = `https://flagcdn.com/w160/${code.toLowerCase()}.png`;

  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
    >
      {code ? (
        <Image
          source={{ uri: url }}
          style={{
            width: imgW,
            height: imgH,
            borderRadius: 4,
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
              default: {},
            }),
          }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{ fontSize: Math.round(size * 0.5) }}>{fallback ?? '🏳️'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
