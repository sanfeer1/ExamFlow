import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { API_BASE_URL } from '../config';

const DEMO_ACCOUNTS = [
  {
    role: 'student',
    name: 'Demo Student',
    badge: 'Student',
    email: 'student@examflow.com',
    password: 'student123',
    desc: 'Take exams & view results',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    )
  },
  {
    role: 'admin',
    name: 'Demo Admin',
    badge: 'Admin',
    email: 'admin@examflow.com',
    password: 'admin123',
    desc: 'Manage exams & questions',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    )
  }
];

const Login = ({ setUser }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState(null);
  const navigate = useNavigate();

  const executeLogin = async (idToUse, pwToUse, demoRole = null) => {
    setLoading(true);
    setActiveDemo(demoRole);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: idToUse, password: pwToUse })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sign in.');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
      setActiveDemo(null);
    }
  };

  const handleManualLogin = (e) => {
    e.preventDefault();
    executeLogin(identifier, password, null);
  };

  const handleDemoLogin = (account) => {
    if (loading) return;
    setIdentifier(account.email);
    setPassword(account.password);
    executeLogin(account.email, account.password, account.role);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card animate-fade-in">
        {/* Logo */}
        <div className="auth-logo">
          <Logo size={40} />
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
            Exam<span style={{ color: 'var(--text-primary)' }}>Flow</span>
          </span>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account or try a 1-click demo</p>

        {error && (
          <div className="alert error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleManualLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="identifier">Email or Username</label>
            <input
              id="identifier"
              type="text"
              placeholder="you@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              style={{ marginBottom: 0 }}
            />
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ marginBottom: 0, paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', padding: '4px', color: 'var(--text-muted)',
                  cursor: 'pointer', boxShadow: 'none', fontSize: '0.8rem'
                }}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-full btn-lg"
            disabled={loading}
            style={{ marginTop: '20px' }}
          >
            {loading && !activeDemo ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Signing in...
              </>
            ) : 'Sign In'}
          </button>
        </form>

        {/* 1-Click Demo Accounts Section */}
        <div className="demo-section">
          <div className="auth-divider">
            <span>or 1-click demo access</span>
          </div>

          <div className="demo-grid">
            {DEMO_ACCOUNTS.map((demo) => {
              const isCurrentLoading = loading && activeDemo === demo.role;
              return (
                <div
                  key={demo.role}
                  className={`demo-card ${demo.role} ${isCurrentLoading ? 'loading' : ''}`}
                  onClick={() => handleDemoLogin(demo)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleDemoLogin(demo);
                    }
                  }}
                  title={`Click to log in immediately as ${demo.name}`}
                >
                  <div className="demo-card-top">
                    <div className="demo-icon">
                      {demo.icon}
                    </div>
                    <span className="demo-role-tag">{demo.badge}</span>
                  </div>

                  <div className="demo-name">{demo.name}</div>
                  <div className="demo-meta" title={`${demo.email} • ${demo.password}`}>
                    {demo.email}
                  </div>

                  <button
                    type="button"
                    className="demo-btn"
                    disabled={loading}
                    tabIndex={-1}
                  >
                    {isCurrentLoading ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        Logging in...
                      </>
                    ) : (
                      <>
                        <span>1-Click Login</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register" style={{ fontWeight: 600 }}>Create one free</Link>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Login;

