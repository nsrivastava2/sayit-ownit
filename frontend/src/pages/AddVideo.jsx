import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const STEPS = [
  { key: 'queued', label: 'Queued', icon: '⏳' },
  { key: 'downloading', label: 'Downloading', icon: '📥' },
  { key: 'splitting', label: 'Splitting Audio', icon: '✂️' },
  { key: 'transcribing', label: 'Transcribing', icon: '📝' },
  { key: 'analyzing', label: 'Analyzing', icon: '🔍' },
  { key: 'completed', label: 'Completed', icon: '✅' }
];

function AddVideo() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const pollInterval = useRef(null);

  useEffect(() => {
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    // Basic YouTube URL validation
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|live\/|shorts\/)|youtu\.be\/)/;
    if (!youtubeRegex.test(url)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.processVideo(url);
      setJobId(result.job_id);

      if (result.is_existing && result.status === 'completed') {
        setJobStatus({
          status: 'completed',
          progress: 100,
          currentStep: 'completed'
        });
      } else {
        // Start polling for status
        startPolling(result.job_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startPolling(id) {
    // Poll immediately
    checkStatus(id);

    // Then poll every 2 seconds
    pollInterval.current = setInterval(() => {
      checkStatus(id);
    }, 2000);
  }

  async function checkStatus(id) {
    try {
      const status = await api.getVideoStatus(id);
      setJobStatus(status);

      if (status.status === 'completed' || status.status === 'failed') {
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
        }
      }
    } catch (err) {
      console.error('Error checking status:', err);
    }
  }

  function reset() {
    setUrl('');
    setJobId(null);
    setJobStatus(null);
    setError(null);
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }
  }

  function getCurrentStepIndex() {
    if (!jobStatus) return -1;
    return STEPS.findIndex(s => s.key === jobStatus.currentStep);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Add Video</h1>
        <p className="text-gray-500 mt-1">
          Submit a YouTube URL to extract stock recommendations
        </p>
      </div>

      {!jobId ? (
        /* URL Input Form */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                YouTube URL
              </label>
              <input
                type="text"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                disabled={loading}
              />
              <p className="mt-2 text-sm text-gray-500">
                Supports live streams and recorded videos from CNBC Awaaz, Zee Business, ET Now, CNBC TV18
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <span className="mr-2">🎬</span>
                  Process Video
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Processing Status */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Processing Status</h2>
            {jobStatus?.videoInfo?.title && (
              <p className="text-gray-600 mt-1">{jobStatus.videoInfo.title}</p>
            )}
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEPS.map((step, idx) => {
                const currentIdx = getCurrentStepIndex();
                const isCompleted = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const isPending = idx > currentIdx;

                return (
                  <div key={step.key} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-primary-500 text-white animate-pulse'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isCompleted ? '✓' : step.icon}
                    </div>
                    <span
                      className={`mt-2 text-xs text-center ${
                        isCurrent ? 'text-primary-600 font-medium' : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress line */}
            <div className="mt-4 relative">
              <div className="h-2 bg-gray-200 rounded-full">
                <div
                  className="h-2 bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${jobStatus?.progress || 0}%` }}
                ></div>
              </div>
              <span className="absolute right-0 -top-6 text-sm text-gray-600">
                {jobStatus?.progress || 0}%
              </span>
            </div>
          </div>

          {/* Status message */}
          {jobStatus?.status === 'completed' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
              <p className="text-green-700 font-medium">
                ✅ Video processed successfully!
              </p>
              <p className="text-green-600 text-sm mt-1">
                Recommendations have been extracted and saved.
              </p>
            </div>
          )}

          {jobStatus?.status === 'failed' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <p className="text-red-700 font-medium">
                ❌ Processing failed
              </p>
              <p className="text-red-600 text-sm mt-1">
                {jobStatus.error || 'An error occurred during processing'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-4">
            {jobStatus?.status === 'completed' && (
              <Link
                to={`/videos/${jobId}`}
                className="flex-1 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 text-center transition-colors"
              >
                View Results
              </Link>
            )}
            <button
              onClick={reset}
              className={`${
                jobStatus?.status === 'completed' ? 'flex-1' : 'w-full'
              } px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors`}
            >
              Add Another Video
            </button>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-3">💡 Tips</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• For best results, use videos from popular Indian financial TV channels</li>
          <li>• Live streams are processed in real-time with recommendations appearing as they're mentioned</li>
          <li>• Both Hindi and English content is supported</li>
          <li>• Processing time depends on video length (typically 1-2 minutes per 10 minutes of video)</li>
        </ul>
      </div>
    </div>
  );
}

export default AddVideo;
