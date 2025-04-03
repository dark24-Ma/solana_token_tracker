/**
 * Utilitaire pour jouer des sons de notification
 */

// Contexte audio pour générer des sons
let audioContext = null;

/**
 * Initialise le contexte audio si nécessaire
 */
const initAudioContext = () => {
  if (!audioContext) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContext();
    } catch (e) {
      console.error('AudioContext non supporté dans ce navigateur:', e);
      return false;
    }
  }
  return true;
};

/**
 * Joue un son de notification
 * @param {string} type - Type de son ('success', 'info', 'warning', 'error')
 */
export const playNotificationSound = (type = 'success') => {
  if (!initAudioContext()) return;
  
  try {
    // Paramètres du son selon le type
    let frequency, attackTime, decayTime, sustainLevel, releaseTime;
    
    switch (type) {
      case 'success':
        frequency = 880; // La (A5)
        attackTime = 0.02;
        decayTime = 0.1;
        sustainLevel = 0.3;
        releaseTime = 0.3;
        break;
      case 'info':
        frequency = 659.25; // Mi (E5)
        attackTime = 0.05;
        decayTime = 0.1;
        sustainLevel = 0.5;
        releaseTime = 0.2;
        break;
      case 'warning':
        frequency = 440; // La (A4)
        attackTime = 0.01;
        decayTime = 0.05;
        sustainLevel = 0.8;
        releaseTime = 0.5;
        break;
      case 'error':
        frequency = 220; // La (A3)
        attackTime = 0.01;
        decayTime = 0.05;
        sustainLevel = 0.9;
        releaseTime = 0.5;
        break;
      default:
        frequency = 523.25; // Do (C5)
        attackTime = 0.05;
        decayTime = 0.1;
        sustainLevel = 0.6;
        releaseTime = 0.2;
    }
    
    // Créer un oscillateur
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine'; // Type de son (sine, square, sawtooth, triangle)
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
    // Créer un gain pour contrôler le volume
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.7, audioContext.currentTime + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, audioContext.currentTime + attackTime + decayTime);
    gainNode.gain.setValueAtTime(sustainLevel, audioContext.currentTime + attackTime + decayTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + attackTime + decayTime + 0.1 + releaseTime);
    
    // Connecter l'oscillateur au gain et le gain à la sortie audio
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Démarrer et arrêter l'oscillateur
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + attackTime + decayTime + 0.1 + releaseTime + 0.1);
    
    // Pour les appareils mobiles, il peut être nécessaire de reprendre le contexte audio
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
  } catch (err) {
    console.error('Erreur lors de la lecture du son de notification:', err);
  }
};

/**
 * Joue un son de notification pour un nouveau token
 */
export const playNewTokenSound = () => {
  // Créer une séquence de deux notes pour les nouveaux tokens
  if (!initAudioContext()) return;
  
  try {
    setTimeout(() => playNotificationSound('success'), 0);
    setTimeout(() => playNotificationSound('info'), 150);
  } catch (err) {
    console.error('Erreur lors de la lecture du son de nouveau token:', err);
  }
};

export default {
  playNotificationSound,
  playNewTokenSound
}; 