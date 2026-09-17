import {
  computeLevel,
  computeKmToNextLevel,
  computeAchievements,
  computeRecords,
  computePace,
  parseTimeToSeconds,
} from '@/services/gamification/compute';
import { PERSONAL_RECORDS } from '@/services/gamification/constants';

describe('Gamification Services', () => {
  describe('computeLevel', () => {
    it('retorna Amarelo para 0-49.99 km', () => {
      expect(computeLevel(0).key).toBe('amarelo');
      expect(computeLevel(25).key).toBe('amarelo');
      expect(computeLevel(49.99).key).toBe('amarelo');
    });

    it('retorna Laranja para 50-249.9 km', () => {
      expect(computeLevel(50).key).toBe('laranja');
      expect(computeLevel(100).key).toBe('laranja');
      expect(computeLevel(249.9).key).toBe('laranja');
    });

    it('retorna Verde para 250-999.9 km', () => {
      expect(computeLevel(250).key).toBe('verde');
      expect(computeLevel(500).key).toBe('verde');
    });

    it('retorna Azul para 1000-2499.9 km', () => {
      expect(computeLevel(1000).key).toBe('azul');
      expect(computeLevel(1500).key).toBe('azul');
    });

    it('retorna Verde-limão para 15000+ km', () => {
      expect(computeLevel(15000).key).toBe('verde-limao');
      expect(computeLevel(50000).key).toBe('verde-limao');
    });
  });

  describe('computeKmToNextLevel', () => {
    it('retorna km até o próximo nível', () => {
      // Em Amarelo (0-49.99), no início: próximo nível é Laranja (50)
      expect(computeKmToNextLevel(0)).toBe(50);
      // Em Amarelo a 30 km: 50 - 30 = 20 km para Laranja
      expect(computeKmToNextLevel(30)).toBe(20);
    });

    it('retorna 0 quando já está no último nível', () => {
      expect(computeKmToNextLevel(15000)).toBe(0);
      expect(computeKmToNextLevel(50000)).toBe(0);
    });

    it('transição suave entre níveis', () => {
      // No início de Laranja (50 km)
      const kmInLaranja = computeKmToNextLevel(50);
      // Próximo nível é Verde (250)
      expect(kmInLaranja).toBe(250 - 50);
    });
  });

  describe('computeAchievements', () => {
    it('desbloqueia conquistas de corridas concluídas', () => {
      const achievements = computeAchievements(100, 10, 1, 15);
      const workoutAchievements = achievements.filter(
        (a) => a.categoryKey === 'workouts-completed',
      );
      // Com 10 corridas: 1ª, 10 devem estar desbloqueadas; 50, 100+ não
      expect(workoutAchievements.find((a) => a.key === 'workouts-1')?.unlocked).toBe(true);
      expect(workoutAchievements.find((a) => a.key === 'workouts-10')?.unlocked).toBe(true);
      expect(workoutAchievements.find((a) => a.key === 'workouts-50')?.unlocked).toBe(false);
    });

    it('desbloqueia conquistas de distância total', () => {
      const achievements = computeAchievements(500, 50, 2, 20);
      const distanceAchievements = achievements.filter((a) => a.categoryKey === 'total-distance');
      expect(distanceAchievements.find((a) => a.key === 'distance-100')?.unlocked).toBe(true);
      expect(distanceAchievements.find((a) => a.key === 'distance-500')?.unlocked).toBe(true);
      expect(distanceAchievements.find((a) => a.key === 'distance-1000')?.unlocked).toBe(false);
    });

    it('desbloqueia conquistas de distância máxima numa atividade', () => {
      const achievements = computeAchievements(200, 30, 1, 42.5); // maxSingleWorkout = 42.5 (maratona+)
      const maxDistAchievements = achievements.filter((a) => a.categoryKey === 'max-distance');
      expect(maxDistAchievements.find((a) => a.key === 'max-10')?.unlocked).toBe(true);
      expect(maxDistAchievements.find((a) => a.key === 'max-42.2')?.unlocked).toBe(true); // maratona
      expect(maxDistAchievements.find((a) => a.key === 'max-50')?.unlocked).toBe(false);
    });

    it('desbloqueia conquistas de planos concluídos', () => {
      const achievements = computeAchievements(300, 60, 5, 25);
      const planAchievements = achievements.filter((a) => a.categoryKey === 'plans-completed');
      expect(planAchievements.find((a) => a.key === 'plans-1')?.unlocked).toBe(true);
      expect(planAchievements.find((a) => a.key === 'plans-5')?.unlocked).toBe(true);
      expect(planAchievements.find((a) => a.key === 'plans-10')?.unlocked).toBe(false);
    });

    it('retorna 22 conquistas no total (6+6+5+5)', () => {
      const achievements = computeAchievements(1000, 100, 3, 50);
      expect(achievements.length).toBe(22);
    });
  });

  describe('computeRecords', () => {
    it('retorna todos os recordes com data/tempo vazio (integrações futuras)', () => {
      const records = computeRecords();
      expect(records.length).toBe(PERSONAL_RECORDS.length);
      records.forEach((r) => {
        expect(r.pace).toBeUndefined();
        expect(r.time).toBeUndefined();
        expect(r.date).toBeUndefined();
      });
    });

    it('mantém as propriedades base dos recordes (distância, cor, label)', () => {
      const records = computeRecords();
      const fiveKRecord = records.find((r) => r.key === '5k');
      expect(fiveKRecord?.distance).toBe(5);
      expect(fiveKRecord?.distanceLabel).toBe('5k');
      expect(fiveKRecord?.color).toBeDefined();
    });

    it('mescla overrides manuais e calcula o pace derivado', () => {
      const records = computeRecords({ '5k': { time: '20:00', date: '2025-06-01' } });
      const fiveK = records.find((r) => r.key === '5k');
      expect(fiveK?.time).toBe('20:00');
      expect(fiveK?.date).toBe('2025-06-01');
      expect(fiveK?.pace).toBe("4'00/km"); // 1200s / 5km = 240s/km
      // Distâncias sem override permanecem vazias
      const marathon = records.find((r) => r.key !== '5k');
      expect(marathon?.time).toBeUndefined();
      expect(marathon?.pace).toBeUndefined();
    });
  });

  describe('parseTimeToSeconds', () => {
    it('interpreta MM:SS e HH:MM:SS', () => {
      expect(parseTimeToSeconds('20:00')).toBe(1200);
      expect(parseTimeToSeconds('1:30:00')).toBe(5400);
      expect(parseTimeToSeconds('00:04:00')).toBe(240);
    });

    it('rejeita valores inválidos', () => {
      expect(parseTimeToSeconds('20:99')).toBeNull(); // segundos >= 60
      expect(parseTimeToSeconds('abc')).toBeNull();
      expect(parseTimeToSeconds('1:2:3:4')).toBeNull();
    });
  });

  describe('computePace', () => {
    it('calcula pace a partir do tempo e distância', () => {
      expect(computePace('20:00', 5)).toBe("4'00/km");
      expect(computePace('50:00', 10)).toBe("5'00/km");
    });

    it('retorna undefined para entradas inválidas', () => {
      expect(computePace(undefined, 5)).toBeUndefined();
      expect(computePace('20:00', 0)).toBeUndefined();
      expect(computePace('lixo', 5)).toBeUndefined();
    });
  });
});
