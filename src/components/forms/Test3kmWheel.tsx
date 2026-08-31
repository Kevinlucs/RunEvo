import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import WheelPicker from 'react-native-wheel-picker-expo';
import { colors, spacing, fontWeight } from '@/theme';

interface Props {
  value?: string; // "mm:ss"
  onChange: (mmss: string) => void;
  onPaceChange: (pace: string) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function toMSS(paceSeconds: number): string {
  const m = Math.floor(paceSeconds / 60);
  const s = paceSeconds % 60;
  return `${m}:${pad2(s)}`;
}

function parseMMSS(value: string | undefined): { m: number; s: number } {
  if (!value) return { m: 0, s: 0 };
  const parts = value.split(':').map((p) => Number(p) || 0);
  if (parts.length === 2) return { m: parts[0] ?? 0, s: parts[1] ?? 0 };
  return { m: 0, s: parts[0] ?? 0 };
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export function Test3kmWheel({ value, onChange, onPaceChange }: Props): JSX.Element {
  const { m, s } = useMemo(() => parseMMSS(value), [value]);
  const [minutes, setMinutes] = useState(m);
  const [seconds, setSeconds] = useState(s);

  // Sync local state when value changes (e.g., on mount or external update)
  useEffect(() => {
    setMinutes(m);
    setSeconds(s);
  }, [m, s]);

  const minutesItems = useMemo(() => range(60).map((n) => ({ label: `${n}m`, value: n })), []);
  const secondsItems = useMemo(() => range(60).map((n) => ({ label: `${n}s`, value: n })), []);

  const writeTime = (nm: number, ns: number): void => {
    setMinutes(nm);
    setSeconds(ns);
    const newTotal = nm * 60 + ns;
    onChange(toMMSS(newTotal));
    onPaceChange(toMSS(Math.round(newTotal / 3)));
  };

  return (
    <View
      style={styles.wheelRow}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
    >
      <View style={styles.wheelCol}>
        <WheelPicker
          height={200}
          width={80}
          initialSelectedIndex={minutes}
          items={minutesItems}
          onChange={({ item }) => writeTime(Number(item.value), seconds)}
          backgroundColor={colors.card}
          selectedStyle={{ borderColor: colors.neon, borderWidth: 1 }}
          flatListProps={{ nestedScrollEnabled: true, disableVirtualization: true, removeClippedSubviews: false }}
          haptics
        />
      </View>
      <Text style={styles.colon}>:</Text>
      <View style={styles.wheelCol}>
        <WheelPicker
          height={200}
          width={80}
          initialSelectedIndex={seconds}
          items={secondsItems}
          onChange={({ item }) => writeTime(minutes, Number(item.value))}
          backgroundColor={colors.card}
          selectedStyle={{ borderColor: colors.neon, borderWidth: 1 }}
          flatListProps={{ nestedScrollEnabled: true, disableVirtualization: true, removeClippedSubviews: false }}
          haptics
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wheelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  wheelCol: { width: 80 },
  colon: { color: colors.textMuted, fontSize: 24, ...fontWeight('700'), marginHorizontal: spacing.xs },
});
