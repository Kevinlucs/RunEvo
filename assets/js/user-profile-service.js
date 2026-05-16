// ===== USER PROFILE SERVICE =====
// Camada simples para gerenciar os 5 usuários do MVP fechado.
// A autenticação ainda é local/front-end. Para produção pública, migrar para Supabase/Auth.

const UserProfileService = (() => {
  function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
  }

  function getConfiguredUsers() {
    const profiles = (typeof CONFIG !== 'undefined' && CONFIG.USER_PROFILES) ? CONFIG.USER_PROFILES : null;
    const allowed = (typeof CONFIG !== 'undefined' && CONFIG.ALLOWED_USERS) ? CONFIG.ALLOWED_USERS : {};

    if (profiles && Object.keys(profiles).length) {
      return profiles;
    }

    return Object.keys(allowed).reduce((acc, username) => {
      acc[username] = {
        password: allowed[username],
        displayName: username.charAt(0).toUpperCase() + username.slice(1),
        role: username === 'kevin' ? 'admin' : 'runner',
        goal: '',
        avatar: username.charAt(0).toUpperCase()
      };
      return acc;
    }, {});
  }

  function getProfile(username) {
    const user = normalizeUsername(username);
    const users = getConfiguredUsers();
    const profile = users[user];

    if (!profile) return null;

    const localProfile = (typeof StorageService !== 'undefined' && StorageService.getCurrentUser?.() === user)
      ? StorageService.loadUserProfile?.() || {}
      : {};

    const displayName = localProfile.displayName || profile.displayName || user;

    return {
      username: user,
      displayName,
      role: profile.role || 'runner',
      goal: profile.goal || '',
      avatar: localProfile.avatar || profile.avatar || String(displayName || user).charAt(0).toUpperCase(),
      photo: localProfile.photo || '',
      age: localProfile.age || '',
      height: localProfile.height || '',
      weight: localProfile.weight || '',
      team: profile.team || 'RunEvo',
      notes: profile.notes || '',
      localProfile
    };
  }

  function getCurrentProfile() {
    if (typeof StorageService === 'undefined') return null;
    return getProfile(StorageService.getCurrentUser());
  }

  function validateCredentials(username, password) {
    const user = normalizeUsername(username);
    const users = getConfiguredUsers();
    const profile = users[user];

    if (!profile) return false;

    const expected = typeof profile === 'string' ? profile : profile.password;

    return String(expected || '') === String(password || '');
  }

  function getDisplayName(username) {
    return getProfile(username)?.displayName || normalizeUsername(username) || 'Atleta';
  }

  function getRoleLabel(role) {
    const labels = {
      admin: 'Administrador',
      runner: 'Atleta',
      coach: 'Coach'
    };

    return labels[role] || 'Atleta';
  }

  return {
    normalizeUsername,
    getConfiguredUsers,
    getProfile,
    getCurrentProfile,
    validateCredentials,
    getDisplayName,
    getRoleLabel
  };
})();
