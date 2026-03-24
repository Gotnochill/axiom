// ── Civilian Dashboard Logic ────────────────────────────────────────
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────
  let sites = [];
  let userLat = null;
  let userLng = null;
  let userMarker = null;
  let userCircle = null;
  let siteMarkers = {};
  let notifiedSites = new Set();  // Track which sites we've already notified about

  // ── Map Init ───────────────────────────────────────────────────
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  }).setView([20.5937, 78.9629], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://osm.org/copyright">OSM</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // ── Toast ──────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // ── Haversine Distance (meters) ────────────────────────────────
  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    const toRad = deg => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)}m away`;
    return `${(meters / 1000).toFixed(1)}km away`;
  }

  // ── Request Notification Permission ────────────────────────────
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function sendBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">◎</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📍</text></svg>'
      });
    }
  }

  // ── Fetch Sites ────────────────────────────────────────────────
  async function fetchSites() {
    try {
      const res = await fetch('/api/sites');
      const json = await res.json();
      if (json.success) {
        sites = json.data;
        renderSiteMarkers();
        if (userLat !== null) checkProximity();
      }
    } catch (err) {
      showToast('Failed to load project data', 'error');
    }
  }

  // ── Render Site Markers ────────────────────────────────────────
  function renderSiteMarkers() {
    Object.values(siteMarkers).forEach(({ marker, circle }) => {
      map.removeLayer(marker);
      map.removeLayer(circle);
    });
    siteMarkers = {};

    sites.forEach(site => {
      const statusColor = site.status === 'Completed' ? '#10b981' : '#f59e0b';

      const circle = L.circle([site.lat, site.lng], {
        radius: site.radius,
        color: statusColor,
        fillColor: statusColor,
        fillOpacity: 0.06,
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
        <div class="popup-desc">${site.description || 'No description provided.'}</div>
        <div class="popup-status" style="color: ${statusColor}">${site.status}</div>
      `);

      siteMarkers[site.id] = { marker, circle };
    });
  }

  // ── Check Proximity & Notify ───────────────────────────────────
  function checkProximity() {
    if (userLat === null || userLng === null) return;

    const sortedSites = sites.map(site => {
      const distance = haversineDistance(userLat, userLng, site.lat, site.lng);
      const isNearby = distance <= site.radius;
      return { ...site, distance, isNearby };
    }).sort((a, b) => a.distance - b.distance);

    // Send browser notifications for newly nearby sites
    sortedSites.forEach(site => {
      if (site.isNearby && !notifiedSites.has(site.id)) {
        notifiedSites.add(site.id);
        sendBrowserNotification(
          `📍 ${site.name}`,
          `${site.type} · ${site.status}\n${site.description || 'Public development project near you.'}`
        );
        showToast(`You're near: ${site.name}`, 'success');
      }
    });

    // Clear notified status when user leaves radius (with 10% buffer)
    notifiedSites.forEach(id => {
      const site = sortedSites.find(s => s.id === id);
      if (site && site.distance > site.radius * 1.1) {
        notifiedSites.delete(id);
      }
    });

    // Render notification list in sidebar
    renderNotificationList(sortedSites);

    // Highlight nearby markers
    sortedSites.forEach(site => {
      if (siteMarkers[site.id]) {
        const color = site.isNearby ? '#10b981' : (site.status === 'Completed' ? '#10b981' : '#f59e0b');
        siteMarkers[site.id].circle.setStyle({
          fillOpacity: site.isNearby ? 0.15 : 0.06,
          weight: site.isNearby ? 2.5 : 1.5
        });
      }
    });
  }

  // ── Render Notification List ───────────────────────────────────
  function renderNotificationList(sortedSites) {
    const list = document.getElementById('notification-list');

    if (sortedSites.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <span>🔔</span>
          <p>No development projects registered yet.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = sortedSites.map(site => {
      const nearbyClass = site.isNearby ? 'nearby' : '';
      const typeEmoji = {
        Hospital: '🏥', College: '🎓', Road: '🛣️', Bridge: '🌉',
        Railway: '🚆', 'Water Supply': '💧', Park: '🌳', Other: '📌'
      }[site.type] || '📌';

      return `
        <div class="notification-item ${nearbyClass}" data-id="${site.id}">
          <div class="notif-title">${typeEmoji} ${site.name}</div>
          <div class="notif-desc">${site.description || 'Public development project.'}</div>
          <div class="notif-distance">${site.isNearby ? '🟢 Inside geo-fence' : ''} ${formatDistance(site.distance)} · ${site.status}</div>
        </div>
      `;
    }).join('');

    // Click to fly to site
    list.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id);
        const site = sites.find(s => s.id === id);
        if (site) {
          map.flyTo([site.lat, site.lng], 15, { duration: 1 });
          if (siteMarkers[id]) siteMarkers[id].marker.openPopup();
        }
      });
    });
  }

  // ── Geolocation ────────────────────────────────────────────────
  const locationDot = document.getElementById('location-dot');
  const locationText = document.getElementById('location-text');

  function updateUserPosition(lat, lng) {
    userLat = lat;
    userLng = lng;

    // Update status indicator
    locationDot.classList.add('active');
    locationText.textContent = `Location: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;

    // Update user marker on map
    if (userMarker) {
      userMarker.setLatLng([lat, lng]);
      userCircle.setLatLng([lat, lng]);
    } else {
      userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'user-marker',
          html: `<div style="
            width: 16px; height: 16px;
            background: #3b82f6;
            border: 3px solid #fff;
            border-radius: 50%;
            box-shadow: 0 0 12px rgba(59,130,246,0.7);
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        }),
        zIndexOffset: 1000
      }).addTo(map);

      userMarker.bindPopup('<h4>📍 You are here</h4>');

      userCircle = L.circle([lat, lng], {
        radius: 50,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        weight: 1
      }).addTo(map);

      // Center map on user's first location
      map.flyTo([lat, lng], 13, { duration: 1.5 });
    }

    checkProximity();
  }

  function initGeolocation() {
    if (!('geolocation' in navigator)) {
      locationText.textContent = 'Geolocation not supported';
      showToast('Your browser does not support geolocation', 'error');
      return;
    }

    // Watch position continuously
    navigator.geolocation.watchPosition(
      (pos) => {
        updateUserPosition(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        locationText.textContent = 'Location access denied';
        locationDot.classList.remove('active');

        if (err.code === 1) {
          showToast('Location access denied. Please enable it in browser settings.', 'error');
        } else {
          showToast('Unable to get your location: ' + err.message, 'error');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );
  }

  // ── Periodic refresh ───────────────────────────────────────────
  setInterval(fetchSites, 15000); // Refresh sites every 15 seconds

  // ── Init ───────────────────────────────────────────────────────
  requestNotificationPermission();
  fetchSites();
  initGeolocation();

})();
