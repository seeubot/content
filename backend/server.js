// server.js

// Import necessary libraries
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(cors()); // Enable CORS for cross-origin requests
app.use(express.json()); // Parse JSON request bodies

// ================================================================
// MONGODB CONNECTION
// ================================================================

// Get the MongoDB URI from environment variables.
// The URI must be set on the hosting platform (e.g., Koyeb)
const mongoURI = process.env.MONGODB_URI;

// Check if the MongoDB URI is available
if (!mongoURI) {
    console.error('Error: MONGODB_URI environment variable is not set.');
    process.exit(1); // Exit if the URI is not configured
}

// Connect to MongoDB using Mongoose
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit on connection failure
});

// ================================================================
// MONGOOSE SCHEMAS AND MODELS
// ================================================================

// Define the schema for a TV series
const seriesSchema = new mongoose.Schema({
    name: { type: String, required: true },
    thumbnail: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, default: 'series' }
});

// Define the schema for a season
const seasonSchema = new mongoose.Schema({
    seriesName: { type: String, required: true }, // Links to series by name
    seasonNumber: { type: Number, required: true },
    title: { type: String, required: true }, // e.g., "Season 1", "Season 2"
    description: { type: String, default: '' },
    thumbnail: { type: String, default: '' }, // Optional season-specific thumbnail
});

// Define the schema for individual episodes
const episodeSchema = new mongoose.Schema({
    seriesName: { type: String, required: true }, // Links to series by name
    seasonNumber: { type: Number, required: true }, // Links to season
    episodeNumber: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    streamingUrl: { type: String, required: true },
    thumbnail: { type: String, default: '' }, // Optional episode thumbnail
    duration: { type: String, default: '' }, // e.g., "45 min"
    airDate: { type: Date, default: null }
});

// Create compound index for better query performance
episodeSchema.index({ seriesName: 1, seasonNumber: 1, episodeNumber: 1 });
seasonSchema.index({ seriesName: 1, seasonNumber: 1 });

// Create the Mongoose models
const Series = mongoose.model('Series', seriesSchema);
const Season = mongoose.model('Season', seasonSchema);
const Episode = mongoose.model('Episode', episodeSchema);

// ================================================================
// SERIES API ENDPOINTS
// ================================================================

// GET all series (with optional search)
app.get('/api/series', async (req, res) => {
    try {
        const { search } = req.query;
        let series;

        if (search) {
            const regex = new RegExp(search, 'i');
            series = await Series.find({ name: { $regex: regex } });
        } else {
            series = await Series.find();
        }

        res.json(series);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch series.' });
    }
});

// GET single series by name
app.get('/api/series/:seriesName', async (req, res) => {
    try {
        const series = await Series.findOne({ name: req.params.seriesName });
        if (!series) {
            return res.status(404).json({ error: 'Series not found.' });
        }
        res.json(series);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch series.' });
    }
});

// POST a new series
app.post('/api/series', async (req, res) => {
    try {
        const newSeries = new Series(req.body);
        await newSeries.save();
        res.status(201).json(newSeries);
    } catch (err) {
        res.status(400).json({ error: 'Failed to add series.', details: err.message });
    }
});

// PUT (update) an existing series
app.put('/api/series/:seriesName', async (req, res) => {
    try {
        const updatedSeries = await Series.findOneAndUpdate(
            { name: req.params.seriesName }, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!updatedSeries) {
            return res.status(404).json({ error: 'Series not found.' });
        }
        res.json(updatedSeries);
    } catch (err) {
        res.status(400).json({ error: 'Failed to update series.', details: err.message });
    }
});

// DELETE a series (and all its seasons/episodes)
app.delete('/api/series/:seriesName', async (req, res) => {
    try {
        const seriesName = req.params.seriesName;
        
        // Delete series
        const deletedSeries = await Series.findOneAndDelete({ name: seriesName });
        if (!deletedSeries) {
            return res.status(404).json({ error: 'Series not found.' });
        }
        
        // Also delete all seasons and episodes for this series
        await Season.deleteMany({ seriesName: seriesName });
        await Episode.deleteMany({ seriesName: seriesName });
        
        res.json({ message: 'Series and all related content deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete series.' });
    }
});

// ================================================================
// SEASONS API ENDPOINTS
// ================================================================

// GET all seasons for a series
app.get('/api/series/:seriesName/seasons', async (req, res) => {
    try {
        const seasons = await Season.find({ seriesName: req.params.seriesName })
                                  .sort({ seasonNumber: 1 });
        res.json(seasons);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch seasons.' });
    }
});

// GET single season
app.get('/api/series/:seriesName/seasons/:seasonNumber', async (req, res) => {
    try {
        const season = await Season.findOne({ 
            seriesName: req.params.seriesName,
            seasonNumber: parseInt(req.params.seasonNumber)
        });
        if (!season) {
            return res.status(404).json({ error: 'Season not found.' });
        }
        res.json(season);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch season.' });
    }
});

