import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface Props {
  text: string;
  isMine: boolean;
}

export default React.memo(function MessageText({ text, isMine }: Props) {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return (
    <Text style={[styles.base, { color: isMine ? Colors.white : Colors.text }]}>
      {parts.map((part, i) => {
        if (/^@[a-zA-Z0-9_]+$/.test(part)) {
          return (
            <Text key={`${i}-${part}`} style={[styles.mention, isMine && styles.mentionMine]}>
              {part}
            </Text>
          );
        }
        return <Text key={`${i}-${part}`}>{part}</Text>;
      })}
    </Text>
  );
});

const styles = StyleSheet.create({
  base: { fontSize: 15.5, lineHeight: 21 },
  mention: { color: Colors.accentLight, fontWeight: '700' as const },
  mentionMine: { color: '#DBEAFE' },
});
