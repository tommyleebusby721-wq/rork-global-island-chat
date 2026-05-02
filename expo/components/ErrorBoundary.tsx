import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Colors from '@/constants/colors';

interface State {
  hasError: boolean;
  message: string;
}

interface Props {
  children: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    const msg = error?.message ?? 'Something went wrong';
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      return { hasError: false, message: '' };
    }
    return { hasError: true, message: msg };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.log('[ErrorBoundary] caught', error?.message, info?.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle} numberOfLines={4}>
          {Platform.OS === 'web' ? 'Try refreshing the page.' : 'Tap to retry.'}
        </Text>
        <TouchableOpacity style={styles.btn} onPress={this.reset} testID="error-retry">
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  btn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: Colors.white, fontWeight: '700' as const, fontSize: 15 },
});
