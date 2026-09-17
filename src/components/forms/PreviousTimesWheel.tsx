import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { NeonButton } from '@/components/ui/NeonButton';
import { TimeWheelPicker } from '@/components/forms/TimeWheelPicker';
import { colors, spacing, fontSizes, radii, fontWeight } from '@/theme';

type DistanceKey = '5' | '10' | '21' | '42';

interface DistanceConf {
  label: string;
  maxHours: number;
  minSeconds: number;
  alert: string;
}

const DISTANCE_CONFIG: Record<DistanceKey, DistanceConf> = {
  '5': {
    label: '5 km',
    maxHours: 1,
    minSeconds: 14 * 60 + 5,
    alert: 'O RunEvo não foi projetado para atletas que correm 5 km abaixo de 14:05.',
  },
  '10': {
    label: '10 km',
    maxHours: 2,
    minSeconds: 29 * 60 + 45,
    alert: 'O RunEvo não foi projetado para atletas que correm 10 km abaixo de 29:45.',
  },
  '21': {
    label: '21 km (Meia Maratona)',
    maxHours: 4,
    minSeconds: 66 * 60,
    alert: 'O RunEvo não foi projetado para atletas que correm 21 km abaixo de 1:06:00.',
  },
  '42': {
    label: '42 km (Maratona)',
    maxHours: 9,
    minSeconds: 140 * 60,
    alert: 'O RunEvo não foi projetado para atletas que correm 42 km abaixo de 2:20:00.',
  },
};