// POST a new season
app.post('/api/series/:seriesName/seasons', async (req, res) => {
    try {
        const seasonData = {
            ...req.body,
            seriesName: req.params.seriesName
        };
        const newSeason = new Season(seasonData);
        await newSeason.save();
        res.status(201).json(newSeason);
    } catch (err) {
        res.status(400).json({ error: 'Failed to add season.', details: err.message });
    }
});

// PUT (update) a season
app.put('/api/series/:seriesName/seasons/:seasonNumber', async (req, res) => {
    try {
        const updatedSeason = await Season.findOneAndUpdate(
            { 
                seriesName: req.params.seriesName,
                seasonNumber: parseInt(req.params.seasonNumber)
            }, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!updatedSeason) {
            return res.status(404).json({ error: 'Season not found.' });
        }
        res.json(updatedSeason);
    } catch (err) {
        res.status(400).json({ error: 'Failed to update season.', details: err.message });
    }
});

// DELETE a season (and all its episodes)
app.delete('/api/series/:seriesName/seasons/:seasonNumber', async (req, res) => {
    try {
        const seriesName = req.params.seriesName;
        const seasonNumber = parseInt(req.params.seasonNumber);
        
        const deletedSeason = await Season.findOneAndDelete({ 
            seriesName: seriesName,
            seasonNumber: seasonNumber
        });
        if (!deletedSeason) {
            return res.status(404).json({ error: 'Season not found.' });
        }
        
        // Also delete all episodes for this season
        await Episode.deleteMany({ 
            seriesName: seriesName,
            seasonNumber: seasonNumber
        });
        
        res.json({ message: 'Season and all its episodes deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete season.' });
    }
});

// ================================================================
// EPISODES API ENDPOINTS
// ================================================================

// GET all episodes for a series
app.get('/api/series/:seriesName/episodes', async (req, res) => {
    try {
        const episodes = await Episode.find({ seriesName: req.params.seriesName })
                                    .sort({ seasonNumber: 1, episodeNumber: 1 });
        res.json(episodes);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch episodes.' });
    }
});

// GET all episodes for a specific season
app.get('/api/series/:seriesName/seasons/:seasonNumber/episodes', async (req, res) => {
    try {
        const episodes = await Episode.find({ 
            seriesName: req.params.seriesName,
            seasonNumber: parseInt(req.params.seasonNumber)
        }).sort({ episodeNumber: 1 });
        
        res.json(episodes);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch episodes.' });
    }
});

// GET single episode
app.get('/api/series/:seriesName/seasons/:seasonNumber/episodes/:episodeNumber', async (req, res) => {
    try {
        const episode = await Episode.findOne({
            seriesName: req.params.seriesName,
            seasonNumber: parseInt(req.params.seasonNumber),
            episodeNumber: parseInt(req.params.episodeNumber)
        });
        
        if (!episode) {
            return res.status(404).json({ error: 'Episode not found.' });
        }
        
        res.json(episode);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch episode.' });
    }
});

// POST a new episode
app.post('/api/series/:seriesName/seasons/:seasonNumber/episodes', async (req, res) => {
    try {
        const episodeData = {
            ...req.body,
            seriesName: req.params.seriesName,
            seasonNumber: parseInt(req.params.seasonNumber)
        };
        
        const newEpisode = new Episode(episodeData);
        await newEpisode.save();
        res.status(201).json(newEpisode);
    } catch (err) {
        res.status(400).json({ error: 'Failed to add episode.', details: err.message });
    }
});

// PUT (update) an episode
app.put('/api/series/:seriesName/seasons/:seasonNumber/episodes/:episodeNumber', async (req, res) => {
    try {
        const updatedEpisode = await Episode.findOneAndUpdate(
            {
                seriesName: req.params.seriesName,
                seasonNumber: parseInt(req.params.seasonNumber),
                episodeNumber: parseInt(req.params.episodeNumber)
            },
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!updatedEpisode) {
            return res.status(404).json({ error: 'Episode not found.' });
        }
        
        res.json(updatedEpisode);
    } catch (err) {
        res.status(400).json({ error: 'Failed to update episode.', details: err.message });
    }
});

// DELETE an episode
app.delete('/api/series/:seriesName/seasons/:seasonNumber/episodes/:episodeNumber', async (req, res) => {
    try {
        const deletedEpisode = await Episode.findOneAndDelete({
            seriesName: req.params.seriesName,
            seasonNumber: parseInt(req.params.seasonNumber),
            episodeNumber: parseInt(req.params.episodeNumber)
        });
        
        if (!deletedEpisode) {
            return res.status(404).json({ error: 'Episode not found.' });
        }
        
        res.json({ message: 'Episode deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete episode.' });
    }
});

// ================================================================
// COMBINED DATA ENDPOINTS (FOR SKETCHWARE APP)
// ================================================================

