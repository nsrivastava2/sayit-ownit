import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import AddVideo from './pages/AddVideo';
import Recommendations from './pages/Recommendations';
import ExpertView from './pages/ExpertView';
import ShareView from './pages/ShareView';
import VideoDetails from './pages/VideoDetails';
import ExpertManagement from './pages/admin/ExpertManagement';
import ChannelManagement from './pages/admin/ChannelManagement';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add" element={<AddVideo />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/experts/:name" element={<ExpertView />} />
        <Route path="/shares/:symbol" element={<ShareView />} />
        <Route path="/videos/:id" element={<VideoDetails />} />
        {/* Admin Routes */}
        <Route path="/admin/experts" element={<ExpertManagement />} />
        <Route path="/admin/channels" element={<ChannelManagement />} />
      </Routes>
    </Layout>
  );
}

export default App;
