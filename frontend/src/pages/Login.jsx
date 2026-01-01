import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

function Login() {
  const { isAuthenticated, loading, login } = useUser();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to SayIt OwnIt
          </h1>
          <p className="text-gray-600">
            Track stock recommendations from TV experts
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="text-green-500">✓</span>
            Follow your favorite experts
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="text-green-500">✓</span>
            Create stock watchlists
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="text-green-500">✓</span>
            Get alerts on new recommendations
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="text-green-500">✓</span>
            Personalized dashboard
          </div>
        </div>

        {/* Google Sign In Button */}
        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        >
          {/* Google Logo */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-gray-700 font-medium">Sign in with Google</span>
        </button>

        {/* Terms */}
        <p className="text-xs text-gray-500 text-center mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>

        {/* Tier Info */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-semibold text-gray-900">Free</div>
              <ul className="text-xs text-gray-500 mt-1 space-y-1">
                <li>5 expert follows</li>
                <li>1 watchlist</li>
              </ul>
            </div>
            <div className="bg-primary-50 rounded-lg p-3 border border-primary-200">
              <div className="font-semibold text-primary-700">Pro (Beta)</div>
              <ul className="text-xs text-primary-600 mt-1 space-y-1">
                <li>Unlimited follows</li>
                <li>Unlimited watchlists</li>
              </ul>
              <div className="text-xs text-primary-500 mt-1">Free during beta!</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
