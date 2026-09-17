import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import WheelPicker from 'react-native-wheel-picker-expo';
import { colors, spacing, fontWeight } from '@/theme';

interface Props {
  /** Tempo no formato HH:MM:SS ou MM:SS. */
  value: string;
  onChange: (value: string) => void;
  maxHours: number;
}

interface TimeParts {
  hours: number;
  minutes: number;
  seconds: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatTime(hours: number, minutes: number, seconds: number): string {
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function parseTime(value: string): TimeParts {
  const parts = value.split(':').map((part) => Number(part) || 0);
  if (parts.length === 3) {
    return { hours: parts[0] ?? 0, minutes: parts[1] ?? 0, seconds: parts[2] ?? 0 };
  }
  if (parts.length === 2) {
    return { hours: 0, minutes: parts[0] ?? 0, seconds: parts[1] ?? 0 };
  }
  return { hours: 0, minutes: 0, seconds: 0 };
}

function buildItems(length: number, suffix: string): { label: string; value: number }[] {
  return Array.from({ length }, (_, value) => ({ label: `${value}${suffix}`, value }));
}

/**
 * Seletor de tempo compartilhado entre IA Evo e recordes manuais.
 * Centralizar a implementação garante o mesmo gesto, dimensões e feedback
 * visual onde o atleta escolhe horas, minutos e segundos.
 */
export function TimeWheelPicker({ value, onChange, maxHours }: Props): JSX.Element {
  const parsed = useMemo(() => parseTime(value), [value]);
  const [hours, setHours] = useState(Math.min(parsed.hours, maxHours));
  const [minutes, setMinutes] = useState(parsed.minutes);
  const [seconds, setSeconds] = useState(parsed.seconds);

  useEffect(() => {
    setHours(Math.min(parsed.hours, maxHours));
    setMinutes(parsed.minutes);
    setSeconds(parsed.seconds);
  }, [maxHours, parsed.hours, parsed.minutes, parsed.seconds]);

  const hourItems = useMemo(() => buildItems(maxHours + 1, 'h'), [maxHours]);
  const minuteItems = useMemo(() => buildItems(60, 'm'), []);
  const secondItems = useMemo(() => buildItems(60, 's'), []);

  const update = (nextHours: number, nextMinutes: number, nextSeconds: number): void => {
    setHours(nextHours);
    setMinutes(nextMinutes);
    setSeconds(nextSeconds);
    onChange(formatTime(nextHours, nextMinutes, nextSeconds));
  };

  const wheelProps = {
    height: 200,
    width: 80,
    backgroundColor: colors.card,
    selectedStyle: { borderColor: colors.neon, borderWidth: 1 },
    flatListProps: {
      nestedScrollEnabled: true,
      disableVirtualization: true,
      removeClippedSubviews: false,
    },
    haptics: true,
  } as const;

  return (
    <View
      style={styles.row}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
    >
      <View style={styles.column}>
        <WheelPicker
          key={`hours-${hours}-${maxHours}`}
          {...wheelProps}
          initialSelectedIndex={hours}
          items={hourItems}
          onChange={({ item }) => update(Number(item.value), minutes, seconds)}
        />
      </View>
      <Text style={styles.separator}>:</Text>
      <View style={styles.column}>
        <WheelPicker
          key={`minutes-${minutes}`}
          {...wheelProps}
          initialSelectedIndex={minutes}
          items={minuteItems}
          onChange={({ item }) => update(hours, Number(item.value), seconds)}
        />
      </View>
      <Text style={styles.separator}>:</Text>
      <View style={styles.column}>
        <WheelPicker
          key={`seconds-${seconds}`}
          {...wheelProps}
          initialSelectedIndex={seconds}
          items={secondItems}
          onChange={({ item }) => update(hours, minutes, Number(item.value))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  column: { width: 80 },
  separator: {
    color: colors.textMuted,
    fontSize: 24,
    ...fontWeight('700'),
    marginHorizontal: spacing.xs,
  },
});
