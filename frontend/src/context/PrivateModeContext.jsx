import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const PrivateModeContext = createContext({ privateMode: false, loading: true });

export function PrivateModeProvider({ children }) {
  const [privateMode, setPrivateMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    api.get('/config')
      .then(({ data }) => {
        if (active) setPrivateMode(Boolean(data.privateMode));
      })
      .catch(() => {
        // Backend enforcement is authoritative; the UI simply falls back to
        // its normal copy if the mode flag cannot be fetched.
        if (active) setPrivateMode(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <PrivateModeContext.Provider value={{ privateMode, loading }}>
      {children}
    </PrivateModeContext.Provider>
  );
}

export const usePrivateMode = () => useContext(PrivateModeContext);
