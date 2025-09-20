import fetch from 'node-fetch';
import { UMIKO_TOKEN } from './config.js';

export async function getProfile() {
  const res = await fetch('https://umicobot.com/api/current-user-for-extension', {
    headers: {
      'Authorization': `Bearer ${UMIKO_TOKEN}`
    }
  });
  const data = await res.json();
  console.log('Profil məlumatı:', data);
  return data;
}
