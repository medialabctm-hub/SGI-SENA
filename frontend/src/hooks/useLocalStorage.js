import { useState, useEffect } from 'react';

export const useLocalStorage = (key, initialValue = null) => {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      setValue(item ? JSON.parse(item) : initialValue);
    } catch {
      setValue(initialValue);
    }
  }, [key, initialValue]);

  return [value, setValue];
};

export const useCurrentUser = () => {
  return useLocalStorage('user', null);
};

export const useAuthToken = () => {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('token');
    } catch {
      return null;
    }
  });

  return [token, setToken];
};

