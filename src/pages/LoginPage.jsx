import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Lock, 
  User, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight, 
  KeyRound, 
  Radio, 
  Eye, 
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Polar@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [demoUsers, setDemoUsers] = useState([]);

  useEffect(() => {
    // Load demo users for one-click development testing
    api.getDemoUsers().then(users => {
      if (users && users.length > 0) {
        setDemoUsers(users);
      }
    });
  }, []);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.login(username.trim(), password);
      if (res && res.user) {
        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        }
      }
    } catch (err) {
      console.error('[POLAR-X Auth] Login error:', err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoUser) => {
    setUsername(demoUser.username);
    setPassword('Polar@2026');
    setError(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(14, 165, 233, 0.12) 0%, rgba(8, 13, 26, 0.95) 70%, #040814 100%)',
        position: 'relative',
        padding: '24px',
        overflow: 'hidden'
      }}
    >
      {/* Background Grid Pattern */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Main Login Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.15)',
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          zIndex: 1,
          position: 'relative'
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.08))',
              border: '1px solid var(--cyan-400)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cyan-300)',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.35)'
            }}
          >
            <Compass size={30} className="radar-sweep-icon" />
          </div>

          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: '900',
                letterSpacing: '2px',
                color: '#fff',
                background: 'linear-gradient(90deg, #ffffff, var(--cyan-300))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0
              }}
            >
              POLAR-X COMMAND
            </h1>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '600',
                letterSpacing: '1px',
                color: 'var(--cyan-400)',
                fontFamily: 'var(--font-mono)',
                marginTop: '4px'
              }}
            >
              MoES • NCPOR POLAR LOGISTICS & ASSET SYSTEM
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid var(--hazard-red-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--hazard-red)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Username Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Username or Operator Call-Sign
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="search-input"
                style={{ width: '100%', paddingLeft: '38px', height: '42px', fontSize: '13px' }}
                placeholder="e.g. admin, director, sar"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Secure Access Passcode
              </label>
              <span style={{ fontSize: '10.5px', color: 'var(--cyan-400)', fontFamily: 'var(--font-mono)' }}>
                AES/PBKDF2 Secured
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="search-input"
                style={{ width: '100%', paddingLeft: '38px', paddingRight: '38px', height: '42px', fontSize: '13px' }}
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              height: '44px',
              fontSize: '13.5px',
              fontWeight: '700',
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? (
              <span>Authenticating Session...</span>
            ) : (
              <>
                <span>Sign In to Polar Command</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Access Switcher */}
        {demoUsers.length > 0 && (
          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Quick Demo Role Switcher
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Pass: <code style={{ color: 'var(--cyan-300)' }}>Polar@2026</code>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {demoUsers.map((u) => {
                const isSelected = username === u.username;
                return (
                  <button
                    key={u.username}
                    type="button"
                    onClick={() => handleQuickFill(u)}
                    style={{
                      padding: '6px 8px',
                      background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isSelected ? 'var(--cyan-400)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-sm)',
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      fontSize: '10.5px',
                      fontWeight: isSelected ? '700' : '500',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all var(--transition-fast)'
                    }}
                    title={`${u.full_name} (${u.role_description})`}
                  >
                    <div>{u.role.replace('_', ' ')}</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--cyan-400)', fontFamily: 'var(--font-mono)' }}>@{u.username}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Security Footer */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '10.5px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <ShieldCheck size={13} style={{ color: 'var(--hazard-green)' }} />
          <span>Role-Based Access Control Active • 256-Bit TLS Protected</span>
        </div>
      </div>
    </div>
  );
}
