// Open-Meteo API Configuration
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const currentLocationBtn = document.getElementById('currentLocationBtn');
const errorMessage = document.getElementById('errorMessage');
const currentWeather = document.getElementById('currentWeather');
const alertsSection = document.getElementById('alertsSection');
const loading = document.getElementById('loading');
const tabsContainer = document.getElementById('tabsContainer');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Chart instances
let charts = {};
let weatherMap = null;

// Weather code to icon mapping (Font Awesome)
const WEATHER_ICONS = {
    0: 'fas fa-sun',           // Clear sky
    1: 'fas fa-cloud-sun',     // Mainly clear
    2: 'fas fa-cloud',         // Partly cloudy
    3: 'fas fa-cloud',         // Overcast
    45: 'fas fa-smog',         // Foggy
    48: 'fas fa-smog',         // Depositing rime fog
    51: 'fas fa-cloud-rain',   // Light drizzle
    53: 'fas fa-cloud-rain',   // Moderate drizzle
    55: 'fas fa-cloud-rain',   // Dense drizzle
    61: 'fas fa-cloud-rain',   // Slight rain
    63: 'fas fa-cloud-rain',   // Moderate rain
    65: 'fas fa-cloud-rain',   // Heavy rain
    71: 'fas fa-snowflake',    // Slight snow
    73: 'fas fa-snowflake',    // Moderate snow
    75: 'fas fa-snowflake',    // Heavy snow
    77: 'fas fa-snowflake',    // Snow grains
    80: 'fas fa-cloud-rain',   // Slight rain showers
    81: 'fas fa-cloud-rain',   // Moderate rain showers
    82: 'fas fa-cloud-rain',   // Violent rain showers
    85: 'fas fa-snowflake',    // Slight snow showers
    86: 'fas fa-snowflake',    // Heavy snow showers
    95: 'fas fa-bolt',         // Thunderstorm
    96: 'fas fa-bolt',         // Thunderstorm with slight hail
    99: 'fas fa-bolt'          // Thunderstorm with heavy hail
};

// Weather descriptions
const WEATHER_DESCRIPTIONS = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
};

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});
currentLocationBtn.addEventListener('click', handleCurrentLocation);

// Tab switching
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        switchTab(tabName);
    });
});

// Observation form
document.getElementById('observationIntensity')?.addEventListener('input', (e) => {
    document.getElementById('intensityValue').textContent = e.target.value;
});

document.getElementById('submitObservation')?.addEventListener('click', submitObservation);

/**
 * Handle search button click
 */
function handleSearch() {
    const city = searchInput.value.trim();
    if (!city) {
        showError('Please enter a city name');
        return;
    }
    geocodeCity(city);
}

/**
 * Handle current location button click
 */
function handleCurrentLocation() {
    if (navigator.geolocation) {
        showLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchWeatherByCoordinates(latitude, longitude);
            },
            (error) => {
                showLoading(false);
                showError('Unable to retrieve your location. Please try searching for a city instead.');
                console.error('Geolocation error:', error);
            }
        );
    } else {
        showError('Geolocation is not supported by your browser');
    }
}

/**
 * Geocode city name to coordinates
 */
function geocodeCity(city) {
    showLoading(true);
    clearError();

    fetch(`${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`)
        .then(response => {
            if (!response.ok) throw new Error('Geocoding failed');
            return response.json();
        })
        .then(data => {
            if (!data.results || data.results.length === 0) {
                showLoading(false);
                showError('City not found. Please try another search.');
                return;
            }
            
            const result = data.results[0];
            const { latitude, longitude, name, country, admin1 } = result;
            
            const cityDisplay = admin1 ? `${name}, ${admin1}, ${country}` : `${name}, ${country}`;
            searchInput.value = cityDisplay;
            
            fetchWeatherByCoordinates(latitude, longitude, cityDisplay);
        })
        .catch(error => {
            showLoading(false);
            showError('Failed to search for city. Please try again.');
            console.error('Geocoding error:', error);
        });
}

/**
 * Fetch weather data by coordinates
 */
