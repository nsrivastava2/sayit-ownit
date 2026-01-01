import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, loading, logout } = useAuth();

  // Public nav items (always visible)
  const publicNavItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/recommendations', label: 'Recommendations', icon: '📋' },
    { path: '/leaderboard', label: 'Leaderboard', icon: '🏆' }
  ];

  // Admin nav items (only visible when authenticated)
  const adminNavItems = [
    { path: '/add', label: 'Add Video', icon: '➕' },
    { path: '/admin/recommendations', label: 'Review', icon: '🚩' },
    { path: '/admin/experts', label: 'Experts', icon: '👤' },
    { path: '/admin/channels', label: 'Channels', icon: '📺' }
  ];

  const isActive = (path) => location.pathname === path;

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl">📈</span>
              <span className="text-xl font-bold text-gray-900">SayIt OwnIt</span>
            </Link>

            <nav className="flex items-center space-x-1">
              {/* Public Navigation */}
              {publicNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-1">{item.icon}</span>
                  {item.label}
                </Link>
              ))}

              {/* Admin Section (only visible when authenticated) */}
              {!loading && isAuthenticated && (
                <>
                  {/* Divider */}
                  <span className="border-l border-gray-300 mx-2 h-6"></span>

                  {/* Admin Navigation */}
                  {adminNavItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.path)
                          ? 'bg-amber-100 text-amber-700'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <span className="mr-1">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    data-testid="logout-button"
                    className="ml-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    🚪 Logout
                  </button>
                </>
              )}

              {/* Login Link (only visible when NOT authenticated) */}
              {!loading && !isAuthenticated && (
                <>
                  <span className="border-l border-gray-300 mx-2 h-6"></span>
                  <Link
                    to="/admin/login"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive('/admin/login')
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    🔐 Admin
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-gray-500 text-sm">
            Stock Market TV Recommendation Tracker - Extracting insights from Indian financial TV
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
