import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { getItem, setItem } from '../utils/safeStorage';
import { signInWithCustomToken, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../sync/firebase';
import { OWNER_ADMIN_EMAIL, usernameToAuthEmail } from './credentials';
import { syncAuthenticatedUser } from './firebaseSession';

export default function LoginPage() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [username, setUsername] = useState(getItem('local', 'jann-pos-username') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(getItem('local', 'jann-pos-remember') === 'true');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (currentUser) {
      navigate(currentUser.role === 'admin' ? '/dashboard' : '/pos');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, usernameToAuthEmail(username), password);
      const user = await syncAuthenticatedUser(credential.user);
      setItem('local', 'jann-pos-remember', rememberMe ? 'true' : 'false');
      setItem('local', 'jann-pos-username', rememberMe ? username : '');
      navigate(user.role === 'admin' ? '/dashboard' : '/pos');
    } catch (error) {
      if (auth.currentUser) {
        await signOut(auth).catch((signOutError: unknown) => console.error('Could not clear a failed sign-in.', signOutError));
      }
      const message = error instanceof Error ? error.message : 'Sign in failed.';
      toast.error(message.includes('auth/invalid-credential') || message.includes('auth/user-not-found') ? 'Incorrect name or password' : message);
    } finally {
      setBusy(false);
    }
  };

  const handleBootstrap = async () => {
    setBusy(true);
    try {
      const response = await fetch('/.netlify/functions/bootstrap-admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (response.status === 404) {
        throw new Error('Admin setup is not deployed. Deploy the project from its repository with Netlify Functions enabled; uploading only the dist folder does not deploy this setup service.');
      }
      const result: { customToken?: string; error?: string } = response.headers.get('content-type')?.includes('application/json')
        ? await response.json() as { customToken?: string; error?: string }
        : {};
      if (!response.ok || !result.customToken) throw new Error(result.error || 'Initial admin setup failed.');
      const credential = await signInWithCustomToken(auth, result.customToken);
      await syncAuthenticatedUser(credential.user);
      navigate('/dashboard');
    } catch (error) {
      if (auth.currentUser) {
        await signOut(auth).catch((signOutError: unknown) => console.error('Could not clear a failed admin setup session.', signOutError));
      }
      toast.error(error instanceof Error ? error.message : 'Initial admin setup failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="card login-card" style={{ width: 'min(420px, 100%)' }}>
        <h1>Super POS Investment Login</h1>
        <p style={{ color: '#9ca3af' }}>Sign in to continue</p>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <label className="form-field">
            <span>Email or name created by the admin</span>
            <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Admin email or staff name" required />
          </label>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            Remember me
          </label>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
          {username.trim().toLowerCase() !== OWNER_ADMIN_EMAIL && (
            <button className="btn secondary" type="button" onClick={() => void handleBootstrap()} disabled={busy}>Set up initial admin</button>
          )}
        </form>
        <p style={{ color: '#6b7280', fontSize: 12, marginTop: 12 }}>The project owner signs in with the Firebase account email and password. Staff sign in with the names and passwords created by the admin.</p>
      </div>
    </div>
  );
}