function fetchWeatherByCoordinates(lat, lon, cityDisplay = null) {
    showLoading(true);
    clearError();

    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,precipitation,cloud_cover',
        hourly: 'temperature_2m,weather_code,precipitation,wind_speed_10m,relative_humidity_2m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_max',
        temperature_unit: 'celsius',
        wind_speed_unit: 'kmh',
        precipitation_unit: 'mm',
        timezone: 'auto',
        forecast_days: 16
    });

    fetch(`${OPEN_METEO_URL}?${params}`)
        .then(response => {
            if (!response.ok) throw new Error('Weather API failed');
            return response.json();
        })
        .then(data => {
            if (!data.current) {
                throw new Error('No weather data received');
            }
            displayCurrentWeather(data, cityDisplay, lat, lon);
            displayHourlyForecast(data);
            displayDailyForecast(data);
            generateCharts(data);
            initializeMap(lat, lon);
            generateAlerts(data);
            displayObservations();
            tabsContainer.classList.remove('hidden');
            showLoading(false);
        })
        .catch(error => {
            showLoading(false);
            showError('Failed to fetch weather data. Please try again.');
            console.error('Error fetching weather:', error);
        });
}

/**
 * Display current weather
 */
function displayCurrentWeather(data, cityDisplay, lat, lon) {
    const current = data.current;
    const daily = data.daily;
    const today = daily.time[0];
    const todayIndex = 0;

    if (!cityDisplay) {
        cityDisplay = `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;
    }

    const weatherCode = current.weather_code;
    const weatherIcon = WEATHER_ICONS[weatherCode] || 'fas fa-cloud';
    const weatherDesc = WEATHER_DESCRIPTIONS[weatherCode] || 'Unknown';

    document.getElementById('cityName').textContent = cityDisplay;
    document.getElementById('weatherDescription').textContent = weatherDesc;
    document.getElementById('temp').textContent = Math.round(current.temperature_2m);
    document.getElementById('tempMax').textContent = Math.round(daily.temperature_2m_max[todayIndex]);
    document.getElementById('tempMin').textContent = Math.round(daily.temperature_2m_min[todayIndex]);
    document.getElementById('feelsLike').textContent = Math.round(current.apparent_temperature);
    document.getElementById('humidity').textContent = current.relative_humidity_2m;
    document.getElementById('windSpeed').textContent = Math.round(current.wind_speed_10m);
    document.getElementById('pressure').textContent = Math.round(current.pressure_msl);
    document.getElementById('precipitation').textContent = current.precipitation || 0;
    document.getElementById('cloudCover').textContent = current.cloud_cover;
    document.getElementById('weatherIcon').innerHTML = `<i class="${weatherIcon}"></i>`;

    currentWeather.classList.remove('hidden');
}

/**
 * Display hourly forecast
 */
function displayHourlyForecast(data) {
    const hourly = data.hourly;
    const hourlyCards = document.getElementById('hourlyCards');
    hourlyCards.innerHTML = '';

    const now = new Date();
    const currentHour = now.getHours();
    const hourlyLimit = 48; // Next 48 hours

    for (let i = 0; i < Math.min(hourlyLimit, hourly.time.length); i++) {
        const time = new Date(hourly.time[i]);
        const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        const weatherCode = hourly.weather_code[i];
        const weatherIcon = WEATHER_ICONS[weatherCode] || 'fas fa-cloud';
        const temp = Math.round(hourly.temperature_2m[i]);
        const rain = hourly.precipitation[i] || 0;

        const card = document.createElement('div');
        card.className = 'hourly-card';
        card.innerHTML = `
            <div class="hourly-time">${timeStr}</div>
            <div class="hourly-icon"><i class="${weatherIcon}"></i></div>
            <div class="hourly-temp">${temp}°</div>
            <div class="hourly-rain"><i class="fas fa-droplets"></i> ${rain}mm</div>
        `;
        
        hourlyCards.appendChild(card);
    }
}

/**
 * Display 16-day forecast
 */
function displayDailyForecast(data) {
    const daily = data.daily;
    const forecastCards = document.getElementById('forecastCards');
    forecastCards.innerHTML = '';

    for (let i = 0; i < daily.time.length; i++) {
        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        
        const weatherCode = daily.weather_code[i];
        const weatherIcon = WEATHER_ICONS[weatherCode] || 'fas fa-cloud';
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const rain = daily.precipitation_sum[i] || 0;
        
        const card = document.createElement('div');
        card.className = 'forecast-card';
        
        card.innerHTML = `
            <div class="date">${dayName}</div>
            <div class="forecast-icon"><i class="${weatherIcon}"></i></div>
            <div class="forecast-temp">${maxTemp}°</div>
            <div class="forecast-min">${minTemp}°</div>
            <div class="forecast-rain"><i class="fas fa-droplets"></i> ${rain}mm</div>
        `;
        
        forecastCards.appendChild(card);
    }
}

/**
 * Generate charts
 */
function generateCharts(data) {
    const daily = data.daily;
    const labels = daily.time.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    // Temperature Chart
    const tempCtx = document.getElementById('temperatureChart');
    if (tempCtx) {
        if (charts.temperature) charts.temperature.destroy();
        charts.temperature = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Max Temp (°C)',
                        data: daily.temperature_2m_max,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Min Temp (°C)',
                        data: daily.temperature_2m_min,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        title: { display: true, text: 'Temperature (°C)' }
                    }
                }
            }
        });
    }

    // Precipitation Chart
    const precipCtx = document.getElementById('precipitationChart');
    if (precipCtx) {
        if (charts.precipitation) charts.precipitation.destroy();
        charts.precipitation = new Chart(precipCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Precipitation (mm)',
                    data: daily.precipitation_sum,
                    backgroundColor: '#3498db',
                    borderColor: '#2980b9',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Humidity Chart
    const humidityCtx = document.getElementById('humidityChart');
    if (humidityCtx) {
        if (charts.humidity) charts.humidity.destroy();
        charts.humidity = new Chart(humidityCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Humidity (%)',
                    data: daily.relative_humidity_2m_max,
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    // Wind Chart
    const windCtx = document.getElementById('windChart');
    if (windCtx) {
        if (charts.wind) charts.wind.destroy();
        charts.wind = new Chart(windCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Wind Speed (km/h)',
                    data: daily.wind_speed_10m_max,
                    backgroundColor: '#f39c12',
                    borderColor: '#d68910',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }
}

/**
 * Generate weather alerts
 */
function generateAlerts(data) {
    const alertsList = document.getElementById('alertsList');
    alertsList.innerHTML = '';
    const alerts = [];

    const daily = data.daily;
    
    for (let i = 0; i < Math.min(3, daily.time.length); i++) {
        const temp = daily.temperature_2m_max[i];
        const precipitation = daily.precipitation_sum[i] || 0;
        const windSpeed = daily.wind_speed_10m_max[i] || 0;
        const weatherCode = daily.weather_code[i];
        const date = new Date(daily.time[i]).toLocaleDateString();

        // Temperature alerts
        if (temp > 35) {
            alerts.push({
                type: 'Heat Wave',
                level: 'dark-red',
                description: `Extreme heat expected on ${date}: ${Math.round(temp)}°C`,
                icon: 'fas fa-fire'
            });
        } else if (temp > 30) {
            alerts.push({
                type: 'High Temperature',
                level: 'red',
                description: `High temperature on ${date}: ${Math.round(temp)}°C`,
                icon: 'fas fa-sun'
            });
        }

        // Precipitation alerts
        if (precipitation > 50) {
            alerts.push({
                type: 'Heavy Rain',
                level: 'dark-red',
                description: `Heavy rainfall expected on ${date}: ${precipitation}mm`,
                icon: 'fas fa-cloud-rain'
            });
        } else if (precipitation > 20) {
            alerts.push({
                type: 'Moderate Rain',
                level: 'orange',
                description: `Rain expected on ${date}: ${precipitation}mm`,
                icon: 'fas fa-cloud-rain'
            });
        }

        // Wind alerts
        if (windSpeed > 50) {
            alerts.push({
                type: 'Extreme Wind',
                level: 'dark-red',
                description: `Extreme wind expected on ${date}: ${Math.round(windSpeed)} km/h`,
                icon: 'fas fa-wind'
            });
        } else if (windSpeed > 30) {
            alerts.push({
                type: 'Strong Wind',
                level: 'red',
                description: `Strong wind expected on ${date}: ${Math.round(windSpeed)} km/h`,
                icon: 'fas fa-wind'
            });
        }

        // Thunderstorm alerts
        if ([95, 96, 99].includes(weatherCode)) {
            alerts.push({
                type: 'Thunderstorm',
                level: 'red',
                description: `Thunderstorm expected on ${date}`,
                icon: 'fas fa-bolt'
            });
        }
    }

    if (alerts.length > 0) {
        alertsSection.classList.remove('hidden');
        alerts.forEach(alert => {
            const card = document.createElement('div');
            card.className = `alert-card ${alert.level}`;
            card.innerHTML = `
                <div class="alert-title">
                    <i class="${alert.icon}"></i>
                    ${alert.type}
                    <span class="alert-level ${alert.level}">${alert.level.toUpperCase()}</span>
                </div>
                <div class="alert-description">${alert.description}</div>
            `;
            alertsList.appendChild(card);
        });
    } else {
        alertsSection.classList.add('hidden');
    }
}

/**
 * Initialize map
 */
function initializeMap(lat, lon) {
    const mapContainer = document.getElementById('weatherMap');
    
    if (weatherMap) {
        weatherMap.remove();
    }

    weatherMap = L.map('weatherMap').setView([lat, lon], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(weatherMap);

    // Add marker for location
    L.circleMarker([lat, lon], {
        radius: 10,
        fillColor: '#3498db',
        color: '#2980b9',
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.8
    }).addTo(weatherMap);

    // Add temperature layer
    L.tileLayer('https://tile.openweathermap.org/data/2.1/weather_cls_acc/12/{z}/{x}/{y}.png?appid=your_api_key', {
        attribution: '© OpenWeatherMap',
        opacity: 0.5
    }).addTo(weatherMap);
}

/**
 * Switch tabs
 */
function switchTab(tabName) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.add('hidden'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.remove('hidden');

    // Refresh charts when switching to charts tab
    if (tabName === 'charts') {
        Object.values(charts).forEach(chart => chart?.resize());
    }
}

/**
 * Submit observation
 */
function submitObservation() {
    const type = document.getElementById('observationType').value;
    const intensity = document.getElementById('observationIntensity').value;
    const comment = document.getElementById('observationComment').value;

    if (!comment.trim()) {
        showError('Please add a comment to your observation');
        return;
    }

    const observation = {
        id: Date.now(),
        type,
        intensity,
        comment,
        timestamp: new Date().toLocaleString()
    };

    const observations = JSON.parse(localStorage.getItem('observations') || '[]');
    observations.unshift(observation);
    localStorage.setItem('observations', JSON.stringify(observations.slice(0, 50))); // Keep last 50

    document.getElementById('observationComment').value = '';
    displayObservations();
}

/**
 * Display observations
 */
function displayObservations() {
    const observations = JSON.parse(localStorage.getItem('observations') || '[]');
    const list = document.getElementById('observationsList');
    list.innerHTML = '';

    observations.forEach(obs => {
        const card = document.createElement('div');
        card.className = 'observation-card';
        card.innerHTML = `
            <div class="time">${obs.timestamp}</div>
            <div class="type"><i class="fas fa-circle"></i> ${obs.type.charAt(0).toUpperCase() + obs.type.slice(1)}</div>
            <span class="intensity">Intensity: ${obs.intensity}/10</span>
            <div class="comment">${obs.comment}</div>
        `;
        list.appendChild(card);
    });
}

/**
 * Show error message
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

/**
 * Clear error message
 */
function clearError() {
    errorMessage.classList.remove('show');
    errorMessage.textContent = '';
}

/**
 * Show/hide loading
 */
function showLoading(show) {
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

/**
 * Initialize
 */
function init() {
    console.log('CabaneMeteo Advanced initialized');
    displayObservations();
}

document.addEventListener('DOMContentLoaded', init);