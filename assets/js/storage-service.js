// ===== STORAGE SERVICE =====
// Camada central de persistência do RUINNA.
// Hoje usa localStorage; no futuro pode trocar por Supabase/Firebase sem reescrever o app.

const StorageService = (() => {
  const APP = 'ruinna';
  const LEGACY_APP = 'planebsb';
  const SCHEMA_VERSION = 1;

  function safeParse(value, fallback = null) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn('StorageService: falha ao interpretar JSON.', error);
      return fallback;
    }
  }

  function getRaw(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      console.warn('StorageService: falha ao ler chave.', key, error);
      return fallback;
    }
  }

  function setRaw(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('StorageService: falha ao salvar chave.', key, error);
      return false;
    }
  }

  function removeRaw(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn('StorageService: falha ao remover chave.', key, error);
      return false;
    }
  }

  function getJSON(key, fallback = null) {
    return safeParse(getRaw(key, null), fallback);
  }

  function setJSON(key, value) {
    return setRaw(key, JSON.stringify(value));
  }

  function getCurrentUser() {
    return getRaw(`${APP}_current_user`, getRaw(`${LEGACY_APP}_current_user`, 'guest')) || 'guest';
  }

  function userKey(suffix, user = getCurrentUser()) {
    return `${user}_${APP}_${suffix}`;
  }

  function legacyKey(name) {
    return `${LEGACY_APP}_${name}`;
  }

  function legacyUserKey(suffix, user = getCurrentUser()) {
    return `${user}_${LEGACY_APP}_${suffix}`;
  }

  function getKeys(user = getCurrentUser()) {
    return {
      currentUser: `${APP}_current_user`,
      loggedIn: `${APP}_logged_in`,
      legacyCurrentUser: `${LEGACY_APP}_current_user`,
      legacyLoggedIn: `${LEGACY_APP}_logged_in`,

      completed: userKey('completed_workouts', user),
      custom: userKey('customizations', user),
      workoutFeedback: userKey('workout_feedback', user),
      weeklyCheckins: userKey('weekly_checkins', user),
      adjustmentHistory: userKey('adjustment_history', user),
      userProfile: userKey('user_profile', user),
      onboardingSeen: userKey('onboarding_seen', user),
      plan: userKey('ai_plan', user),
      adopted: userKey('ai_adopted', user),

      legacyCompleted: legacyKey('completed'),
      legacyCustom: legacyKey('custom'),
      legacyWorkoutFeedback: legacyUserKey('workout_feedback', user),
      legacyWeeklyCheckins: legacyUserKey('weekly_checkins', user),
      legacyAdjustmentHistory: legacyUserKey('adjustment_history', user),
      legacyUserProfile: legacyUserKey('user_profile', user),
      legacyOnboardingSeen: legacyUserKey('onboarding_seen', user),
      legacyPlan: legacyUserKey('ai_plan', user),
      legacyAdopted: legacyUserKey('ai_adopted', user)
    };
  }

  function isLoggedIn() {
    return getRaw(`${APP}_logged_in`) === 'true' || getRaw(`${LEGACY_APP}_logged_in`) === 'true';
  }

  function login(user) {
    setRaw(`${APP}_logged_in`, 'true');
    setRaw(`${APP}_current_user`, user || 'guest');
  }

  function logout() {
    removeRaw(`${APP}_logged_in`);
    removeRaw(`${APP}_current_user`);
    removeRaw(`${LEGACY_APP}_logged_in`);
    removeRaw(`${LEGACY_APP}_current_user`);
  }

  function hasSeenOnboardingTour() {
    const keys = getKeys();
    return getRaw(keys.onboardingSeen, getRaw(keys.legacyOnboardingSeen)) === 'true';
  }

  function setOnboardingTourSeen(value = true) {
    const keys = getKeys();
    if (value) return setRaw(keys.onboardingSeen, 'true');
    return removeRaw(keys.onboardingSeen);
  }

  function loadUserProfile() {
    const keys = getKeys();
    return getJSON(keys.userProfile, getJSON(keys.legacyUserProfile, {})) || {};
  }

  function saveUserProfile(value) {
    return setJSON(getKeys().userProfile, value || {});
  }

  function loadCompletedWorkouts() {
    const keys = getKeys();
    return getJSON(keys.completed, getJSON(keys.legacyCompleted, {})) || {};
  }

  function saveCompletedWorkouts(value) {
    return setJSON(getKeys().completed, value || {});
  }

  function loadCustomizations() {
    const keys = getKeys();
    return getJSON(keys.custom, getJSON(keys.legacyCustom, {})) || {};
  }

  function saveCustomizations(value) {
    return setJSON(getKeys().custom, value || {});
  }

  function loadWorkoutFeedback() {
    const keys = getKeys();
    return getJSON(keys.workoutFeedback, getJSON(keys.legacyWorkoutFeedback, {})) || {};
  }

  function saveWorkoutFeedback(value) {
    return setJSON(getKeys().workoutFeedback, value || {});
  }

  function loadWeeklyCheckins() {
    const keys = getKeys();
    return getJSON(keys.weeklyCheckins, getJSON(keys.legacyWeeklyCheckins, {})) || {};
  }

  function saveWeeklyCheckins(value) {
    return setJSON(getKeys().weeklyCheckins, value || {});
  }

  function loadAdjustmentHistory() {
    const keys = getKeys();
    const value = getJSON(keys.adjustmentHistory, getJSON(keys.legacyAdjustmentHistory, []));
    return Array.isArray(value) ? value : [];
  }

  function saveAdjustmentHistory(value) {
    return setJSON(getKeys().adjustmentHistory, Array.isArray(value) ? value : []);
  }

  function loadPlan() {
    const keys = getKeys();
    return getJSON(keys.plan, getJSON(keys.legacyPlan, null));
  }

  function savePlan(plan) {
    return setJSON(getKeys().plan, plan);
  }

  function clearPlan() {
    const keys = getKeys();
    removeRaw(keys.plan);
    removeRaw(keys.adopted);
  }

  function isPlanAdopted() {
    const keys = getKeys();
    return getRaw(keys.adopted, getRaw(keys.legacyAdopted)) === 'true';
  }

  function setPlanAdopted(value) {
    const keys = getKeys();
    if (value) return setRaw(keys.adopted, 'true');
    return removeRaw(keys.adopted);
  }

  function clearAdaptiveData() {
    saveCompletedWorkouts({});
    saveCustomizations({});
    saveWorkoutFeedback({});
    saveWeeklyCheckins({});
    saveAdjustmentHistory([]);
  }

  function clearCurrentUserData() {
    const keys = getKeys();
    removeRaw(keys.completed);
    removeRaw(keys.custom);
    removeRaw(keys.workoutFeedback);
    removeRaw(keys.weeklyCheckins);
    removeRaw(keys.adjustmentHistory);
    removeRaw(keys.userProfile);
    removeRaw(keys.plan);
    removeRaw(keys.adopted);
    return true;
  }

  function getUserSnapshot() {
    return {
      schemaVersion: SCHEMA_VERSION,
      app: 'RUINNA',
      exportedAt: new Date().toISOString(),
      user: getCurrentUser(),
      isAdopted: isPlanAdopted(),
      plan: loadPlan(),
      completedWorkouts: loadCompletedWorkouts(),
      customizations: loadCustomizations(),
      workoutFeedback: loadWorkoutFeedback(),
      weeklyCheckins: loadWeeklyCheckins(),
      adjustmentHistory: loadAdjustmentHistory(),
      userProfile: loadUserProfile(),
      onboardingSeen: hasSeenOnboardingTour()
    };
  }

  function getUserStorageSummary() {
    const snapshot = getUserSnapshot();
    const planWeeks = Array.isArray(snapshot.plan?.weeks) ? snapshot.plan.weeks.length : 0;
    const planWorkouts = Array.isArray(snapshot.plan?.weeks)
      ? snapshot.plan.weeks.reduce((sum, week) => sum + (Array.isArray(week.workouts) ? week.workouts.length : 0), 0)
      : 0;

    return {
      user: snapshot.user,
      hasPlan: Boolean(snapshot.plan),
      isAdopted: snapshot.isAdopted,
      planWeeks,
      planWorkouts,
      completedCount: Object.keys(snapshot.completedWorkouts || {}).filter(key => snapshot.completedWorkouts[key]).length,
      feedbackCount: Object.keys(snapshot.workoutFeedback || {}).length,
      checkinCount: Object.keys(snapshot.weeklyCheckins || {}).length,
      adjustmentCount: Array.isArray(snapshot.adjustmentHistory) ? snapshot.adjustmentHistory.length : 0
    };
  }

  function applyUserSnapshot(payload = {}) {
    if (payload.plan) savePlan(payload.plan);
    setPlanAdopted(payload.isAdopted !== false && Boolean(payload.plan));
    saveCompletedWorkouts(payload.completedWorkouts || {});
    saveCustomizations(payload.customizations || {});
    saveWorkoutFeedback(payload.workoutFeedback || {});
    saveWeeklyCheckins(payload.weeklyCheckins || {});
    saveAdjustmentHistory(payload.adjustmentHistory || []);
    saveUserProfile(payload.userProfile || {});
    if (payload.onboardingSeen) setOnboardingTourSeen(true);
    return true;
  }

  return {
    version: SCHEMA_VERSION,
    keys: getKeys,
    userKey,
    getCurrentUser,
    isLoggedIn,
    login,
    logout,
    hasSeenOnboardingTour,
    setOnboardingTourSeen,
    getJSON,
    setJSON,
    getRaw,
    setRaw,
    removeRaw,
    loadUserProfile,
    saveUserProfile,
    loadCompletedWorkouts,
    saveCompletedWorkouts,
    loadCustomizations,
    saveCustomizations,
    loadWorkoutFeedback,
    saveWorkoutFeedback,
    loadWeeklyCheckins,
    saveWeeklyCheckins,
    loadAdjustmentHistory,
    saveAdjustmentHistory,
    loadPlan,
    savePlan,
    clearPlan,
    isPlanAdopted,
    setPlanAdopted,
    clearAdaptiveData,
    clearCurrentUserData,
    getUserSnapshot,
    getUserStorageSummary,
    applyUserSnapshot
  };
})();
