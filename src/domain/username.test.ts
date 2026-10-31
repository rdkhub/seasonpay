import { describe, expect, it } from 'vitest';
import { normalizeUsername, passwordOk, usernameFromEmail, usernameProblem, usernameToEmail } from './username';

describe('username', () => {
  it('normaliza mayúsculas, espacios y @', () => {
    expect(normalizeUsername('  @Rodri.Gomez ')).toBe('rodri.gomez');
  });

  it('valida largo y caracteres', () => {
    expect(usernameProblem('ro')).toBe('short');
    expect(usernameProblem('a'.repeat(21))).toBe('long');
    expect(usernameProblem('rodri gomez')).toBe('chars');
    expect(usernameProblem('.rodri')).toBe('chars');
    expect(usernameProblem('rodri.')).toBe('chars');
    expect(usernameProblem('rod..ri')).toBe('chars');
    expect(usernameProblem('ñandu')).toBe('chars');
    expect(usernameProblem('rodri_99')).toBeNull();
    expect(usernameProblem('rod.gomez')).toBeNull();
  });

  it('contraseña de 8 a 72', () => {
    expect(passwordOk('1234567')).toBe(false);
    expect(passwordOk('12345678')).toBe(true);
    expect(passwordOk('x'.repeat(73))).toBe(false);
  });

  it('ida y vuelta usuario ↔ correo interno', () => {
    expect(usernameFromEmail(usernameToEmail('rodri_99'))).toBe('rodri_99');
    expect(usernameFromEmail('rod@gmail.com')).toBeNull();
    expect(usernameFromEmail(null)).toBeNull();
  });
});
