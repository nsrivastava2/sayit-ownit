import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import { useState } from 'react';

// SVG Logo Component
function Logo({ className = "w-10 h-10" }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#1E40AF', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#0891B2', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="url(#logoGradient)" opacity="0.1"/>
      <path d="M20 8C13.373 8 8 13.373 8 20C8 26.627 13.373 32 20 32C26.627 32 32 26.627 32 20C32 13.373 26.627 8 20 8ZM20 14C21.105 14 22 14.895 22 16V24C22 25.105 21.105 26 20 26C18.895 26 18 25.105 18 24V16C18 14.895 18.895 14 20 14Z" fill="url(#logoGradient)"/>
      <circle cx="20" cy="16" r="2" fill="#FFFFFF"/>
    </svg>
  );
}

function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated: isAdminAuth, loading: adminLoading, logout: adminLogout } = useAuth();
  const { user, isAuthenticated: isUserAuth, loading: userLoading, logout: userLogout } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Public nav items (always visible)
  const publicNavItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/recommendations', label: 'Recommendations' },
    { path: '/leaderboard', label: 'Leaderboard' }
  ];

  // Admin nav items (only visible when authenticated)
  const adminNavItems = [
    { path: '/add', label: 'Add Video' },
    { path: '/admin/recommendations', label: 'Review' },
    { path: '/admin/experts', label: 'Experts' },
    { path: '/admin/channels', label: 'Channels' }
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-navigation">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <Logo className="w-10 h-10" />
              <span className="text-xl font-heading font-bold text-primary">SayIt OwnIt</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {publicNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-link ${isActive(item.path) ? 'nav-link-active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}

              {/* User Section */}
              <span className="border-l border-border mx-3 h-6"></span>

              {!userLoading && isUserAuth ? (
                <>
                  <Link
                    to="/dashboard"
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive('/dashboard')
                        ? 'bg-primary/10 text-primary'
                        : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                    }`}
                  >
                    {user?.profilePicture ? (
                      <img src={user.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-primary" />
                    ) : (
                      <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm font-bold">
                        {user?.fullName?.charAt(0) || '?'}
                      </span>
                    )}
                    <span className="hidden lg:inline">{user?.fullName?.split(' ')[0]}</span>
                  </Link>
                  <button
                    onClick={handleUserLogout}
                    className="px-3 py-1.5 rounded-md text-sm text-text-tertiary hover:bg-surface-elevated hover:text-text-secondary transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : !userLoading ? (
                <Link
                  to="/login"
                  className={`nav-link ${isActive('/login') ? 'nav-link-active' : ''}`}
                >
                  Sign In
                </Link>
              ) : null}

              {/* Admin Section */}
              {!adminLoading && isAdminAuth && (
                <>
                  <span className="border-l border-border mx-3 h-6"></span>
                  {adminNavItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive(item.path)
                          ? 'bg-accent/10 text-accent-700'
                          : 'text-text-tertiary hover:bg-surface-elevated hover:text-text-secondary'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    onClick={handleAdminLogout}
                    data-testid="logout-button"
                    className="px-3 py-1.5 rounded-md text-sm font-medium text-error hover:bg-error/10 transition-colors"
                    title="Admin Logout"
                  >
                    Logout
                  </button>
                </>
              )}

              {/* Admin Login Link */}
              {!adminLoading && !isAdminAuth && (
                <Link
                  to="/admin/login"
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-text-tertiary hover:text-text-secondary hover:bg-surface-elevated transition-colors"
                  title="Admin Login"
                >
                  Admin
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden touch-target"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              <svg className="w-6 h-6 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 border-t border-border mt-2 pt-4 animate-dropdown-open">
              <div className="flex flex-col gap-2">
                {publicNavItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`nav-link ${isActive(item.path) ? 'nav-link-active' : ''}`}
                  >
                    {item.label}
                  </Link>
                ))}

                {!userLoading && isUserAuth ? (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`nav-link ${isActive('/dashboard') ? 'nav-link-active' : ''}`}
                    >
                      My Dashboard
                    </Link>
                    <button
                      onClick={() => { handleUserLogout(); setMobileMenuOpen(false); }}
                      className="nav-link text-left"
                    >
                      Logout
                    </button>
                  </>
                ) : !userLoading ? (
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`nav-link ${isActive('/login') ? 'nav-link-active' : ''}`}
                  >
                    Sign In
                  </Link>
                ) : null}

                {!adminLoading && isAdminAuth && (
                  <>
                    <div className="border-t border-border my-2"></div>
                    <span className="px-4 py-1 text-xs font-medium text-text-tertiary uppercase tracking-wider">Admin</span>
                    {adminNavItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`nav-link ${isActive(item.path) ? 'bg-accent/10 text-accent-700' : ''}`}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <button
                      onClick={() => { handleAdminLogout(); setMobileMenuOpen(false); }}
                      className="nav-link text-left text-error"
                    >
                      Admin Logout
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo className="w-8 h-8" />
              <span className="font-heading font-bold text-primary">SayIt OwnIt</span>
            </div>
            <p className="text-sm text-text-secondary">
              Stock Market TV Recommendation Tracker
            </p>
            <div className="flex items-center gap-4 text-sm">
              <Link to="/privacy-policy" className="text-text-secondary hover:text-primary transition-colors">
                Privacy
              </Link>
              <Link to="/terms" className="text-text-secondary hover:text-primary transition-colors">
                Terms
              </Link>
            </div>
          </div>
          <p className="text-center text-text-tertiary text-xs mt-4">
            &copy; {new Date().getFullYear()} Ubinator Software Solutions LLP. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