const DISTANCE_ORDER: DistanceKey[] = ['5', '10', '21', '42'];
const CHIP_LABEL: Record<DistanceKey, string> = {
  '5': '5 km',
  '10': '10 km',
  '21': '21 km',
  '42': '42 km',
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function parseHMS(value: string | undefined): { h: number; m: number; s: number } {
  if (!value) return { h: 0, m: 0, s: 0 };
  const parts = value.split(':').map((p) => Number(p) || 0);
  if (parts.length === 3) return { h: parts[0] ?? 0, m: parts[1] ?? 0, s: parts[2] ?? 0 };
  if (parts.length === 2) return { h: 0, m: parts[0] ?? 0, s: parts[1] ?? 0 };
  return { h: 0, m: 0, s: parts[0] ?? 0 };
}

interface WheelValues {
  time5k?: string;
  no5k?: boolean;
  time10k?: string;
  no10k?: boolean;
  time21k?: string;
  no21k?: boolean;
  time42k?: string;
  no42k?: boolean;
}

interface Props {
  values: WheelValues;
  onChange: (field: string, value: string | boolean) => void;
}

const TIME_FIELD: Record<DistanceKey, keyof WheelValues> = {
  '5': 'time5k',
  '10': 'time10k',
  '21': 'time21k',
  '42': 'time42k',
};
const NO_FIELD: Record<DistanceKey, keyof WheelValues> = {
  '5': 'no5k',
  '10': 'no10k',
  '21': 'no21k',
  '42': 'no42k',
};

function isFilled(values: WheelValues, dist: DistanceKey): boolean {
  const no = values[NO_FIELD[dist]];
  const time = values[TIME_FIELD[dist]];
  return Boolean(no) || Boolean(time && time !== '00:00:00');
}

export function PreviousTimesWheel({ values, onChange }: Props): JSX.Element {
  const [active, setActive] = useState<DistanceKey>('5');
  const [savedDistances, setSavedDistances] = useState<Record<string, boolean>>({});
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [naoCorri, setNaoCorri] = useState(false);

  const conf = DISTANCE_CONFIG[active];
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const wheelLocked = naoCorri || (savedDistances[active] ?? false);

  const belowMin = !naoCorri && totalSeconds > 0 && totalSeconds < conf.minSeconds;
  const canSave = naoCorri || !belowMin;
  const isSaved = savedDistances[active] ?? false;

  // Hidratar estado local quando a distância ativa muda (ou quando o valor
  // salvo daquela distância no form muda — ex.: draft reidratado).
  const activeTime = values[TIME_FIELD[active]] as string | undefined;
  const activeNo = Boolean(values[NO_FIELD[active]]);
  useEffect(() => {
    const parsed = parseHMS(activeTime);
    setHours(parsed.h);
    setMinutes(parsed.m);
    setSeconds(parsed.s);
    setNaoCorri(activeNo);
  }, [active, activeTime, activeNo]);

  const writeTime = (h: number, m: number, s: number): void => {
    setHours(h);
    setMinutes(m);
    setSeconds(s);
    onChange(TIME_FIELD[active], toHMS(h * 3600 + m * 60 + s));
  };

  const handleSelectDistance = (key: DistanceKey): void => {
    // O useEffect reidrata hours/minutes/seconds/naoCorri quando `active` muda.
    setActive(key);
  };

  const toggleNaoCorri = (): void => {
    const next = !naoCorri;
    if (next) {
      // Zera o wheel local
      setHours(0);
      setMinutes(0);
      setSeconds(0);
      // Limpa no form
      onChange(TIME_FIELD[active], '');
    }
    onChange(NO_FIELD[active], next);
    setNaoCorri(next);
  };

  const handleSave = (): void => {
    if (!canSave) return;
    setSavedDistances((prev) => ({ ...prev, [active]: true }));
  };

  const handleEdit = (): void => {
    setSavedDistances((prev) => ({ ...prev, [active]: false }));
  };

  return (
    <View>
      <Text style={styles.title}>Tempo estimado</Text>
      <Text style={styles.subtitle}>
        Preencher seus tempos torna sua planilha mais precisa. Use o tempo do seu condicionamento
        atual, não o RP desatualizado.
      </Text>

      {/* Chips de distância */}
      <View style={styles.chipsRow}>
        {DISTANCE_ORDER.map((key) => {
          const isFil = isFilled(values, key);
          const isAct = active === key;
          return (
            <Pressable
              key={key}
              onPress={() => handleSelectDistance(key)}
              style={[
                styles.chip,
                isAct && styles.chipActive,
                !isAct && isFil && styles.chipFilled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isAct }}
            >
              <Text style={[styles.chipText, (isAct || isFil) && styles.chipTextActiveOrFilled]}>
                {CHIP_LABEL[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Texto dinâmico */}
      <Text style={styles.dynamicLine}>
        <Text style={styles.dynamicLabel}>Atualmente, consigo fazer {conf.label} em: </Text>
        <Text style={styles.dynamicValue}>{toHMS(totalSeconds)}</Text>
      </Text>

      {/* Wheel picker — captura o gesto para não competir com o ScrollView pai
          (evita o aviso "VirtualizedLists should never be nested"). */}
      <View
        style={[styles.wheelRow, wheelLocked && styles.wheelLocked]}
        pointerEvents={wheelLocked ? 'none' : 'auto'}
      >
        <TimeWheelPicker
          value={toHMS(totalSeconds)}
          maxHours={conf.maxHours}
          onChange={(value) => {
            const parsed = parseHMS(value);
            writeTime(parsed.h, parsed.m, parsed.s);
          }}
        />
      </View>

      {/* Alert de trava */}
      {belowMin ? (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>{conf.alert}</Text>
        </View>
      ) : null}

      {/* Checkbox circular com dot */}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: naoCorri }}
        onPress={toggleNaoCorri}
        style={styles.checkOption}
        disabled={isSaved}
      >
        <View style={[styles.checkCircle, naoCorri && styles.checkCircleSelected]}>
          {naoCorri ? <View style={styles.checkDot} /> : null}
        </View>
        <Text style={[styles.checkLabel, naoCorri && styles.checkLabelActive]}>
          Ainda não corri essa distância
        </Text>
      </Pressable>

      {/* Botão Salvar ou Editar */}
      {isSaved ? (
        <Pressable style={styles.editBtn} onPress={handleEdit} accessibilityRole="button">
          <Text style={styles.editBtnText}>Editar</Text>
        </Pressable>
      ) : (
        <NeonButton label="Salvar" onPress={handleSave} disabled={!canSave} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    ...fontWeight('800'),
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardElevated,
    borderColor: '#2A2A2A',
  },
  chipActive: { borderColor: colors.neon, borderWidth: 2 },
  chipFilled: { backgroundColor: 'rgba(204,255,0,0.15)', borderColor: colors.neon },
  chipText: { color: colors.textSecondary, fontSize: fontSizes.base, ...fontWeight('600') },
  chipTextActiveOrFilled: { color: colors.neon, ...fontWeight('700') },
  dynamicLine: { textAlign: 'center', marginBottom: spacing.md },
  dynamicLabel: { color: colors.textSecondary, fontSize: fontSizes.body },
  dynamicValue: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('700') },
  wheelRow: { marginBottom: spacing.md },
  wheelLocked: { opacity: 0.6 },
  alertBox: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alertText: { color: colors.error, fontSize: fontSizes.body, textAlign: 'center' },
  checkOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: { borderColor: colors.neon },
  checkDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.neon },
  checkLabel: { color: colors.textSecondary, fontSize: 16, ...fontWeight('500') },
  checkLabelActive: { color: colors.textPrimary },
  editBtn: {
    height: 52,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.neon,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: { color: colors.neon, fontSize: fontSizes.base, ...fontWeight('700') },
});
