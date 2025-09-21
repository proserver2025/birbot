import fetch from 'node-fetch';
import { UMIKO_TOKEN } from './config.js';

export async function getProfile() {
  try {
    const res = await fetch('https://umicobot.com/api/widget/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${UMIKO_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://umico.az/',
        'Origin': 'https://umico.az'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }

    const data = await res.json();
    console.log('Profil məlumatı:', data);
    return data;
  } catch (error) {
    console.error('Profil sorğusunda xəta:', error.message);
    return { success: false, error: error.message };
  }
}
