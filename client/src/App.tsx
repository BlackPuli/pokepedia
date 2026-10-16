import { useState } from 'react';
import type { User } from './api.ts';
import { Login } from './Login.tsx';
import { Pokedex } from './Pokedex.tsx';

const STORAGE_KEY = 'pokedex-user';

function loadUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function App() {
  const [user, setUser] = useState(loadUser);

  function login(u: User) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  return user ? <Pokedex user={user} onLogout={logout} /> : <Login onLogin={login} />;
}
