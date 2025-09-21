import fetch from 'node-fetch';

export async function getProfile() {
  try {
    // İlk sorğu: client_key almaq üçün
    const res = await fetch('https://umicobot.com/api/current-user-for-extension');
    const raw = await res.json();

    // Token-i client_key içindən çıxar
    const parsedKey = JSON.parse(raw.client_key);
    const token = parsedKey.client_token;

    // İkinci sorğu: artıq çıxarılmış token ilə
    const res2 = await fetch('https://umicobot.com/api/current-user-for-extension', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res2.ok) {
      throw new Error(`HTTP status ${res2.status}`);
    }

    const data = await res2.json();
    console.log('Profil məlumatı:', data);
    return data;
  } catch (error) {
    console.error('Profil sorğusunda xəta:', error.message);
    return { success: false, error: error.message };
  }
}
