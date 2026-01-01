import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import AddVideo from './pages/AddVideo';
import Recommendations from './pages/Recommendations';
import ExpertView from './pages/ExpertView';
import ShareView from './pages/ShareView';
import VideoDetails from './pages/VideoDetails';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import AdminLogin from './pages/admin/AdminLogin';
import ExpertManagement from './pages/admin/ExpertManagement';
import ChannelManagement from './pages/admin/ChannelManagement';
import RecommendationReview from './pages/admin/RecommendationReview';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';

function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <Layout>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/experts/:name" element={<ExpertView />} />
            <Route path="/shares/:symbol" element={<ShareView />} />
            <Route path="/videos/:id" element={<VideoDetails />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />

            {/* User Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<UserDashboard />} />

            {/* Admin Login (public) */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Protected Admin Routes */}
            <Route path="/add" element={
              <ProtectedRoute><AddVideo /></ProtectedRoute>
            } />
            <Route path="/admin/experts" element={
              <ProtectedRoute><ExpertManagement /></ProtectedRoute>
            } />
            <Route path="/admin/channels" element={
              <ProtectedRoute><ChannelManagement /></ProtectedRoute>
            } />
            <Route path="/admin/recommendations" element={
              <ProtectedRoute><RecommendationReview /></ProtectedRoute>
            } />
          </Routes>
        </Layout>
      </UserProvider>
    </AuthProvider>
  );
}

export default App;
