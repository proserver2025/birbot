import fetch from 'node-fetch';

export async function getProfile() {
  try {
    const res = await fetch('https://umicobot.com/api/current-user-for-extension');
    const raw = await res.json();

    // client_key mövcuddursa və stringdirsə parse et
    if (raw.client_key && typeof raw.client_key === 'string') {
      let parsedKey;
      try {
        parsedKey = JSON.parse(raw.client_key);
      } catch (parseError) {
        throw new Error('client_key JSON formatında deyil');
      }

      const token = parsedKey.client_token;

      const res2 = await fetch('https://umicobot.com/api/current-user-for-extension', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res2.ok) {
        throw new Error(`İkinci sorğuda HTTP status ${res2.status}`);
      }

      const data = await res2.json();
      console.log('Profil məlumatı:', data);
      return data;
    } else {
      throw new Error('client_key mövcud deyil və ya string deyil');
    }
  } catch (error) {
    console.error('Profil sorğusunda xəta:', error.message);
    return { success: false, error: error.message };
  }
}
