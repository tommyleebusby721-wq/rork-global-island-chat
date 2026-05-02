import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { Check, X, HelpCircle, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { SECURITY_QUESTIONS } from '@/contexts/UserContext';

interface Props {
  value: string;
  onChange: (q: string) => void;
  testID?: string;
}

export default function SecurityQuestionPicker({ value, onChange, testID }: Props) {
  const [open, setOpen] = React.useState<boolean>(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <TouchableOpacity
        testID={testID}
        style={styles.picker}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <View style={styles.iconBubble}>
          <HelpCircle size={18} color={Colors.accentLight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{value || 'Pick a security question'}</Text>
          <Text style={styles.hint}>Used only to recover your account</Text>
        </View>
        <ChevronRight size={18} color={Colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>Security question</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
              <X size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {SECURITY_QUESTIONS.map((q) => {
              const active = q === value;
              return (
                <TouchableOpacity
                  key={q}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => { onChange(q); setOpen(false); }}
                  testID={`sq-${q}`}
                >
                  <Text style={[styles.rowText, active && { color: Colors.accentLight }]}>{q}</Text>
                  {active && <Check size={18} color={Colors.accentLight} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgElevated,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBubble: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  label: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  hint: { color: Colors.textTertiary, fontSize: 12, marginTop: 2 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: '75%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' as const },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12,
  },
  rowActive: { backgroundColor: 'rgba(59,130,246,0.12)' },
  rowText: { color: Colors.text, fontSize: 15, flex: 1, paddingRight: 12 },
});
