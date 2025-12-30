import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Check SUPABASE_URL and SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions for database operations
export const db = {
  // Videos
  async createVideo(videoData) {
    const { data, error } = await supabase
      .from('videos')
      .insert(videoData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateVideo(id, updates) {
    const { data, error } = await supabase
      .from('videos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getVideo(id) {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getVideos({ status, limit = 20, offset = 0 }) {
    let query = supabase
      .from('videos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data, count };
  },

  async getVideoByUrl(youtubeUrl) {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('youtube_url', youtubeUrl)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Transcripts
  async createTranscript(transcriptData) {
    const { data, error } = await supabase
      .from('transcripts')
      .insert(transcriptData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getTranscriptsByVideo(videoId) {
    const { data, error } = await supabase
      .from('transcripts')
      .select('*')
      .eq('video_id', videoId)
      .order('chunk_index', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getRecentTranscripts(videoId, count) {
    const { data, error } = await supabase
      .from('transcripts')
      .select('*')
      .eq('video_id', videoId)
      .order('chunk_index', { ascending: false })
      .limit(count);
    if (error) throw error;
    return data.reverse();
  },

  // Recommendations
  async createRecommendation(recommendationData) {
    const { data, error } = await supabase
      .from('recommendations')
      .insert(recommendationData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createRecommendations(recommendations) {
    if (!recommendations.length) return [];
    const { data, error } = await supabase
      .from('recommendations')
      .insert(recommendations)
      .select();
    if (error) throw error;
    return data;
  },

  async getRecommendations({ expert, share, dateFrom, dateTo, action, limit = 50, offset = 0 }) {
    let query = supabase
      .from('recommendations')
      .select(`
        *,
        videos (
          id,
          youtube_url,
          title,
          channel_name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (expert) {
      query = query.ilike('expert_name', `%${expert}%`);
    }
    if (share) {
      query = query.or(`share_name.ilike.%${share}%,nse_symbol.ilike.%${share}%`);
    }
    if (dateFrom) {
      query = query.gte('recommendation_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('recommendation_date', dateTo);
    }
    if (action) {
      query = query.eq('action', action.toUpperCase());
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data, count };
  },

  async getRecommendationsByExpert() {
    const { data, error } = await supabase
      .from('recommendations')
      .select('expert_name')
      .order('expert_name');

    if (error) throw error;

    // Group and count
    const grouped = data.reduce((acc, { expert_name }) => {
      acc[expert_name] = (acc[expert_name] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, count]) => ({ name, count }));
  },

  async getRecommendationsByShare() {
    const { data, error } = await supabase
      .from('recommendations')
      .select('share_name, nse_symbol')
      .order('share_name');

    if (error) throw error;

    // Group and count
    const grouped = data.reduce((acc, { share_name, nse_symbol }) => {
      const key = share_name;
      if (!acc[key]) {
        acc[key] = { name: share_name, symbol: nse_symbol, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});

    return Object.values(grouped);
  },

  async getExperts() {
    const experts = await this.getRecommendationsByExpert();
    return experts.sort((a, b) => b.count - a.count);
  },

  async getShares() {
    const shares = await this.getRecommendationsByShare();
    return shares.sort((a, b) => b.count - a.count);
  },

  async getStats() {
    const [videosResult, recommendationsResult] = await Promise.all([
      supabase.from('videos').select('id, status', { count: 'exact' }),
      supabase.from('recommendations').select('id, expert_name, share_name, action', { count: 'exact' })
    ]);

    if (videosResult.error) throw videosResult.error;
    if (recommendationsResult.error) throw recommendationsResult.error;

    const recommendations = recommendationsResult.data;
    const uniqueExperts = new Set(recommendations.map(r => r.expert_name));
    const uniqueShares = new Set(recommendations.map(r => r.share_name));
    const actionCounts = recommendations.reduce((acc, r) => {
      acc[r.action] = (acc[r.action] || 0) + 1;
      return acc;
    }, {});

    return {
      totalVideos: videosResult.count,
      completedVideos: videosResult.data.filter(v => v.status === 'completed').length,
      totalRecommendations: recommendationsResult.count,
      uniqueExperts: uniqueExperts.size,
      uniqueShares: uniqueShares.size,
      actionCounts
    };
  }
};

export default db;
