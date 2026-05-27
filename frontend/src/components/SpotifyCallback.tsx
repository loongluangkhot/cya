import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CenterMessage } from './Screens';
import { handleSpotifyCallback } from '../spotifyAuth';

export default function SpotifyCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const errParam = params.get('error');
    const code = params.get('code');

    if (errParam) {
      setError(`spotify rejected the login: ${errParam}`);
      return;
    }
    if (!code) {
      setError('missing auth code in callback');
      return;
    }

    handleSpotifyCallback(code).then((res) => {
      if (res.ok) {
        // The membership marker (set when the user originally entered the
        // room) survives the OAuth round-trip, so RoomEntry will land them
        // straight back in the room.
        navigate(res.returnTo, { replace: true });
      } else {
        setError(res.error);
      }
    });
  }, [params, navigate]);

  if (error) {
    return (
      <div className="cya-app">
        <CenterMessage title="couldn't connect spotify">
          <div className="body-text" style={{ marginBottom: 16 }}>{error}</div>
          <button type="button" className="btn" onClick={() => navigate('/', { replace: true })}>
            back home
          </button>
        </CenterMessage>
      </div>
    );
  }

  return (
    <div className="cya-app">
      <CenterMessage title="connecting spotify…" />
    </div>
  );
}
