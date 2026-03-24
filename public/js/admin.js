// ── Admin Dashboard Logic ───────────────────────────────────────────
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────
  let sites = [];
  let markers = {};       // siteId → { marker, circle }
  let clickMarker = null;
  let editingId = null;

  // ── Map Init ───────────────────────────────────────────────────
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  }).setView([20.5937, 78.9629], 5); // India center

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://osm.org/copyright">OSM</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // ── Map click handler ──────────────────────────────────────────
  const mapMsg = document.getElementById('map-msg');

  map.on('click', function (e) {
    const { lat, lng } = e.latlng;
    document.getElementById('site-lat').value = lat.toFixed(6);
    document.getElementById('site-lng').value = lng.toFixed(6);

    if (clickMarker) map.removeLayer(clickMarker);
    clickMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'click-marker',
        html: '<div style="width:14px;height:14px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(59,130,246,0.6)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
    }).addTo(map);

    showMapMsg('📍 Coordinates set — fill the form and submit');
  });

  // Show overlay message on map
  function showMapMsg(text) {
    mapMsg.textContent = text;
    mapMsg.style.display = 'block';
    clearTimeout(mapMsg._timeout);
    mapMsg._timeout = setTimeout(() => { mapMsg.style.display = 'none'; }, 3000);
  }

  // Initial hint
  setTimeout(() => {
    showMapMsg('📍 Click anywhere on the map to set coordinates');
  }, 800);

  // ── Toast Notifications ────────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // ── API Helpers ────────────────────────────────────────────────
  async function fetchSites() {
    try {
      const res = await fetch('/api/sites');
      const json = await res.json();
      if (json.success) {
        sites = json.data;
        renderSites();
        renderMarkers();
      }
    } catch (err) {
      showToast('Failed to load sites', 'error');
    }
  }

  async function createSite(data) {
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Site added successfully', 'success');
        resetForm();
        fetchSites();
      } else {
        showToast(json.message || 'Failed to add site', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  }

  async function updateSite(id, data) {
    try {
      const res = await fetch(`/api/sites/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Site updated successfully', 'success');
        resetForm();
        fetchSites();
      } else {
        showToast(json.message || 'Failed to update', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  }

  async function deleteSite(id) {
    try {
      const res = await fetch(`/api/sites/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Site deleted', 'success');
        fetchSites();
      }
    } catch (err) {
      showToast('Failed to delete', 'error');
    }
  }

  // ── Render Markers on Map ──────────────────────────────────────
  function renderMarkers() {
    // Clear old markers
    Object.values(markers).forEach(({ marker, circle }) => {
      map.removeLayer(marker);
      map.removeLayer(circle);
    });
    markers = {};

    sites.forEach(site => {
      const statusColor = site.status === 'Completed' ? '#10b981' : '#f59e0b';

      const circle = L.circle([site.lat, site.lng], {
        radius: site.radius,
        color: statusColor,
        fillColor: statusColor,
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: site.status === 'Completed' ? '' : '6 4'
      }).addTo(map);

      const marker = L.marker([site.lat, site.lng], {
        icon: L.divIcon({
          className: 'site-marker',
          html: `<div style="
            width: 12px; height: 12px; 
            background: ${statusColor}; 
            border: 2px solid #fff; 
            border-radius: 50%; 
            box-shadow: 0 0 8px ${statusColor}80;
          "></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(map);

      marker.bindPopup(`
        <h4>${site.name}</h4>
        <div class="popup-type">${site.type} • ${site.radius}m radius</div>
        <div class="popup-desc">${site.description || 'No description'}</div>
        <div class="popup-status" style="color: ${statusColor}">${site.status}</div>
      `);

      markers[site.id] = { marker, circle };
    });
  }

  // ── Render Site List ───────────────────────────────────────────
  function renderSites() {
    const list = document.getElementById('site-list');
    const empty = document.getElementById('empty-state');

    if (sites.length === 0) {
      list.innerHTML = '';
      list.appendChild(empty);
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = sites.map(site => {
      const statusClass = site.status === 'Completed' ? 'completed' : 'in-progress';
      return `
        <div class="site-item" data-id="${site.id}">
          <div class="site-item-header">
            <div class="site-item-name">${site.name}</div>
            <div class="site-item-actions">
              <button class="edit-btn" onclick="event.stopPropagation(); window.__editSite(${site.id})" title="Edit">✎</button>
              <button class="delete-btn" onclick="event.stopPropagation(); window.__deleteSite(${site.id})" title="Delete">✕</button>
            </div>
          </div>
          <div class="site-item-meta">
            <span class="badge badge-type">${site.type}</span>
            <span class="badge badge-status ${statusClass}">${site.status}</span>
          </div>
        </div>
      `;
    }).join('');

    // Click on site item → fly to on map
    list.querySelectorAll('.site-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id);
        const site = sites.find(s => s.id === id);
        if (site) {
          map.flyTo([site.lat, site.lng], 15, { duration: 1 });
          if (markers[id]) markers[id].marker.openPopup();
        }
      });
    });
  }

  // ── Form Handling ──────────────────────────────────────────────
  const form = document.getElementById('site-form');
  const formTitle = document.getElementById('form-title');
  const submitBtn = document.getElementById('submit-btn');
  const formButtons = document.getElementById('form-buttons');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const data = {
      name: document.getElementById('site-name').value.trim(),
      type: document.getElementById('site-type').value,
      description: document.getElementById('site-desc').value.trim(),
      status: document.getElementById('site-status').value,
      lat: document.getElementById('site-lat').value,
      lng: document.getElementById('site-lng').value,
      radius: document.getElementById('site-radius').value
    };

    if (!data.name || !data.lat || !data.lng) {
      showToast('Please fill name and click the map to set coordinates', 'error');
      return;
    }

    if (editingId) {
      updateSite(editingId, data);
    } else {
      createSite(data);
    }
  });

  // ── Edit / Delete / Reset ──────────────────────────────────────
  window.__editSite = function (id) {
    const site = sites.find(s => s.id === id);
    if (!site) return;

    editingId = id;
    document.getElementById('site-name').value = site.name;
    document.getElementById('site-type').value = site.type;
    document.getElementById('site-desc').value = site.description || '';
    document.getElementById('site-status').value = site.status;
    document.getElementById('site-lat').value = site.lat;
    document.getElementById('site-lng').value = site.lng;
    document.getElementById('site-radius').value = site.radius;

    formTitle.textContent = 'Edit Site';
    submitBtn.textContent = 'Update Site';

    // Add cancel button if not present
    if (!document.getElementById('cancel-btn')) {
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.id = 'cancel-btn';
      cancelBtn.className = 'btn btn-cancel';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', resetForm);
      formButtons.style.gridTemplateColumns = '1fr 1fr';
      formButtons.appendChild(cancelBtn);
    }

    map.flyTo([site.lat, site.lng], 15, { duration: 1 });
  };

  window.__deleteSite = function (id) {
    if (confirm('Delete this development site?')) {
      deleteSite(id);
    }
  };

  function resetForm() {
    editingId = null;
    form.reset();
    document.getElementById('site-radius').value = 500;
    formTitle.textContent = 'Add New Site';
    submitBtn.textContent = 'Add Site';
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
      cancelBtn.remove();
      formButtons.style.gridTemplateColumns = '1fr';
    }
    if (clickMarker) {
      map.removeLayer(clickMarker);
      clickMarker = null;
    }
  }

  // ── Init ───────────────────────────────────────────────────────
  fetchSites();

})();
