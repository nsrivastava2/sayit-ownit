import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import AddVideo from './pages/AddVideo';
import Recommendations from './pages/Recommendations';
import ExpertView from './pages/ExpertView';
import ShareView from './pages/ShareView';
import VideoDetails from './pages/VideoDetails';
import Leaderboard from './pages/Leaderboard';
import AdminLogin from './pages/admin/AdminLogin';
import ExpertManagement from './pages/admin/ExpertManagement';
import ChannelManagement from './pages/admin/ChannelManagement';

function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/experts/:name" element={<ExpertView />} />
          <Route path="/shares/:symbol" element={<ShareView />} />
          <Route path="/videos/:id" element={<VideoDetails />} />

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
        </Routes>
      </Layout>
    </AuthProvider>
  );
}

export default App;
