const mysqlService = require('../services/mysqlService');

// Helper to extract YouTube video ID from various YouTube URL formats
function extractYouTubeId(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : '';
}

// @desc    Get all videos
// @route   GET /api/videos
// @access  Public
exports.getVideos = async (req, res) => {
  try {
    const { category, limit = 20, page = 1 } = req.query;

    const { videos, total } = await mysqlService.getVideos({
      category,
      limit,
      page,
    });

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');

    return res.status(200).json({
      success: true,
      count: videos.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      videos,
    });
  } catch (error) {
    console.warn('getVideos fallback:', error.message);
    let fallback = { videos: [], total: 0 };
    try {
      fallback = await mysqlService.getVideos({ limit: 20, page: 1 });
    } catch {}
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json({
      success: true,
      count: (fallback.videos || []).length,
      total: fallback.total || 0,
      page: 1,
      totalPages: 1,
      videos: fallback.videos || [],
    });
  }
};

// @desc    Get single video by ID
// @route   GET /api/videos/:id
// @access  Public
exports.getVideoById = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await mysqlService.getVideoById(id);
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found',
      });
    }
    return res.status(200).json({
      success: true,
      video,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch video',
    });
  }
};

// @desc    Create / Upload new video
// @route   POST /api/videos
// @access  Private / Admin
exports.createVideo = async (req, res) => {
  try {
    const body = req.body || {};

    if (!body.title || !body.videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Video title and video URL are required',
      });
    }

    const videoUrl = body.videoUrl.trim();
    const youtubeId = body.youtubeId ? body.youtubeId.trim() : extractYouTubeId(videoUrl);

    // Thumbnail resolution: file upload base64 -> body URL -> YouTube auto thumbnail -> fallback
    let thumbnail = typeof body.thumbnail === 'string' ? body.thumbnail.trim() : '';
    if (!thumbnail && req.file) {
      thumbnail = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    if (!thumbnail && youtubeId) {
      thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    }

    if (!thumbnail) {
      thumbnail = 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=400&q=80';
    }

    const newVideo = await mysqlService.createVideo({
      title: body.title.trim(),
      category: body.category ? body.category.trim() : 'വാർത്തകൾ',
      duration: body.duration ? body.duration.trim() : '01:30',
      viewsCount: body.viewsCount ? parseInt(body.viewsCount) : 1200,
      thumbnail,
      videoUrl,
      youtubeId,
      description: body.description ? body.description.trim() : '',
    });

    return res.status(201).json({
      success: true,
      message: 'Video added successfully',
      video: newVideo,
    });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create video',
    });
  }
};

// @desc    Update video
// @route   PUT /api/videos/:id
// @access  Private / Admin
exports.updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const updateData = { ...body };
    if (body.videoUrl) {
      const url = body.videoUrl.trim();
      updateData.videoUrl = url;
      updateData.youtubeId = extractYouTubeId(url);
    }
    if (req.file) {
      updateData.thumbnail = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    } else if (body.thumbnail) {
      updateData.thumbnail = body.thumbnail.trim();
    }

    const updated = await mysqlService.updateVideo(id, updateData);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Video not found',
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Video updated successfully',
      video: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update video',
    });
  }
};

// @desc    Delete video
// @route   DELETE /api/videos/:id
// @access  Private / Admin
exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await mysqlService.deleteVideo(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Video not found',
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Video deleted successfully',
      id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete video',
    });
  }
};
