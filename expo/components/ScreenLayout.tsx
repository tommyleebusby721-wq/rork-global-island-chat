import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';

export const LAYOUT = {
  headerTopSpacing: 8,
  headerBottomSpacing: 10,
  horizontalPadding: 20,
  contentTopSpacing: 0,
  tabBarClearance: 96,
} as const;

interface ScreenLayoutProps {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  compactHeader?: boolean;
  style?: StyleProp<ViewStyle>;
  showDivider?: boolean;
  testID?: string;
}

export default function ScreenLayout({
  children,
  eyebrow,
  title,
  subtitle,
  headerRight,
  compactHeader,
  style,
  showDivider,
  testID,
}: ScreenLayoutProps) {
  const insets = useSafeAreaInsets();

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? 12 : 8) + LAYOUT.headerTopSpacing;
  return (
    <View style={[styles.root, style]} testID={testID}>
      <LinearGradient
        colors={["#0B1220", "#0E1836", "#0B1220"]}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.header,
          { paddingTop: topPad },
        ]}
      >
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={compactHeader ? styles.titleCompact : styles.title}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
      </View>

      {showDivider ? <View style={styles.divider} /> : null}

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: LAYOUT.horizontalPadding,
    paddingBottom: LAYOUT.headerBottomSpacing,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  headerRight: { paddingBottom: 2 },
  eyebrow: {
    color: Colors.accentLight,
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 2,
    marginBottom: 6,
    opacity: 0.9,
  },
  title: {
    color: Colors.text,
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  titleCompact: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    opacity: 0.75,
    fontWeight: '500' as const,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: LAYOUT.horizontalPadding,
  },
  content: {
    flex: 1,
    paddingTop: LAYOUT.contentTopSpacing,
  },
});
