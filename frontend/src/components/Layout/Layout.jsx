import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';

function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated: isAdminAuth, loading: adminLoading, logout: adminLogout } = useAuth();
  const { user, isAuthenticated: isUserAuth, loading: userLoading, logout: userLogout } = useUser();

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

  async function handleAdminLogout() {
    await adminLogout();
    navigate('/');
  }

  async function handleUserLogout() {
    await userLogout();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <img src="/logo-full.svg" alt="SayIt OwnIt" className="h-12" />
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

              {/* User Section */}
              <span className="border-l border-gray-300 mx-2 h-6"></span>

              {!userLoading && isUserAuth ? (
                <>
                  <Link
                    to="/dashboard"
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive('/dashboard')
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {user?.profilePicture ? (
                      <img src={user.profilePicture} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <span className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-xs font-bold">
                        {user?.fullName?.charAt(0) || '?'}
                      </span>
                    )}
                    <span className="hidden md:inline">{user?.fullName?.split(' ')[0]}</span>
                  </Link>
                  <button
                    onClick={handleUserLogout}
                    className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100"
                    title="Logout"
                  >
                    Logout
                  </button>
                </>
              ) : !userLoading ? (
                <Link
                  to="/login"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/login')
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Sign In
                </Link>
              ) : null}

              {/* Admin Section (only visible when admin authenticated) */}
              {!adminLoading && isAdminAuth && (
                <>
                  <span className="border-l border-gray-300 mx-2 h-6"></span>

                  {/* Admin Navigation */}
                  {adminNavItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.path)
                          ? 'bg-amber-100 text-amber-700'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <span className="mr-1">{item.icon}</span>
                      <span className="hidden lg:inline">{item.label}</span>
                    </Link>
                  ))}

                  <button
                    onClick={handleAdminLogout}
                    data-testid="logout-button"
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                    title="Admin Logout"
                  >
                    🚪
                  </button>
                </>
              )}

              {/* Admin Login Link (only visible when NOT admin authenticated) */}
              {!adminLoading && !isAdminAuth && (
                <Link
                  to="/admin/login"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  title="Admin Login"
                >
                  🔐
                </Link>
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
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <p className="text-gray-500 text-sm">
              Stock Market TV Recommendation Tracker - Extracting insights from Indian financial TV
            </p>
            <div className="flex items-center gap-4 text-sm">
              <Link to="/privacy-policy" className="text-gray-500 hover:text-gray-700">
                Privacy Policy
              </Link>
              <span className="text-gray-300">|</span>
              <Link to="/terms" className="text-gray-500 hover:text-gray-700">
                Terms of Service
              </Link>
            </div>
          </div>
          <p className="text-center text-gray-400 text-xs mt-2">
            &copy; {new Date().getFullYear()} Ubinator Software Solutions LLP. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
