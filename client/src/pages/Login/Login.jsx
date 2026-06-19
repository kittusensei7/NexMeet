import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './Login.css';

/**
 * Login Component
 * Redesigned to support a modern split-pane look with glassmorphic cards.
 */
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();



  const handleValidation = () => {
    const tempErrors = {};
    if (!email) {
      tempErrors.email = 'Enter an email';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = 'Enter a valid email address';
    }
    if (!password) {
      tempErrors.password = 'Enter a password';
    } else if (password.length < 6) {
      tempErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!handleValidation()) return;

    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { token, user } = response.data;
      
      // Store in AuthContext (which uses sessionStorage now)
      login(user, token);
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Cannot connect to NexMeet. Verify connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container-page">
      {/* LEFT SIDE (55%): ILLUSTRATION & FEATURES */}
      <div className="login-hero-side">
        <div className="login-hero-content">
          <div className="hero-logo-row">
            <span className="material-icons-round hero-logo-icon">videocam</span>
            <span className="hero-logo-text">NexMeet</span>
          </div>
          
          <h1 className="hero-title">Professional video meetings for everyone</h1>
          <p className="hero-tagline">
            Connect, collaborate, and celebrate securely from anywhere with HD video.
          </p>

          <div className="hero-feature-pills">
            <div className="feature-pill">
              <span className="material-icons-round">lock</span>
              <span>Encrypted</span>
            </div>
            <div className="feature-pill">
              <span className="material-icons-round">hd</span>
              <span>HD Video</span>
            </div>
            <div className="feature-pill">
              <span className="material-icons-round">chat</span>
              <span>Live Chat</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE (45%): FROSTED GLASS LOGIN CARD */}
      <div className="login-form-side">
        <div className="glass-card login-card-frosted">
          <div className="card-header-branding">
            <span className="material-icons-round branding-logo">videocam</span>
            <span className="branding-title">NexMeet</span>
          </div>

          <div className="card-title-block">
            <h2>Sign in</h2>
            <p>Welcome back</p>
          </div>

          {errorMessage && (
            <div className="login-error-toast">
              <span className="material-icons-round">error_outline</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate autoComplete="off" className="login-form-inputs">
            {/* Email Field */}
            <div className="input-wrapper">
              <span className="material-icons-round input-icon">email</span>
              <input
                type="email"
                id="email"
                name="email"
                className={`input-field ${errors.email ? 'input-error' : ''}`}
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="new-email"
              />
              {errors.email && <span className="field-error-msg">{errors.email}</span>}
            </div>

            {/* Password Field */}
            <div className="input-wrapper">
              <span className="material-icons-round input-icon">lock</span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                className={`input-field ${errors.password ? 'input-error' : ''}`}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle-eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-icons-round">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
              {errors.password && <span className="field-error-msg">{errors.password}</span>}
            </div>

            {/* Form Actions */}
            <div className="login-action-buttons">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="auth-switch-link">
                Don't have an account? <Link to="/register">Register here</Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
