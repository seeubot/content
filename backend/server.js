// Filename: backend/server.js

require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

// ================================================================
// CONFIGURATION
// ================================================================

const MONGODB_URI = process.env.MONGODB_URI;
// Use process.env.PORT to be compatible with Koyeb's environment
const PORT = process.env.PORT || 3001; 

// Exit if the MongoDB URI is not provided
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables. Please set it.');
  process.exit(1);
}

// ================================================================
// MONGODB CONNECTION & SCHEMAS
// ================================================================

mongoose.set('strictQuery', false);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Define the Mongoose schema for movies
const movieSchema = new mongoose.Schema({
  // 💡 FIX: Removed 'unique: true' from the name field to prevent duplicate key errors
  name: { type: String, required: true }, 
  thumbnail: { type: String, required: true },
  streamingUrl: { type: String, required: true },
  addedBy: { type: Number, required: false },
  addedAt: { type: Date, default: Date.now }
});

// Define the Mongoose schema for series
const seriesSchema = new mongoose.Schema({
  name: { type: String, required: true },
  thumbnail: { type: String, required: true },
  seasons: [{
    seasonNumber: { type: Number, required: true },
    episodes: [{
      episodeNumber: { type: Number, required: true },
      title: { type: String, required: true },
      streamingUrl: { type: String, required: true },
      thumbnail: String
    }]
  }],
  addedBy: { type: Number, required: false },
  addedAt: { type: Date, default: Date.now }
});

// Create Mongoose models
const Movie = mongoose.model('Movie', movieSchema);
const Series = mongoose.model('Series', seriesSchema);

// ================================================================
// EXPRESS APP & MIDDLEWARE
// ================================================================

const app = express();

// 💡 CORS Configuration to allow requests from the Vercel frontend
const corsOptions = {
  origin: 'https://content-fwug.vercel.app', // Your Vercel frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// ================================================================
// API ENDPOINTS
// ================================================================

// 🚀 POST endpoint to add a new movie
app.post('/api/movies', async (req, res) => {
  try {
    const { name, thumbnail, streamingUrl } = req.body;
    if (!name || !thumbnail || !streamingUrl) {
      return res.status(400).json({ error: 'Missing required fields: name, thumbnail, or streamingUrl' });
    }
    const newMovie = new Movie({ name, thumbnail, streamingUrl });
    await newMovie.save();
    res.status(201).json(newMovie);
  } catch (error) {
    console.error('❌ Error adding new movie:', error);
    res.status(500).json({ error: 'Failed to add movie', details: error.message });
  }
});

// 🚀 POST endpoint to add a new series
app.post('/api/series', async (req, res) => {
  try {
    const { name, thumbnail, seasons } = req.body;
    if (!name || !thumbnail || !seasons || !Array.isArray(seasons)) {
      return res.status(400).json({ error: 'Missing required fields or invalid format' });
    }
    const newSeries = new Series({ name, thumbnail, seasons });
    await newSeries.save();
    res.status(201).json(newSeries);
  } catch (error) {
    console.error('❌ Error adding new series:', error);
    res.status(500).json({ error: 'Failed to add series', details: error.message });
  }
});

// 🔄 PUT endpoint to update a movie
app.put('/api/movies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedMovie = await Movie.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedMovie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    res.json(updatedMovie);
  } catch (error) {
    console.error('❌ Error updating movie:', error);
    res.status(500).json({ error: 'Failed to update movie', details: error.message });
  }
});

// 🔄 PUT endpoint to update a series
app.put('/api/series/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedSeries = await Series.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedSeries) {
      return res.status(404).json({ error: 'Series not found' });
    }
    res.json(updatedSeries);
  } catch (error) {
    console.error('❌ Error updating series:', error);
    res.status(500).json({ error: 'Failed to update series', details: error.message });
  }
});

// 🗑️ DELETE endpoint to delete a movie
app.delete('/api/movies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedMovie = await Movie.findByIdAndDelete(id);
    if (!deletedMovie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    res.json({ message: 'Movie deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting movie:', error);
    res.status(500).json({ error: 'Failed to delete movie', details: error.message });
  }
});

// 🗑️ DELETE endpoint to delete a series
app.delete('/api/series/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedSeries = await Series.findByIdAndDelete(id);
    if (!deletedSeries) {
      return res.status(404).json({ error: 'Series not found' });
    }
    res.json({ message: 'Series deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting series:', error);
    res.status(500).json({ error: 'Failed to delete series', details: error.message });
  }
});

// 🎬📺 Fetch all movies and series in one go
app.get('/api/media', async (req, res) => {
  try {
    const { search } = req.query;
    const searchQuery = search ? { name: { $regex: search, $options: 'i' } } : {};
    
    const [movies, series] = await Promise.all([
      Movie.find(searchQuery).sort({ addedAt: -1 }).exec(),
      Series.find(searchQuery).sort({ addedAt: -1 }).exec()
    ]);

    const combinedMedia = [
      ...movies.map(movie => ({ ...movie._doc, type: 'movie' })),
      ...series.map(s => ({ ...s._doc, type: 'series' }))
    ];

    combinedMedia.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    
    res.json(combinedMedia);
  } catch (error) {
    console.error('❌ Error fetching combined media:', error);
    res.status(500).json({ error: 'Failed to fetch media', details: error.message });
  }
});

// 📊 Get library statistics
app.get('/api/stats', async (req, res) => {
  try {
    const movieCount = await Movie.countDocuments();
    const seriesCount = await Series.countDocuments();
    const totalEpisodes = await Series.aggregate([
      { $unwind: '$seasons' },
      { $unwind: '$seasons.episodes' },
      { $count: 'totalEpisodes' }
    ]);
    const episodeCount = totalEpisodes[0]?.totalEpisodes || 0;
    res.json({
      movies: movieCount,
      series: seriesCount,
      episodes: episodeCount,
      total: movieCount + seriesCount
    });
  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error', details: error.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Media Manager API Server running on port ${PORT}`);
});

