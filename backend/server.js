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
// MONGOOSE SCHEMA AND MODEL
// ================================================================

// Define the schema for an individual episode
const episodeSchema = new mongoose.Schema({
    episodeNumber: { type: Number, required: true },
    title: { type: String, required: true },
    streamingUrl: { type: String, required: true },
});

// Define the schema for a season, which contains multiple episodes
const seasonSchema = new mongoose.Schema({
    seasonNumber: { type: Number, required: true },
    episodes: [episodeSchema], // An array of episode documents
});

// Define the schema for a series, which contains multiple seasons
const seriesSchema = new mongoose.Schema({
    name: { type: String, required: true },
    thumbnail: { type: String, required: true },
    seasons: [seasonSchema], // An array of season documents
    type: { type: String, default: 'series' } // Enforce 'series' type
});

// Create the Mongoose model from the schema
const Series = mongoose.model('Series', seriesSchema);

// ================================================================
// API ENDPOINTS (CRUD OPERATIONS)
// ================================================================

// GET all series (with optional search)
// This is the primary endpoint for your Sketchware app to fetch data.
app.get('/api/series', async (req, res) => {
    try {
        const { search } = req.query;
        let series;

        if (search) {
            // Case-insensitive search on series name
            const regex = new RegExp(search, 'i');
            series = await Series.find({ name: { $regex: regex } });
        } else {
            // If no search query, return all series
            series = await Series.find();
        }

        res.json(series);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch series.' });
    }
});

// POST a new series
// Use this endpoint to add new series to the database.
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
// Use this endpoint to edit a series by its ID.
app.put('/api/series/:id', async (req, res) => {
    try {
        const updatedSeries = await Series.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedSeries) {
            return res.status(404).json({ error: 'Series not found.' });
        }
        res.json(updatedSeries);
    } catch (err) {
        res.status(400).json({ error: 'Failed to update series.', details: err.message });
    }
});

// DELETE a series
// Use this endpoint to delete a series by its ID.
app.delete('/api/series/:id', async (req, res) => {
    try {
        const deletedSeries = await Series.findByIdAndDelete(req.params.id);
        if (!deletedSeries) {
            return res.status(404).json({ error: 'Series not found.' });
        }
        res.json({ message: 'Series deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete series.' });
    }
});

// Serve the static frontend file (index.html)
app.use(express.static('public'));

// Catch-all route to serve the index.html for any other requests
// This is important for single-page applications.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

