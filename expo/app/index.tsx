import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import Colors from '@/constants/colors';

export default function IndexScreen() {
  const { profile, isLoading } = useUser();

  if (isLoading) {
    return (
      <View style={styles.container} testID="index-loading">
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href="/(tabs)/islands" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
