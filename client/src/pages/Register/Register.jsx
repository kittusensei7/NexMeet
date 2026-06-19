import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import './Register.css';

/**
 * Register Component
 * Redesigned to match the glassmorphic split design.
 */
const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const navigate = useNavigate();



  const getPasswordStrength = () => {
    if (!password) return '';
    let strength = 'weak';
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /\W/.test(password);
    const hasUpper = /[A-Z]/.test(password);

    if (password.length >= 6) {
      if (hasNumbers || hasSpecial) {
        strength = 'medium';
      }
      if (password.length >= 8 && hasNumbers && hasSpecial && hasUpper) {
        strength = 'strong';
      }
    }
    return strength;
  };

  const passwordStrength = getPasswordStrength();

  const handleValidation = () => {
    const tempErrors = {};
    if (!username.trim()) {
      tempErrors.username = 'Enter your name';
    }
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
    if (!confirmPassword) {
      tempErrors.confirmPassword = 'Confirm your password';
    } else if (confirmPassword !== password) {
      tempErrors.confirmPassword = 'Passwords do not match';
    }
    if (!agreeTerms) {
      tempErrors.agreeTerms = 'Accept Terms & Conditions to proceed';
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    
    if (!handleValidation()) return;

    setLoading(true);
    try {
      const response = await api.post('/api/auth/register', {
        username,
        email,
        password
      });

      setSuccessMessage(response.data.message || 'Account created! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (error) {
      console.error('Registration error:', error);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to create account. Check your network.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container-page">
      {/* LEFT SIDE (55%): ILLUSTRATION & FEATURES */}
      <div className="register-hero-side">
        <div className="register-hero-content">
          <div className="hero-logo-row">
            <span className="material-icons-round hero-logo-icon">videocam</span>
            <span className="hero-logo-text">NexMeet</span>
          </div>
          
          <h1 className="hero-title">Start free high-quality video calls today</h1>
          <p className="hero-tagline">
            Host meetings with up to 100 participants, send chat messages, and share screens effortlessly.
          </p>

          <div className="hero-feature-pills">
            <div className="feature-pill">
              <span className="material-icons-round">lock</span>
              <span>Secure Rooms</span>
            </div>
            <div className="feature-pill">
              <span className="material-icons-round">wifi</span>
              <span>Low Latency</span>
            </div>
            <div className="feature-pill">
              <span className="material-icons-round">group</span>
              <span>Multi-peer Mesh</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE (45%): FROSTED GLASS REGISTER CARD */}
      <div className="register-form-side">
        <div className="glass-card register-card-frosted">
          <div className="card-header-branding">
            <span className="material-icons-round branding-logo">videocam</span>
            <span className="branding-title">NexMeet</span>
          </div>

          <div className="card-title-block">
            <h2>Create Account</h2>
            <p>Join NexMeet for free</p>
          </div>

          {errorMessage && (
            <div className="register-error-toast">
              <span className="material-icons-round">error_outline</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="register-success-toast">
              <span className="material-icons-round">check_circle_outline</span>
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate autoComplete="off" className="register-form-inputs">
            {/* Full Name */}
            <div className="input-wrapper">
              <span className="material-icons-round input-icon">person</span>
              <input
                type="text"
                id="username"
                name="username"
                className={`input-field ${errors.username ? 'input-error' : ''}`}
                placeholder="Full name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="new-username"
              />
              {errors.username && <span className="field-error-msg">{errors.username}</span>}
            </div>

            {/* Email Address */}
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

            {/* Password */}
            <div className="input-wrapper">
              <span className="material-icons-round input-icon">lock</span>
              <input
                type="password"
                id="password"
                name="password"
                className={`input-field ${errors.password ? 'input-error' : ''}`}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
              {password && (
                <div className="password-strength-indicator">
                  <span className="strength-label">Strength: {passwordStrength}</span>
                  <div className={`strength-meter strength-${passwordStrength}`}>
                    <div className="strength-meter-bar"></div>
                  </div>
                </div>
              )}
              {errors.password && <span className="field-error-msg">{errors.password}</span>}
            </div>

            {/* Confirm Password */}
            <div className="input-wrapper">
              <span className="material-icons-round input-icon">lock</span>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                className={`input-field ${errors.confirmPassword ? 'input-error' : ''}`}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
              {errors.confirmPassword && <span className="field-error-msg">{errors.confirmPassword}</span>}
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="terms-checkbox-container">
              <label className="checkbox-label-wrapper">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  disabled={loading}
                  className="native-checkbox-hidden"
                />
                <span className="checkbox-indicator-custom"></span>
                <span className="checkbox-label-text">I agree to the Terms & Conditions</span>
              </label>
              {errors.agreeTerms && <span className="field-error-msg">{errors.agreeTerms}</span>}
            </div>

            {/* Actions */}
            <div className="register-action-buttons">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Register'}
              </button>

              <div className="auth-switch-link">
                Already have an account? <Link to="/login">Sign in here</Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
