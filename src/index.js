import { getProfile } from './profile.js';

(async () => {
  const profile = await getProfile();
  console.log('Profil:', profile);
})();
