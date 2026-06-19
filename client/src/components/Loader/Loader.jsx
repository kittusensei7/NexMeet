import './Loader.css';

/**
 * Reusable Loader Component
 * Displays a centered rotating spinner with a customizable message.
 */
const Loader = ({ message = 'Loading...' }) => {
  return (
    <div className="loader-container" id="nexmeet-loader">
      <div className="loader-spinner"></div>
      {message && <p className="loader-message">{message}</p>}
    </div>
  );
};

export default Loader;
