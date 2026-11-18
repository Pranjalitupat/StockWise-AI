import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api/axios.js';

// Runs `loader` whenever `deps` change; ignores out-of-date responses.
export default function useFetch(loader, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const counter = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const id = ++counter.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await loader();
      if (id === counter.current) setState({ data, loading: false, error: '' });
    } catch (err) {
      if (id === counter.current) setState((s) => ({ ...s, loading: false, error: getErrorMessage(err) }));
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
