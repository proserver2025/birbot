import fetch from 'node-fetch';
import { UMIKO_TOKEN } from './config.js';

export async function getProfile() {
  try {
    // İlk sorğu: client_key almaq üçün
    const res = await fetch('https://umicobot.com/api/current-user-for-extension', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${UMIKO_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const raw = await res.json();

    if (raw.client_key && typeof raw.client_key === 'string') {
      const parsedKey = JSON.parse(raw.client_key);
      const token = parsedKey.client_token;

      // İkinci sorğu: çıxarılmış token ilə
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