// GET complete series data with seasons and episodes (for backward compatibility)
app.get('/api/series/:seriesName/complete', async (req, res) => {
    try {
        const seriesName = req.params.seriesName;
        
        // Get series info
        const series = await Series.findOne({ name: seriesName });
        if (!series) {
            return res.status(404).json({ error: 'Series not found.' });
        }
        
        // Get all seasons for this series
        const seasons = await Season.find({ seriesName: seriesName })
                                  .sort({ seasonNumber: 1 });
        
        // Get all episodes for this series
        const episodes = await Episode.find({ seriesName: seriesName })
                                    .sort({ seasonNumber: 1, episodeNumber: 1 });
        
        // Group episodes by season
        const seasonsWithEpisodes = seasons.map(season => {
            const seasonEpisodes = episodes.filter(ep => ep.seasonNumber === season.seasonNumber);
            return {
                ...season.toObject(),
                episodes: seasonEpisodes
            };
        });
        
        // Combine series with seasons and episodes
        const completeData = {
            ...series.toObject(),
            seasons: seasonsWithEpisodes
        };
        
        res.json(completeData);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch complete series data.' });
    }
});

// GET all series with their seasons and episodes (for Sketchware app)
app.get('/api/complete', async (req, res) => {
    try {
        const { search } = req.query;
        let seriesQuery = {};
        
        if (search) {
            const regex = new RegExp(search, 'i');
            seriesQuery = { name: { $regex: regex } };
        }
        
        // Get all series (with optional search)
        const allSeries = await Series.find(seriesQuery);
        
        // For each series, get seasons and episodes
        const completeData = await Promise.all(
            allSeries.map(async (series) => {
                // Get seasons for this series
                const seasons = await Season.find({ seriesName: series.name })
                                          .sort({ seasonNumber: 1 });
                
                // Get episodes for this series
                const episodes = await Episode.find({ seriesName: series.name })
                                             .sort({ seasonNumber: 1, episodeNumber: 1 });
                
                // Group episodes by season
                const seasonsWithEpisodes = seasons.map(season => {
                    const seasonEpisodes = episodes.filter(ep => ep.seasonNumber === season.seasonNumber);
                    return {
                        ...season.toObject(),
                        episodes: seasonEpisodes
                    };
                });
                
                return {
                    ...series.toObject(),
                    seasons: seasonsWithEpisodes
                };
            })
        );
        
        res.json(completeData);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch complete data.' });
    }
});

// ================================================================
// UTILITY ENDPOINTS
// ================================================================

// GET episodes by series and season (optimized for mobile apps)
app.get('/api/episodes', async (req, res) => {
    try {
        const { series, season, search } = req.query;
        let query = {};
        
        if (series) query.seriesName = series;
        if (season) query.seasonNumber = parseInt(season);
        
        if (search) {
            const regex = new RegExp(search, 'i');
            query.title = { $regex: regex };
        }
        
        const episodes = await Episode.find(query)
                                    .sort({ seasonNumber: 1, episodeNumber: 1 });
        res.json(episodes);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch episodes.' });
    }
});

// GET series statistics
app.get('/api/series/:seriesName/stats', async (req, res) => {
    try {
        const seriesName = req.params.seriesName;
        
        const seasonCount = await Season.countDocuments({ seriesName: seriesName });
        const episodeCount = await Episode.countDocuments({ seriesName: seriesName });
        
        // Get episodes per season
        const episodesPerSeason = await Episode.aggregate([
            { $match: { seriesName: seriesName } },
            { $group: { _id: '$seasonNumber', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        
        res.json({
            seriesName: seriesName,
            totalSeasons: seasonCount,
            totalEpisodes: episodeCount,
            episodesPerSeason: episodesPerSeason.map(item => ({
                season: item._id,
                episodes: item.count
            }))
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch series statistics.' });
    }
});

// ================================================================
// BULK OPERATIONS (FOR EASY DATA MANAGEMENT)
// ================================================================

// POST bulk episodes for a season
app.post('/api/series/:seriesName/seasons/:seasonNumber/episodes/bulk', async (req, res) => {
    try {
        const seriesName = req.params.seriesName;
        const seasonNumber = parseInt(req.params.seasonNumber);
        const episodesData = req.body.episodes;
        
        if (!Array.isArray(episodesData)) {
            return res.status(400).json({ error: 'Episodes must be an array.' });
        }
        
        // Add series and season info to each episode
        const episodesToInsert = episodesData.map(episode => ({
            ...episode,
            seriesName: seriesName,
            seasonNumber: seasonNumber
        }));
        
        const insertedEpisodes = await Episode.insertMany(episodesToInsert);
        res.status(201).json(insertedEpisodes);
    } catch (err) {
        res.status(400).json({ error: 'Failed to add episodes.', details: err.message });
    }
});

// ================================================================
// STATIC FILES AND CATCH-ALL
// ================================================================

// Serve static files from the root directory
app.use(express.static(__dirname));

// Catch-all route to serve the index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
