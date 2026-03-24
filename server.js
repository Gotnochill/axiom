const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory data store ────────────────────────────────────────────
let siteIdCounter = 4;
let sites = [
  {
    id: 1,
    name: 'Rajiv Gandhi Government Hospital Expansion',
    type: 'Hospital',
    description: 'New wing construction with 200 additional beds and modern ICU facility. Expected to serve 50,000+ patients annually.',
    status: 'In Progress',
    lat: 13.0827,
    lng: 80.2707,
    radius: 500,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    name: 'National Highway 44 Flyover',
    type: 'Road',
    description: 'Six-lane flyover to reduce congestion at the major junction. Will cut travel time by 25 minutes during peak hours.',
    status: 'In Progress',
    lat: 12.9716,
    lng: 77.5946,
    radius: 800,
    createdAt: new Date().toISOString()
  },
  {
    id: 3,
    name: 'IIT Campus New Academic Block',
    type: 'College',
    description: 'State-of-the-art academic block with smart classrooms, research labs and a 500-seat auditorium.',
    status: 'Completed',
    lat: 28.5459,
    lng: 77.1926,
    radius: 600,
    createdAt: new Date().toISOString()
  }
];

// ── API Routes ──────────────────────────────────────────────────────

// Get all sites
app.get('/api/sites', (req, res) => {
  res.json({ success: true, data: sites });
});

// Get single site
app.get('/api/sites/:id', (req, res) => {
  const site = sites.find(s => s.id === parseInt(req.params.id));
  if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
  res.json({ success: true, data: site });
});

// Create site
app.post('/api/sites', (req, res) => {
  const { name, type, description, status, lat, lng, radius } = req.body;
  if (!name || !type || !lat || !lng) {
    return res.status(400).json({ success: false, message: 'Name, type, latitude and longitude are required' });
  }
  const site = {
    id: siteIdCounter++,
    name,
    type: type || 'Other',
    description: description || '',
    status: status || 'In Progress',
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    radius: parseInt(radius) || 500,
    createdAt: new Date().toISOString()
  };
  sites.push(site);
  res.status(201).json({ success: true, data: site });
});

// Update site
app.put('/api/sites/:id', (req, res) => {
  const index = sites.findIndex(s => s.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ success: false, message: 'Site not found' });
  const { name, type, description, status, lat, lng, radius } = req.body;
  sites[index] = {
    ...sites[index],
    ...(name && { name }),
    ...(type && { type }),
    ...(description !== undefined && { description }),
    ...(status && { status }),
    ...(lat && { lat: parseFloat(lat) }),
    ...(lng && { lng: parseFloat(lng) }),
    ...(radius && { radius: parseInt(radius) }),
    updatedAt: new Date().toISOString()
  };
  res.json({ success: true, data: sites[index] });
});

// Delete site
app.delete('/api/sites/:id', (req, res) => {
  const index = sites.findIndex(s => s.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ success: false, message: 'Site not found' });
  const deleted = sites.splice(index, 1);
  res.json({ success: true, data: deleted[0] });
});

// ── Fallback to index ───────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start server ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ⚡ Axiom server running at http://localhost:${PORT}\n`);
});
